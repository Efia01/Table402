import { MppClient, type MppIdentity, type MppReceipt, type SessionAuthorization } from '@table402/mpp';
import {
  SERVICE_IDS,
  newId,
  nowIso,
  type HandStateDTO,
  type SeatDTO,
  type TableDTO,
} from '@table402/shared';
import {
  applyAction,
  buildHandHistory,
  cardsToStrings,
  createHand,
  legalActions,
  type ActionInput,
  type GameState,
  type HandConfig,
} from '@table402/poker';
import { createReceiptGraph, verifyGraph, type GraphPayment } from '@table402/receipt-graph';
import { db } from '../db/client';
import {
  actions as actionsTable,
  agents as agentsTable,
  bankrollLog,
  hands,
  receiptGraphs,
  sessions,
  tables,
} from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import type { AppContext, PaymentParty } from '../core/context';

interface Seat {
  seatIndex: number;
  agentId: string;
  name: string;
  archetype: string;
  address: string;
  did: string;
  /** In-hand table chips (the buy-in, mutated during the hand). */
  stack: number;
  /** Persistent bankroll — total money that carries between hands. */
  bankroll: number;
  /** This hand's buy-in (so we can compute profit/loss at the end). */
  buyIn: number;
  /** Optional player-chosen per-hand buy-in cap (chips). Defaults to the table cap. */
  requestedBuyIn?: number;
  sessionId: string | null;
  /** True for client-signed human seats — gets a tighter idle-action deadline. */
  human: boolean;
}

interface Participant {
  position: number;
  seatIndex: number;
  agentId: string;
  name: string;
  archetype: string;
  address: string;
  did: string;
  buyIn: number;
  sessionId: string | null;
  human: boolean;
}

interface CurrentHand {
  id: string;
  number: number;
  config: HandConfig;
  state: GameState;
  participants: Participant[];
  payments: GraphPayment[];
}

export interface TableConfigRow {
  id: string;
  name: string;
  maxSeats: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  seatFee: number;
  perHandFee: number;
  perActionFee: number;
  currency: string;
  walletAddress: string;
}

export class TableRuntime {
  private ctx: AppContext;
  private cfg: TableConfigRow;
  private tableIdentity: MppIdentity;
  private client: MppClient;
  private seats: (Seat | null)[];
  private handNumber = 0;
  private handsCompleted = 0;
  private current: CurrentHand | null = null;
  private pendingSeatFees = new Map<string, GraphPayment>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private nextHandTimer: ReturnType<typeof setTimeout> | null = null;
  private starting = false;

  constructor(ctx: AppContext, cfg: TableConfigRow, tableIdentity: MppIdentity) {
    this.ctx = ctx;
    this.cfg = cfg;
    this.tableIdentity = tableIdentity;
    this.seats = new Array(cfg.maxSeats).fill(null);
    this.client = new MppClient({
      identity: tableIdentity,
      maxAmount: Math.max(cfg.perHandFee, cfg.seatFee) * 50,
    });
  }

  get tableId(): string {
    return this.cfg.id;
  }

  get completedHands(): number {
    return this.handsCompleted;
  }

  get walletAddress(): string {
    return this.cfg.walletAddress;
  }

  get seatFee(): number {
    return this.cfg.seatFee;
  }

  get perActionFee(): number {
    return this.cfg.perActionFee;
  }

  get currency(): string {
    return this.cfg.currency;
  }

  get name(): string {
    return this.cfg.name;
  }

  private tableParty(): PaymentParty {
    return { id: this.cfg.id, label: this.cfg.name, type: 'table', address: this.cfg.walletAddress };
  }

  private serviceParty(walletId: string, label: string): PaymentParty {
    const wallet = this.ctx.wallets.getById(walletId)!;
    return { id: walletId, label, type: 'service', address: wallet.address };
  }

  private agentParty(seat: Seat): PaymentParty {
    return { id: seat.agentId, label: seat.name, type: 'agent', address: seat.address };
  }

