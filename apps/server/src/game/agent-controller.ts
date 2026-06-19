import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { AgentRuntime, ARCHETYPES, ROSTER, budgetFor, type AgentSpec } from '@table402/agent';
import type { Archetype } from '@table402/shared';
import type { AppContext } from '../core/context';
import { db } from '../db/client';
import { agents as agentsTable, bankrollLog } from '../db/schema';

interface Managed {
  runtime: AgentRuntime;
  spec: AgentSpec;
  autopilot: boolean;
}

export interface ControllerOptions {
  baseUrl: string;
  tableId: string;
  minPlayers: number;
  maxSeats: number;
  thinkMinMs: number;
  thinkMaxMs: number;
  /** Default starting bankroll for a brand-new player (chips). */
  startingChips: number;
}

/**
 * The human's own agent plays autonomously, but waits noticeably longer before
 * each move than the house bots — leaving a comfortable window to step in and
 * act manually. If the human doesn't act, the agent decides for them.
 */
const USER_THINK_MIN_MS = 6000;
const USER_THINK_MAX_MS = 9000;

export interface MineStatus {
  agentId: string;
  name: string;
  archetype: string;
  seatIndex: number | null;
  autopilot: boolean;
}

export interface AgentStatus {
  mine: MineStatus | null;
  userCount: number;
  botCount: number;
  seated: number;
  /** Persistent bankroll for this client's agent (default if they've never played). */
  bankroll: number;
  /** Stable agent id for this client (derived from clientId) — usable even when not seated. */
  agentId: string;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Spawns autonomous agents server-side on behalf of web users. Enforces **one
 * agent per user** (keyed by a browser clientId) and keeps the table populated
 * with "house bots" from the roster so a single user always has opponents.
 */
export class AgentController {
  private users = new Map<string, Managed>();
  private bots = new Map<string, Managed>();
  private starting = new Set<string>();

  constructor(
    private ctx: AppContext,
    private opts: ControllerOptions,
  ) {}

  private isSeated(agentId: string): boolean {
    return this.ctx.table.seatsOverview().some((s) => s.agentId === agentId);
  }

  /** Collision-resistant agent id derived from the FULL clientId. */
  private agentIdFor(clientId: string): string {
    return `user-${createHash('sha256').update(clientId).digest('hex').slice(0, 12)}`;
  }

  private spawn(
    spec: AgentSpec,
    override?: { thinkMinMs?: number; thinkMaxMs?: number; buyIn?: number },
  ): AgentRuntime {
    return new AgentRuntime(spec, {
      baseUrl: this.opts.baseUrl,
      tableId: this.opts.tableId,
      thinkMinMs: override?.thinkMinMs ?? this.opts.thinkMinMs,
      thinkMaxMs: override?.thinkMaxMs ?? this.opts.thinkMaxMs,
      // poll-only avoids the server opening a WebSocket to itself per agent.
      useWebSocket: false,
      buyIn: override?.buyIn,
    });
  }

  private mine(m: Managed): MineStatus {
    return {
      agentId: m.spec.id,
      name: m.spec.name,
      archetype: m.spec.archetype,
      seatIndex: m.runtime.seatIndex,
      autopilot: m.autopilot,
    };
  }

