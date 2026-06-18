import { createHash } from 'node:crypto';
import { AgentRuntime, ARCHETYPES, ROSTER, budgetFor, type AgentSpec } from '@table402/agent';
import type { Archetype } from '@table402/shared';
import type { AppContext } from '../core/context';

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
}

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

  private spawn(spec: AgentSpec): AgentRuntime {
    return new AgentRuntime(spec, {
      baseUrl: this.opts.baseUrl,
      tableId: this.opts.tableId,
      thinkMinMs: this.opts.thinkMinMs,
      thinkMaxMs: this.opts.thinkMaxMs,
      // poll-only avoids the server opening a WebSocket to itself per agent.
      useWebSocket: false,
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
   * Start the caller's single agent (idempotent per clientId). By default the seat
   * is **human-controlled** (the player acts via the UI). With `autopilot`, the
   * agent plays itself.
   */
  async start(
    clientId: string,
    choice: { archetype?: string; name?: string; autopilot?: boolean },
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
      const spec: AgentSpec = { id, name, archetype, budget: budgetFor(archetype) };

      const runtime = this.spawn(spec);
      const joined = await runtime.join();
      if (!joined) throw new Error('could not seat your agent (table may be full)');
      // Only run the autonomous play loop in autopilot mode; otherwise the human drives this seat.
      if (choice.autopilot) runtime.start();
      this.users.set(clientId, { runtime, spec, autopilot: !!choice.autopilot });
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

  status(clientId: string): AgentStatus {
    const m = this.users.get(clientId);
    return {
      mine: m ? this.mine(m) : null,
      userCount: this.users.size,
      botCount: this.bots.size,
      seated: this.ctx.table.seatedCount(),
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
