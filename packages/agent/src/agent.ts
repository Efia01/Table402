import { MppClient, createSessionAuthorization, deriveIdentity } from '@table402/mpp';
import { SIM_USD, parseUsd } from '@table402/shared';
import { decide, type AgentView } from './strategies';
import type { AgentSpec } from './roster';

export interface AgentEnv {
  baseUrl: string;
  tableId: string;
  log?: (msg: string) => void;
  /** Min/max "think time" (ms) before each action — used to pace gameplay. */
  thinkMinMs?: number;
  thinkMaxMs?: number;
  /** Subscribe to the live feed over WebSocket (default true). Polling is the fallback. */
  useWebSocket?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * An autonomous player. It funds itself at the testnet faucet, discovers the table,
 * checks prices against its budget, pays the seat fee over MPP (402 -> sign -> retry),
 * opens a session, then reacts to its turn and pays per action — pausing a human-ish
 * "think time" before each move so the game runs at a watchable, real-time pace.
 */
export class AgentRuntime {
  readonly spec: AgentSpec;
  private env: AgentEnv;
  private identity = deriveIdentity('placeholder');
  private client: MppClient;
  private tableWalletAddress = '';
  private thinkMin: number;
  private thinkMax: number;
  private useWs: boolean;
  seatIndex: number | null = null;
  sessionId: string | null = null;
  private ws: WebSocket | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private stopped = false;
  private lastTurnKey = '';
  seatFeePaid = 0;
  actionsTaken = 0;

  constructor(spec: AgentSpec, env: AgentEnv) {
    this.spec = spec;
    this.env = env;
    this.identity = deriveIdentity(spec.id);
    this.thinkMin = env.thinkMinMs ?? 1200;
    this.thinkMax = env.thinkMaxMs ?? 2600;
    this.useWs = env.useWebSocket ?? true;
    this.client = new MppClient({ identity: this.identity, maxAmount: spec.budget.maxSeatFee });
  }

  get agentId(): string {
    return this.spec.id;
  }
  get name(): string {
    return this.spec.name;
  }
  get archetype(): string {
    return this.spec.archetype;
  }
  get address(): string {
    return this.identity.address;
  }
  get did(): string {
    return this.identity.did;
  }

  private log(msg: string): void {
    this.env.log?.(`${this.spec.name.padEnd(12)} ${msg}`);
  }