  private toGraphPayment(
    receipt: MppReceipt,
    kind: GraphPayment['kind'],
    from: PaymentParty,
    to: PaymentParty,
    unlocks: string | null,
  ): GraphPayment {
    return {
      id: newId('edge'),
      kind,
      fromId: from.id,
      fromLabel: from.label,
      fromType: from.type,
      toId: to.id,
      toLabel: to.label,
      toType: to.type,
      amount: Number(receipt.settlement.amount),
      currency: receipt.settlement.currency,
      provider: to.id,
      receiptHash: receipt.receiptHash,
      idempotencyKey: receipt.idempotencyKey ?? null,
      reference: receipt.reference,
      timestamp: receipt.timestamp,
      unlocks,
      receipt,
    };
  }

  private firstEmptySeat(): number | null {
    for (let i = 0; i < this.seats.length; i++) if (!this.seats[i]) return i;
    return null;
  }

  seatedCount(): number {
    return this.seats.filter(Boolean).length;
  }

  // ---- Join + session ----

  async join(input: {
    agentId: string;
    name: string;
    archetype: string;
    address: string;
    did: string;
    seatReceipt: MppReceipt;
    sessionAuth?: SessionAuthorization;
    requestedBuyIn?: number;
    human?: boolean;
  }): Promise<{ seatIndex: number; sessionId: string | null }> {
    if (this.seats.some((s) => s?.agentId === input.agentId)) {
      throw Object.assign(new Error('agent already seated'), { statusCode: 409 });
    }
    const seatIndex = this.firstEmptySeat();
    if (seatIndex == null) throw Object.assign(new Error('table is full'), { statusCode: 409 });

    let sessionId: string | null = null;
    if (input.sessionAuth) {
      const session = await this.ctx.mpp.openSession(input.sessionAuth);
      sessionId = session.id;
      await db.insert(sessions).values({
        id: session.id,
        agentId: input.agentId,
        tableId: this.cfg.id,
        currency: session.currency,
        deposit: Number(session.deposit),
        maxDeposit: Number(session.maxDeposit),
        spent: 0,
        units: 0,
        status: 'open',
        openedAt: session.openedAt,
      });
    }

    // Load the agent's persistent bankroll (carries between sessions).
    const agentRow = await db
      .select({ bankroll: agentsTable.bankroll })
      .from(agentsTable)
      .where(eq(agentsTable.id, input.agentId))
      .get();
    const bankroll = agentRow?.bankroll ?? this.cfg.startingChips;

    const seat: Seat = {
      seatIndex,
      agentId: input.agentId,
      name: input.name,
      archetype: input.archetype,
      address: input.address,
      did: input.did,
      stack: Math.min(this.cfg.startingChips, bankroll),
      bankroll,
      buyIn: 0,
      requestedBuyIn:
        input.requestedBuyIn && input.requestedBuyIn > 0 ? Math.floor(input.requestedBuyIn) : undefined,
      sessionId,
      human: input.human ?? false,
    };
    this.seats[seatIndex] = seat;

    // Record the seat fee and stash it for this agent's first-hand graph (appears once).
    const recorded = await this.ctx.recordPayment({
      receipt: input.seatReceipt,
      kind: 'seat-fee',
      from: this.agentParty(seat),
      to: this.tableParty(),
      tableId: this.cfg.id,
      handId: null,
      unlocks: `seat #${seatIndex} reserved`,
    });
    this.pendingSeatFees.set(
      input.agentId,
      this.toGraphPayment(
        input.seatReceipt,
        'seat-fee',
        this.agentParty(seat),
        this.tableParty(),
        `seat #${seatIndex} reserved`,
      ),
    );
    void recorded;

    this.broadcastState();
    this.ctx.hub.broadcast(this.cfg.id, {
      type: 'log',
      level: 'info',
      message: `${seat.name} joined seat #${seatIndex} (paid seat fee, opened session ${sessionId ? sessionId.slice(0, 10) : 'none'})`,
    });
    await this.ctx.snapshotBalances();
    this.maybeStartHand();
    return { seatIndex, sessionId };
  }

  hasOpenSession(agentId: string): string | null {
    const seat = this.seats.find((s) => s?.agentId === agentId);
    return seat?.sessionId ?? null;
  }

