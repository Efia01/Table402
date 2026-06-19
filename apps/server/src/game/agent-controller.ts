import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { AgentRuntime, ARCHETYPES, budgetFor, type AgentSpec } from '@table402/agent';
import { USER_AGENT_THINK_MS, type Archetype } from '@table402/shared';
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
 * The human's own agent plays autonomously, but waits a fixed, noticeably longer
 * window before each move than the house bots — leaving a comfortable, predictable
 * window to step in and act manually. If the human doesn't act, the agent decides
 * for them. Kept as a fixed value so the UI can show an accurate countdown.
 */
const USER_THINK_MIN_MS = USER_AGENT_THINK_MS;
const USER_THINK_MAX_MS = USER_AGENT_THINK_MS;

/** A pool of house-bot personas, picked deterministically per seat. */
const BOT_NAMES = ['Mara', 'Dex', 'Ivo', 'Sloane', 'Nia', 'Rex', 'Vee', 'Otto', 'Lux', 'Juno'];

export interface MineStatus {
  agentId: string;
  name: string;
  archetype: string;
  seatIndex: number | null;
  autopilot: boolean;
  /** Which room this player is seated in. */
  tableId: string;
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
 * Spawns autonomous agents server-side on behalf of web users, for a SINGLE room.
 * Enforces **one agent per user** (keyed by a browser clientId) and keeps the room
 * populated with self-funding "house bots" so every table always has opponents AND
 * at least one open seat for a human.
 */
export class AgentController {
  private users = new Map<string, Managed>();
  private bots = new Map<string, Managed>();
  private starting = new Set<string>();
  /** Unique, self-funding bot specs for this room (never collide across rooms). */
  private readonly botSpecs: AgentSpec[];

  constructor(
    private ctx: AppContext,
    private opts: ControllerOptions,
  ) {
    const slug = opts.tableId.replace(/[^a-z0-9]+/gi, '').slice(0, 10);
    this.botSpecs = Array.from({ length: opts.maxSeats }, (_, i) => {
      const archetype = ARCHETYPES[i % ARCHETYPES.length] as Archetype;
      return {
        id: `house-${slug}-${i}`,
        name: BOT_NAMES[i % BOT_NAMES.length]!,
        archetype,
        budget: budgetFor(archetype),
      };
    });
  }

  get tableId(): string {
    return this.opts.tableId;
  }

  has(clientId: string): boolean {
    return this.users.has(clientId);
  }

  /** Always keep at least one seat open for a human. */
  private get botTarget(): number {
    return Math.min(this.opts.minPlayers, Math.max(1, this.opts.maxSeats - 1));
  }

  private get table() {
    return this.ctx.tableFor(this.opts.tableId) ?? this.ctx.table;
  }

  private isSeated(agentId: string): boolean {
    return this.table.seatsOverview().some((s) => s.agentId === agentId);
  }

  private seatedCount(): number {
    return this.table.seatedCount();
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
      tableId: this.opts.tableId,
    };
  }

  /** Seat the house bots so the room is alive and choosable (call once at boot). */
  async prefill(): Promise<void> {
    await this.ensureBots();
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
      // Guarantee a seat for the human: if the room is full, stand a house bot up.
      if (this.seatedCount() >= this.opts.maxSeats) await this.evictOneBot();

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

  /** Re-buy: add chips to the player's persistent bankroll (in-memory seat + DB). */
  async rebuy(clientId: string, amount?: number): Promise<number> {
    const topUp = amount && amount > 0 ? Math.floor(amount) : this.opts.startingChips;
    const agentId = this.agentIdFor(clientId);
    const row = await db
      .select({ bankroll: agentsTable.bankroll })
      .from(agentsTable)
      .where(eq(agentsTable.id, agentId))
      .get();
    const newBankroll = Math.max(0, row?.bankroll ?? 0) + topUp;
    await db.update(agentsTable).set({ bankroll: newBankroll }).where(eq(agentsTable.id, agentId));
    this.table.setSeatBankroll(agentId, newBankroll);
    return newBankroll;
  }

  /** Stop + remove the caller's agent. House bots stay so the room remains alive. */
  async stop(clientId: string): Promise<boolean> {
    const m = this.users.get(clientId);
    if (!m) return false;
    this.users.delete(clientId);
    m.runtime.stop();
    await m.runtime.leave();
    // Keep the room populated for the lobby, but never below a playable minimum.
    await this.ensureBots();
    return true;
  }

  private async evictOneBot(): Promise<void> {
    const entry = [...this.bots.entries()][0];
    if (!entry) return;
    const [id, m] = entry;
    this.bots.delete(id);
    m.runtime.stop();
    await m.runtime.leave();
  }

  private async ensureBots(): Promise<void> {
    for (const spec of this.botSpecs) {
      if (this.seatedCount() >= this.botTarget) break;
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
      seated: this.seatedCount(),
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

/**
 * Dispatches the web's one-agent-per-browser control across every room's
 * controller — picking the chosen room on start, and finding the player's room
 * for status / stop / autopilot.
 */
export class ControllerHub {
  constructor(private controllers: Map<string, AgentController>) {}

  get tableIds(): string[] {
    return [...this.controllers.keys()];
  }

  private find(clientId: string): AgentController | null {
    for (const c of this.controllers.values()) if (c.has(clientId)) return c;
    return null;
  }

  /** Seat house bots in every room so the lobby shows live, choosable tables. */
  async prefillAll(): Promise<void> {
    for (const c of this.controllers.values()) await c.prefill();
  }

  async start(
    clientId: string,
    choice: { tableId?: string; archetype?: string; name?: string; buyIn?: number },
  ): Promise<MineStatus> {
    const tableId =
      choice.tableId && this.controllers.has(choice.tableId)
        ? choice.tableId
        : this.tableIds[0]!;
    // Switching rooms: stand up from any prior seat first.
    const prior = this.find(clientId);
    if (prior && prior.tableId !== tableId) await prior.stop(clientId);
    return this.controllers.get(tableId)!.start(clientId, choice);
  }

  setAutopilot(clientId: string, on: boolean): MineStatus | null {
    return this.find(clientId)?.setAutopilot(clientId, on) ?? null;
  }

  async rebuy(clientId: string, amount?: number): Promise<number | null> {
    const c = this.find(clientId);
    return c ? c.rebuy(clientId, amount) : null;
  }

  async stop(clientId: string): Promise<boolean> {
    const c = this.find(clientId);
    return c ? c.stop(clientId) : false;
  }

  async status(clientId: string): Promise<AgentStatus> {
    const c = this.find(clientId) ?? this.controllers.get(this.tableIds[0]!)!;
    return c.status(clientId);
  }

  async shutdown(): Promise<void> {
    for (const c of this.controllers.values()) await c.shutdown();
  }
}