  /**
   * Start the caller's single agent (idempotent per clientId). The seat **always
   * plays autonomously**, but with a long think window so the human can step in
   * and act manually at any decision; if they don't, the agent decides for them.
   */
  async start(
    clientId: string,
    choice: { archetype?: string; name?: string; buyIn?: number },
  ): Promise<MineStatus> {
    const existing = this.users.get(clientId);
    if (existing) return this.mine(existing); // one player per user
    if (this.starting.has(clientId)) throw new Error('your agent is already starting');
    this.starting.add(clientId); // reserve the slot synchronously (seen by stop())
    try {
      const archetype = (
        ARCHETYPES.includes(choice.archetype as Archetype) ? choice.archetype : pickRandom(ARCHETYPES)
      ) as Archetype;
      const id = this.agentIdFor(clientId);
      const name = (choice.name ?? '').trim().slice(0, 24) || 'You';
      // Fresh session: the persistent bankroll carries, but the P&L log + Net P&L
      // start from zero each time the player takes a seat.
      await db.delete(bankrollLog).where(eq(bankrollLog.agentId, id));
      const spec: AgentSpec = { id, name, archetype, budget: budgetFor(archetype) };

      const runtime = this.spawn(spec, {
        thinkMinMs: USER_THINK_MIN_MS,
        thinkMaxMs: USER_THINK_MAX_MS,
        buyIn: choice.buyIn,
      });
      const joined = await runtime.join();
      if (!joined) throw new Error('could not seat your agent (table may be full)');
      runtime.start(); // always autonomous; the human can still override any decision
      this.users.set(clientId, { runtime, spec, autopilot: true });
    } finally {
      this.starting.delete(clientId);
    }
    // Filling opponents must never fail the user's own start.
    await this.ensureBots();
    return this.mine(this.users.get(clientId)!);
  }

  /** Toggle autopilot for an already-seated user agent. */
  setAutopilot(clientId: string, on: boolean): MineStatus | null {
    const m = this.users.get(clientId);
    if (!m) return null;
    if (on && !m.autopilot) m.runtime.start();
    if (!on && m.autopilot) m.runtime.pause();
    m.autopilot = on;
    return this.mine(m);
  }

  /** Stop + remove the caller's agent. Clears house bots once nobody is playing. */
  async stop(clientId: string): Promise<boolean> {
    const m = this.users.get(clientId);
    if (!m) return false;
    this.users.delete(clientId);
    m.runtime.stop();
    await m.runtime.leave();
    // Only tear down bots when no users are active AND none are mid-start.
    if (this.users.size === 0 && this.starting.size === 0) await this.removeBots();
    return true;
  }

  private async ensureBots(): Promise<void> {
    const target = Math.min(this.opts.minPlayers, this.opts.maxSeats);
    for (const spec of ROSTER) {
      if (this.ctx.table.seatedCount() >= target) break;
      if (this.bots.has(spec.id) || this.isSeated(spec.id)) continue;
      const runtime = this.spawn(spec);
      this.bots.set(spec.id, { runtime, spec, autopilot: true }); // reserve before awaiting (prevents double-spawn)
      try {
        if (await runtime.join()) {
          runtime.start();
        } else {
          this.bots.delete(spec.id);
          runtime.stop();
        }
      } catch {
        this.bots.delete(spec.id);
        try {
          runtime.stop();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async removeBots(): Promise<void> {
    const all = [...this.bots.values()];
    this.bots.clear();
    for (const m of all) {
      m.runtime.stop();
      await m.runtime.leave();
    }
  }

  async status(clientId: string): Promise<AgentStatus> {
    const m = this.users.get(clientId);
    // Bank account persists per agent (keyed by clientId), even before being seated.
    let bankroll = this.opts.startingChips;
    if (clientId) {
      const row = await db
        .select({ bankroll: agentsTable.bankroll })
        .from(agentsTable)
        .where(eq(agentsTable.id, this.agentIdFor(clientId)))
        .get();
      if (row) bankroll = row.bankroll;
    }
    return {
      mine: m ? this.mine(m) : null,
      userCount: this.users.size,
      botCount: this.bots.size,
      seated: this.ctx.table.seatedCount(),
      bankroll,
      agentId: clientId ? this.agentIdFor(clientId) : '',
    };
  }

  /** Stop everything (used on shutdown). */
  async shutdown(): Promise<void> {
    for (const m of [...this.users.values(), ...this.bots.values()]) {
      m.runtime.stop();
      await m.runtime.leave();
    }
    this.users.clear();
    this.bots.clear();
  }
}