  /** Close an agent's session (refunding unspent escrow) and free its seat. */
  async leave(agentId: string): Promise<{ left: boolean; refunded?: number }> {
    const index = this.seats.findIndex((s) => s?.agentId === agentId);
    if (index < 0) return { left: false };
    const seat = this.seats[index]!;
    let refunded = 0;
    if (seat.sessionId) {
      const closed = this.ctx.mpp.closeSession(seat.sessionId);
      refunded = closed ? Number(closed.deposit) - Number(closed.spent) : 0;
      await db
        .update(sessions)
        .set({ status: 'closed', spent: Number(closed?.spent ?? 0), units: closed?.units ?? 0, closedAt: nowIso() })
        .where(eq(sessions.id, seat.sessionId));
    }
    const wasParticipant = this.current?.participants.some((p) => p.agentId === agentId) ?? false;
    this.seats[index] = null;
    this.pendingSeatFees.delete(agentId); // drop any unconsumed seat-fee edge

    // If they were in the live hand, the hand can no longer be played fairly — abandon it.
    if (wasParticipant) await this.abandonHand(`${seat.name} left mid-hand`);

    // Cancel any scheduled next hand so maybeStartHand re-evaluates the funded count.
    this.clearNextHandTimer();

    await this.ctx.snapshotBalances();
    this.ctx.hub.broadcast(this.cfg.id, {
      type: 'log',
      level: 'info',
      message: `${seat.name} left seat #${index} (session closed, ${refunded} refunded)`,
    });
    this.broadcastState();
    this.maybeStartHand();
    return { left: true, refunded };
  }

  private clearNextHandTimer(): void {
    if (this.nextHandTimer) {
      clearTimeout(this.nextHandTimer);
      this.nextHandTimer = null;
    }
  }

  private async abandonHand(reason: string): Promise<void> {
    const hand = this.current;
    if (!hand) return;
    this.clearTurnTimer();
    this.current = null;
    try {
      await db.update(hands).set({ status: 'abandoned', endedAt: nowIso() }).where(eq(hands.id, hand.id));
    } catch {
      /* ignore */
    }
    this.ctx.hub.broadcast(this.cfg.id, {
      type: 'log',
      level: 'warn',
      message: `Hand #${hand.number} abandoned — ${reason}`,
    });
    this.ctx.hub.broadcast(this.cfg.id, { type: 'table-idle' });
  }

  // ---- Hand lifecycle ----

  maybeStartHand(): void {
    if (!this.ctx.config.autoPlay) return;
    if (this.current || this.starting) return;
    if (this.nextHandTimer) return;
    const funded = this.seats.filter((s) => s && (s.stack > 0 || s.sessionId)).length;
    if (funded < 2) {
      this.ctx.hub.broadcast(this.cfg.id, { type: 'table-idle' });
      return;
    }
    this.nextHandTimer = setTimeout(() => {
      this.nextHandTimer = null;
      void this.startHand().catch((err) => {
        this.ctx.hub.broadcast(this.cfg.id, { type: 'log', level: 'error', message: `start hand failed: ${err}` });
      });
    }, this.ctx.config.handIntervalMs);
  }