  /** Top up at the testnet faucet so a brand-new wallet can pay its first seat fee. */
  private async faucet(): Promise<void> {
    try {
      const res = await fetch(`${this.env.baseUrl}/faucet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: this.identity.address, label: this.spec.name }),
      });
      if (!res.ok) {
        this.log(`faucet returned HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (body && body.ok === false) this.log(`faucet declined: ${body.error ?? 'unknown'}`);
    } catch (err) {
      this.log(`faucet unreachable: ${(err as Error).message}`);
    }
  }

  async inspectTable(): Promise<{ affordable: boolean; table: any }> {
    const res = await fetch(`${this.env.baseUrl}/tables/${this.env.tableId}`);
    const data = (await res.json()) as any;
    this.tableWalletAddress = data.walletAddress;
    const t = data.table;
    const b = this.spec.budget;
    const affordable =
      t.seatFee <= b.maxSeatFee && t.perHandFee <= b.maxHandFee && t.perActionFee <= b.maxActionFee;
    return { affordable, table: t };
  }

  async join(): Promise<boolean> {
    await this.faucet();
    const { affordable, table } = await this.inspectTable();
    if (!affordable) {
      this.log(`✗ prices exceed budget — refusing to join`);
      return false;
    }
    const deposit = Math.min(parseUsd('0.25'), this.spec.budget.maxSpend - table.seatFee);
    const sessionAuth = await createSessionAuthorization(this.identity, {
      recipient: this.tableWalletAddress,
      currency: SIM_USD.code,
      deposit: String(deposit),
      maxDeposit: String(deposit),
    });

    let body: any;
    try {
      const { response, paid, receipt } = await this.client.fetch(
        `${this.env.baseUrl}/tables/${this.env.tableId}/join`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            agentId: this.spec.id,
            name: this.spec.name,
            archetype: this.spec.archetype,
            session: sessionAuth,
          }),
        },
      );
      body = await response.json();
      if (!response.ok || body.seatIndex == null) {
        this.log(`✗ join failed: ${JSON.stringify(body)}`);
        return false;
      }
      this.seatFeePaid = Number(receipt?.settlement.amount ?? 0);
      this.log(
        `→ discovered table → 402 challenge → paid seat fee ${receipt?.settlement.amount} → seat #${body.seatIndex} (${paid ? 'PAID' : 'free'}), session opened`,
      );
    } catch (err) {
      this.log(`✗ join error: ${(err as Error).message}`);
      return false;
    }
    this.seatIndex = body.seatIndex;
    this.sessionId = body.sessionId;
    return true;
  }

  start(): void {
    if (this.stopped) return;
    if (this.poll) clearInterval(this.poll);
    if (this.useWs) this.connect();
    this.poll = setInterval(() => void this.takeTurn(), 800);
    void this.takeTurn();
  }

  /** Stop the autonomous loop but keep the agent seated (for manual control / resume). */
  pause(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  private connect(): void {
    if (this.stopped) return;
    const url = `${this.env.baseUrl.replace(/^http/, 'ws')}/play?table=${this.env.tableId}`;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.addEventListener('message', (ev) => {
        if (this.stopped) return;
        try {
          const raw = typeof ev.data === 'string' ? ev.data : String(ev.data);
          const msg = JSON.parse(raw);
          if (msg.type === 'state' && msg.state?.toActSeat === this.seatIndex) {
            void this.takeTurn();
          }
        } catch {
          /* ignore */
        }
      });
      ws.addEventListener('close', () => {
        if (!this.stopped) setTimeout(() => this.connect(), 1200);
      });
      ws.addEventListener('error', () => {});
    } catch {
      /* poll fallback still drives turns */
    }
  }

  private async takeTurn(): Promise<void> {
    if (this.busy || this.stopped || this.seatIndex == null) return;
    this.busy = true;
    try {
      const res = await fetch(`${this.env.baseUrl}/tables/${this.env.tableId}/view?agentId=${this.spec.id}`);
      const { view } = (await res.json()) as { view: AgentView | null };
      if (!view || !view.isInHand || !view.isTurn || view.legal.types.length === 0) return;
      const key = `${view.handId}:${view.street}:${view.toCall}:${view.board.join('')}:${view.legal.types.join('')}`;
      if (key === this.lastTurnKey) return;
      const decision = decide(this.spec.archetype, view);

      // Human-ish pause before acting — paces the game to a real-time speed.
      const think = this.thinkMin + Math.random() * Math.max(0, this.thinkMax - this.thinkMin);
      await sleep(think);
      if (this.stopped || this.seatIndex == null) return;

      // Re-validate it's still our turn — the table may have advanced (or auto-acted) during the pause.
      const recheck = await fetch(
        `${this.env.baseUrl}/tables/${this.env.tableId}/view?agentId=${this.spec.id}`,
      );
      const recheckView = ((await recheck.json()) as { view: AgentView | null }).view;
      if (!recheckView || !recheckView.isTurn || recheckView.handId !== view.handId) return;

      const r = await fetch(`${this.env.baseUrl}/tables/${this.env.tableId}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: this.spec.id, type: decision.type, amount: decision.amount }),
      });
      if (r.ok) {
        this.lastTurnKey = key;
        this.actionsTaken += 1;
      }
    } catch {
      /* transient; the next poll retries */
    } finally {
      this.busy = false;
    }
  }

  async leave(): Promise<void> {
    try {
      await fetch(`${this.env.baseUrl}/tables/${this.env.tableId}/leave`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: this.spec.id }),
      });
    } catch {
      /* ignore */
    }
    // Leaving is terminal — stop the local poll loop so we don't keep hitting /view.
    this.stop();
  }

  stop(): void {
    this.stopped = true;
    if (this.poll) clearInterval(this.poll);
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }
}