  async startHand(): Promise<void> {
    if (this.current || this.starting) return;
    this.starting = true;
    try {
      const BUYIN_CAP = this.cfg.startingChips; // each game you buy in for up to $1,000…
      const BB = this.cfg.bigBlind;
      // …but never for more than your persistent bankroll. Only players who can post
      // the big blind are dealt in; if too few can, re-stake short players so the
      // table stays alive (a fresh game stakes everyone to the cap again).
      let eligible = this.seats.filter((s): s is Seat => !!s && s.bankroll >= BB);
      if (eligible.length < 2) {
        let restaked = 0;
        for (const s of this.seats) {
          if (s && s.bankroll < BUYIN_CAP) {
            s.bankroll = BUYIN_CAP;
            restaked += 1;
          }
        }
        if (restaked > 0) {
          this.ctx.hub.broadcast(this.cfg.id, {
            type: 'log',
            level: 'info',
            message: `Re-staked ${restaked} short player(s) to ${BUYIN_CAP} chips to keep the table alive`,
          });
        }
        eligible = this.seats.filter((s): s is Seat => !!s && s.bankroll >= BB);
      }
      if (eligible.length < 2) {
        this.ctx.hub.broadcast(this.cfg.id, { type: 'table-idle' });
        return;
      }

      const number = ++this.handNumber;
      const handId = newId('hand');

      // 1. Table buys an RNG seed (service fee, table -> RNG).
      const rng = await this.buyService<{ seed: string }>('/services/rng/seed', { handId, tableId: this.cfg.id });
      const seedPayment = this.toGraphPayment(
        rng.receipt,
        'service-fee',
        this.tableParty(),
        this.serviceParty(SERVICE_IDS.rng, 'RNG service'),
        `hand #${number} shuffle seed`,
      );
      await this.ctx.recordPayment({
        receipt: rng.receipt,
        kind: 'service-fee',
        from: this.tableParty(),
        to: this.serviceParty(SERVICE_IDS.rng, 'RNG service'),
        tableId: this.cfg.id,
        handId,
        service: 'rng',
        unlocks: `hand #${number} shuffle seed`,
      });

      // Players may have left during the RNG purchase — re-validate the seated set.
      const live = eligible.filter((s) => this.seats[s.seatIndex]?.agentId === s.agentId);
      if (live.length < 2) {
        this.ctx.hub.broadcast(this.cfg.id, { type: 'table-idle' });
        return;
      }
      const button = number % live.length;

      // Commit buy-ins: move chips from each player's bankroll onto the table.
      // A player may choose to bring less than the table cap (bankroll management).
      for (const s of live) {
        const cap = Math.min(BUYIN_CAP, s.requestedBuyIn ?? BUYIN_CAP);
        s.buyIn = Math.min(cap, s.bankroll);
        s.bankroll -= s.buyIn;
        s.stack = s.buyIn;
      }

      const participants: Participant[] = live.map((seat, position) => ({
        position,
        seatIndex: seat.seatIndex,
        agentId: seat.agentId,
        name: seat.name,
        archetype: seat.archetype,
        address: seat.address,
        did: seat.did,
        buyIn: seat.buyIn,
        sessionId: seat.sessionId,
        human: seat.human,
      }));

      const config: HandConfig = {
        handId,
        seed: rng.data.seed,
        button,
        smallBlind: this.cfg.smallBlind,
        bigBlind: this.cfg.bigBlind,
        seats: participants.map((p) => ({
          index: p.position,
          playerId: p.agentId,
          name: p.name,
          stack: p.buyIn,
        })),
      };

      const state = createHand(config);
      this.current = { id: handId, number, config, state, participants, payments: [seedPayment] };

      await db.insert(hands).values({
        id: handId,
        tableId: this.cfg.id,
        number,
        seed: rng.data.seed,
        button,
        smallBlind: this.cfg.smallBlind,
        bigBlind: this.cfg.bigBlind,
        board: [],
        status: 'in-progress',
        seedReceiptId: rng.receipt.challengeId,
        startedAt: nowIso(),
      });

      // 2. Each dealt-in agent pays the hand fee (session voucher, agent -> table).
      for (const p of participants) {
        await this.chargeHandFee(p, number, handId);
        // attach pending seat fee to this (their first) hand's graph
        const sf = this.pendingSeatFees.get(p.agentId);
        if (sf) {
          this.current.payments.push(sf);
          this.pendingSeatFees.delete(p.agentId);
        }
      }

      this.ctx.hub.broadcast(this.cfg.id, { type: 'hand-start', handId, number });
      this.broadcastState();
      this.armTurnTimer();
    } finally {
      this.starting = false;
    }
  }

  private async chargeHandFee(p: Participant, number: number, handId: string): Promise<void> {
    if (!p.sessionId) return;
    try {
      const receipt = this.ctx.mpp.debitSession({ channelId: p.sessionId, amount: this.cfg.perHandFee });
      const seat = this.seats[p.seatIndex]!;
      this.current!.payments.push(
        this.toGraphPayment(receipt, 'hand-fee', this.agentParty(seat), this.tableParty(), `dealt into hand #${number}`),
      );
      await this.ctx.recordPayment({
        receipt,
        kind: 'hand-fee',
        from: this.agentParty(seat),
        to: this.tableParty(),
        tableId: this.cfg.id,
        handId,
        unlocks: `dealt into hand #${number}`,
      });
    } catch (err) {
      this.ctx.hub.broadcast(this.cfg.id, {
        type: 'log',
        level: 'warn',
        message: `hand fee skipped for ${p.name}: ${(err as Error).message}`,
      });
    }
  }

  // ---- Actions ----

  async submitAction(
    agentId: string,
    action: { type: ActionInput['type']; amount?: number },
    opts?: { prepaidReceipt?: MppReceipt },
  ): Promise<{ ok: true }> {
    const hand = this.current;
    if (!hand) throw Object.assign(new Error('no hand in progress'), { statusCode: 409 });
    const participant = hand.participants.find((p) => p.agentId === agentId);
    if (!participant) throw Object.assign(new Error('you are not in this hand'), { statusCode: 403 });
    if (hand.state.toAct !== participant.position) {
      throw Object.assign(new Error('it is not your turn'), { statusCode: 409 });
    }

    const input: ActionInput = { seat: participant.position, type: action.type, amount: action.amount };
    const legal = legalActions(hand.state);
    if (!legal.types.includes(action.type)) {
      throw Object.assign(new Error(`illegal action: ${action.type}`), { statusCode: 400 });
    }

    this.clearTurnTimer();

    // Charge the action fee (session voucher, or a pre-paid 402 charge passed in).
    const seat = this.seats[participant.seatIndex]!;
    let feeReceipt: MppReceipt | undefined = opts?.prepaidReceipt;
    if (!feeReceipt && participant.sessionId) {
      try {
        feeReceipt = this.ctx.mpp.debitSession({ channelId: participant.sessionId, amount: this.cfg.perActionFee });
      } catch (err) {
        this.ctx.hub.broadcast(this.cfg.id, {
          type: 'log',
          level: 'warn',
          message: `action fee skipped for ${seat.name}: ${(err as Error).message}`,
        });
      }
    }

    const label = action.amount ? `${action.type} ${action.amount}` : action.type;
    if (feeReceipt) {
      hand.payments.push(
        this.toGraphPayment(
          feeReceipt,
          'action-fee',
          this.agentParty(seat),
          this.tableParty(),
          `${label} on the ${hand.state.street}`,
        ),
      );
      await this.ctx.recordPayment({
        receipt: feeReceipt,
        kind: 'action-fee',
        from: this.agentParty(seat),
        to: this.tableParty(),
        tableId: this.cfg.id,
        handId: hand.id,
        unlocks: `${label} on the ${hand.state.street}`,
      });
    }

    const street = hand.state.street;
    const newState = applyAction(hand.state, input);
    hand.state = newState;

    await db.insert(actionsTable).values({
      id: newId('act'),
      handId: hand.id,
      tableId: this.cfg.id,
      seatIndex: participant.seatIndex,
      position: participant.position,
      agentId,
      type: action.type,
      amount: action.amount ?? 0,
      street,
      seq: newState.actions.length,
      paymentId: feeReceipt?.challengeId ?? null,
      createdAt: nowIso(),
    });

    this.ctx.hub.broadcast(this.cfg.id, {
      type: 'action',
      handId: hand.id,
      seat: participant.seatIndex,
      agentLabel: seat.name,
      action: action.type,
      amount: action.amount ?? 0,
      street,
    });

    if (newState.street === 'complete') {
      await this.finishHand();
    } else {
      this.broadcastState();
      this.armTurnTimer();
    }
    return { ok: true };
  }

  private async finishHand(): Promise<void> {
    const hand = this.current;
    if (!hand || !hand.state.result) return;
    this.clearTurnTimer();
    const state = hand.state;
    const result = state.result!;

    // Reveal the showdown and let it linger so it's readable in real time.
    this.broadcastState();
    await this.sleep(this.ctx.config.showdownDelayMs);
    // A player may have left during the showdown pause — if so, abandonHand already
    // tore this hand down; don't double-finish it.
    if (this.current !== hand) return;

    const history = buildHandHistory(hand.config, state);

    // 3. Table buys referee validation (service fee, table -> referee).
    let refereeValid: boolean | null = null;
    try {
      const ref = await this.buyService<{ valid: boolean; errors: string[] }>('/services/referee/validate', {
        handId: hand.id,
        handHistory: history,
      });
      refereeValid = ref.data.valid;
      hand.payments.push(
        this.toGraphPayment(
          ref.receipt,
          'service-fee',
          this.tableParty(),
          this.serviceParty(SERVICE_IDS.referee, 'Referee service'),
          `hand #${hand.number} validation (${ref.data.valid ? 'valid' : 'INVALID'})`,
        ),
      );
      await this.ctx.recordPayment({
        receipt: ref.receipt,
        kind: 'service-fee',
        from: this.tableParty(),
        to: this.serviceParty(SERVICE_IDS.referee, 'Referee service'),
        tableId: this.cfg.id,
        handId: hand.id,
        service: 'referee',
        unlocks: `hand #${hand.number} validation`,
      });
    } catch (err) {
      this.ctx.hub.broadcast(this.cfg.id, { type: 'log', level: 'warn', message: `referee failed: ${err}` });
    }

    // 4. Table buys commentary (service fee, table -> commentary).
    let commentary: { summary: string; bestMove: string; source: string } | null = null;
    try {
      const winners = result.winningSeats.map((pos) => {
        const part = hand.participants.find((p) => p.position === pos);
        const showdown = result.showdown.find((s) => s.seat === pos);
        return {
          label: part?.name ?? `Seat ${pos}`,
          amount: result.payouts[pos] ?? 0,
          handName: showdown?.hand?.name,
        };
      });
      const com = await this.buyService<{ summary: string; bestMove: string; source: string }>(
        '/services/commentary/commentary',
        {
          handId: hand.id,
          number: hand.number,
          board: cardsToStrings(state.board),
          potChips: state.pot,
          street: 'showdown',
          winners,
          playerCount: hand.participants.length,
          biggestAction: this.biggestAction(state),
        },
      );
      commentary = com.data;
      hand.payments.push(
        this.toGraphPayment(
          com.receipt,
          'service-fee',
          this.tableParty(),
          this.serviceParty(SERVICE_IDS.commentary, 'Commentary desk'),
          `hand #${hand.number} recap`,
        ),
      );
      await this.ctx.recordPayment({
        receipt: com.receipt,
        kind: 'service-fee',
        from: this.tableParty(),
        to: this.serviceParty(SERVICE_IDS.commentary, 'Commentary desk'),
        tableId: this.cfg.id,
        handId: hand.id,
        service: 'commentary',
        unlocks: `hand #${hand.number} recap`,
      });
    } catch (err) {
      this.ctx.hub.broadcast(this.cfg.id, { type: 'log', level: 'warn', message: `commentary failed: ${err}` });
    }

    // Guard again: a leave during the referee/commentary purchases would have abandoned this hand.
    if (this.current !== hand) return;

    // 5. Build + persist the receipt graph.
    const graph = createReceiptGraph(hand.id, hand.payments);
    const verification = verifyGraph(hand.payments);
    await db.insert(receiptGraphs).values({
      id: newId('graph'),
      handId: hand.id,
      tableId: this.cfg.id,
      nodes: graph.nodes,
      edges: graph.edges,
      summary: graph.summary,
      verified: verification.ok,
      createdAt: nowIso(),
    });

    const winnersOut = result.winningSeats.map((pos) => {
      const part = hand.participants.find((p) => p.position === pos);
      return { seat: part?.seatIndex ?? pos, label: part?.name ?? `Seat ${pos}`, amount: result.payouts[pos] ?? 0 };
    });

    // Settle this hand's profit/loss into each player's persistent bankroll + log it.
    const results: Array<{ seat: number; label: string; delta: number; bankrollAfter: number }> = [];
    const pnlAt = nowIso();
    for (const p of hand.participants) {
      const finalStack = state.seats[p.position]!.stack;
      const delta = finalStack - p.buyIn; // buy-in was deducted from the bankroll at hand start
      const seat = this.seats[p.seatIndex];
      let bankrollAfter = finalStack;
      if (seat && seat.agentId === p.agentId) {
        seat.bankroll += finalStack;
        seat.stack = seat.bankroll; // between hands the seat shows its bankroll
        bankrollAfter = seat.bankroll;
        await db.update(agentsTable).set({ bankroll: seat.bankroll }).where(eq(agentsTable.id, p.agentId));
      }
      results.push({ seat: p.seatIndex, label: p.name, delta, bankrollAfter });
      await db.insert(bankrollLog).values({
        id: newId('pnl'),
        handId: hand.id,
        tableId: this.cfg.id,
        handNumber: hand.number,
        agentId: p.agentId,
        agentName: p.name,
        buyIn: p.buyIn,
        finalStack,
        delta,
        bankrollAfter,
        result: delta > 0 ? 'won' : delta < 0 ? 'lost' : 'even',
        createdAt: pnlAt,
      });
    }

    await db
      .update(hands)
      .set({
        status: 'complete',
        board: cardsToStrings(state.board),
        history,
        winners: winnersOut,
        commentary,
        refereeValid,
        endedAt: nowIso(),
      })
      .where(eq(hands.id, hand.id));

    await db
      .update(tables)
      .set({ handsPlayed: sql`${tables.handsPlayed} + 1` })
      .where(eq(tables.id, this.cfg.id));

    await this.ctx.snapshotBalances();

    this.handsCompleted += 1;
    this.ctx.hub.broadcast(this.cfg.id, {
      type: 'hand-complete',
      handId: hand.id,
      winners: winnersOut,
      board: cardsToStrings(state.board),
      results,
    });
    this.broadcastState();
    this.ctx.hub.broadcast(this.cfg.id, { type: 'graph', handId: hand.id });
    if (commentary) {
      this.ctx.hub.broadcast(this.cfg.id, {
        type: 'log',
        level: 'info',
        message: `📣 ${commentary.summary}`,
      });
    }

    this.current = null;
    this.maybeStartHand();
  }

  private biggestAction(state: GameState): { label: string; type: string; amount: number } | null {
    let best: { label: string; type: string; amount: number } | null = null;
    for (const a of state.actions) {
      if ((a.type === 'bet' || a.type === 'raise' || a.type === 'all-in') && (!best || a.amount > best.amount)) {
        const part = this.current?.participants.find((p) => p.position === a.seat);
        best = { label: part?.name ?? `Seat ${a.seat}`, type: a.type, amount: a.amount };
      }
    }
    return best;
  }

  // ---- Service purchases (table-as-client) ----

  private async buyService<T>(
    path: string,
    body: unknown,
  ): Promise<{ data: T; receipt: MppReceipt }> {
    const url = `${this.ctx.config.publicBaseUrl}${path}`;
    const { data, receipt, status } = await this.client.fetchJson<T>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (status !== 200 || !receipt) {
      throw new Error(`service ${path} returned ${status} without a receipt`);
    }
    return { data, receipt };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---- Turn timers (safety net so a silent agent can't stall the table) ----

  private armTurnTimer(): void {
    this.clearTurnTimer();
    const hand = this.current;
    if (!hand || hand.state.toAct == null) return;
    const participant = hand.participants.find((p) => p.position === hand.state.toAct);
    const timeout = participant?.human
      ? this.ctx.config.humanTurnTimeoutMs
      : this.ctx.config.turnTimeoutMs;
    this.turnTimer = setTimeout(() => {
      void this.autoActCurrent();
    }, timeout);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private async autoActCurrent(): Promise<void> {
    const hand = this.current;
    if (!hand || hand.state.toAct == null) return;
    const participant = hand.participants.find((p) => p.position === hand.state.toAct);
    if (!participant) return;
    const legal = legalActions(hand.state);
    const type = legal.types.includes('check') ? 'check' : 'fold';
    try {
      await this.submitAction(participant.agentId, { type });
      this.ctx.hub.broadcast(this.cfg.id, {
        type: 'log',
        level: 'warn',
        message: participant.human
          ? `${participant.name} idled out — auto ${type} (table keeps moving)`
          : `${participant.name} timed out — auto ${type}`,
      });
    } catch {
      /* ignore */
    }
  }

  // ---- DTOs / snapshots ----

  tableDTO(): TableDTO {
    return {
      id: this.cfg.id,
      name: this.cfg.name,
      maxSeats: this.cfg.maxSeats,
      seatedCount: this.seatedCount(),
      startingChips: this.cfg.startingChips,
      smallBlind: this.cfg.smallBlind,
      bigBlind: this.cfg.bigBlind,
      seatFee: this.cfg.seatFee,
      perHandFee: this.cfg.perHandFee,
      perActionFee: this.cfg.perActionFee,
      currency: this.cfg.currency,
      status: 'open',
      handsPlayed: this.handsCompleted,
    };
  }

  snapshot(): HandStateDTO | null {
    const hand = this.current;
    if (!hand) return null;
    const state = hand.state;
    const complete = state.street === 'complete';
    const seatDtos: SeatDTO[] = hand.participants.map((p) => {
      const enginSeat = state.seats[p.position]!;
      const showdown = state.result?.showdown.find((s) => s.seat === p.position);
      const reveal = complete && showdown && !showdown.folded;
      return {
        index: p.seatIndex,
        agentId: p.agentId,
        agentName: p.name,
        archetype: p.archetype,
        stack: enginSeat.stack,
        bankroll: this.seats[p.seatIndex]?.bankroll ?? 0,
        committed: enginSeat.committedRound,
        holeCards: reveal ? cardsToStrings(enginSeat.holeCards) : null,
        status: enginSeat.status,
        isButton: hand.config.button === p.position,
        isTurn: state.toAct === p.position,
      };
    });
    const toActParticipant =
      state.toAct == null ? null : hand.participants.find((p) => p.position === state.toAct);
    return {
      handId: hand.id,
      number: hand.number,
      street: state.street,
      board: cardsToStrings(state.board),
      pot: state.pot,
      currentBet: state.currentBet,
      toActSeat: toActParticipant?.seatIndex ?? null,
      seats: seatDtos,
      buttonSeat: hand.participants.find((p) => p.position === hand.config.button)?.seatIndex ?? 0,
      smallBlind: this.cfg.smallBlind,
      bigBlind: this.cfg.bigBlind,
    };
  }

  seatsOverview(): SeatDTO[] {
    return this.seats.map((seat, index) => ({
      index,
      agentId: seat?.agentId ?? null,
      agentName: seat?.name ?? null,
      archetype: seat?.archetype ?? null,
      stack: seat?.bankroll ?? 0,
      bankroll: seat?.bankroll ?? 0,
      committed: 0,
      holeCards: null,
      status: seat ? 'seated' : 'empty',
      isButton: false,
      isTurn: this.current?.participants.find((p) => p.position === this.current?.state.toAct)?.seatIndex === index,
    }));
  }

  private broadcastState(): void {
    const snap = this.snapshot();
    if (snap) this.ctx.hub.broadcast(this.cfg.id, { type: 'state', state: snap });
  }

  /** The legal-action helper an agent needs to decide its move. */
  legalForAgent(agentId: string): { isTurn: boolean; legal: ReturnType<typeof legalActions> } | null {
    const hand = this.current;
    if (!hand) return null;
    const participant = hand.participants.find((p) => p.agentId === agentId);
    if (!participant) return null;
    return { isTurn: hand.state.toAct === participant.position, legal: legalActions(hand.state) };
  }

  /** An agent's PRIVATE view of the hand (its own hole cards + legal actions). */
  agentView(agentId: string): {
    isInHand: boolean;
    isTurn: boolean;
    handId: string | null;
    number: number;
    holeCards: string[];
    board: string[];
    street: string;
    pot: number;
    currentBet: number;
    toCall: number;
    stack: number;
    bankroll: number;
    legal: { types: string[]; callAmount: number; minRaiseTo: number; maxRaiseTo: number };
  } | null {
    const hand = this.current;
    if (!hand) return null;
    const participant = hand.participants.find((p) => p.agentId === agentId);
    if (!participant) return { isInHand: false } as never;
    const seat = hand.state.seats[participant.position]!;
    const isTurn = hand.state.toAct === participant.position;
    const legal = legalActions(hand.state);
    return {
      isInHand: true,
      isTurn,
      handId: hand.id,
      number: hand.number,
      holeCards: cardsToStrings(seat.holeCards),
      board: cardsToStrings(hand.state.board),
      street: hand.state.street,
      pot: hand.state.pot,
      currentBet: hand.state.currentBet,
      toCall: Math.max(0, hand.state.currentBet - seat.committedRound),
      stack: seat.stack,
      bankroll: this.seats[participant.seatIndex]?.bankroll ?? 0,
      legal: {
        types: isTurn ? legal.types : [],
        callAmount: legal.callAmount,
        minRaiseTo: legal.minRaiseTo,
        maxRaiseTo: legal.maxRaiseTo,
      },
    };
  }

  currentHandId(): string | null {
    return this.current?.id ?? null;
  }
}
