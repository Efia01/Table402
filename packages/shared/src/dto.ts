import { z } from 'zod';

/** The four payment kinds that flow through the receipt graph. */
export const FeeKind = z.enum(['seat-fee', 'hand-fee', 'action-fee', 'service-fee']);
export type FeeKind = z.infer<typeof FeeKind>;

export const PokerActionType = z.enum([
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'all-in',
  'post-blind',
]);
export type PokerActionType = z.infer<typeof PokerActionType>;

export const Street = z.enum(['preflop', 'flop', 'turn', 'river', 'showdown', 'complete']);
export type Street = z.infer<typeof Street>;

export const TableDTO = z.object({
  id: z.string(),
  name: z.string(),
  maxSeats: z.number().int(),
  seatedCount: z.number().int(),
  startingChips: z.number().int(),
  smallBlind: z.number().int(),
  bigBlind: z.number().int(),
  seatFee: z.number().int(),
  perHandFee: z.number().int(),
  perActionFee: z.number().int(),
  currency: z.string(),
  status: z.string(),
  handsPlayed: z.number().int(),
});
export type TableDTO = z.infer<typeof TableDTO>;

export const SeatDTO = z.object({
  index: z.number().int(),
  agentId: z.string().nullable(),
  agentName: z.string().nullable(),
  archetype: z.string().nullable(),
  stack: z.number().int(),
  bankroll: z.number().int().default(0),
  committed: z.number().int(),
  holeCards: z.array(z.string()).nullable(),
  status: z.string(),
  isButton: z.boolean(),
  isTurn: z.boolean(),
});
export type SeatDTO = z.infer<typeof SeatDTO>;

export const HandStateDTO = z.object({
  handId: z.string(),
  number: z.number().int(),
  street: Street,
  board: z.array(z.string()),
  pot: z.number().int(),
  currentBet: z.number().int(),
  toActSeat: z.number().int().nullable(),
  seats: z.array(SeatDTO),
  buttonSeat: z.number().int(),
  smallBlind: z.number().int(),
  bigBlind: z.number().int(),
  /** Epoch ms when the acting player's deadline expires (null between turns). */
  turnEndsAt: z.number().int().nullable().optional(),
  /** Total length (ms) of the current turn window, for sizing the countdown ring. */
  turnMs: z.number().int().nullable().optional(),
});
export type HandStateDTO = z.infer<typeof HandStateDTO>;

export const ActionRequest = z.object({
  agentId: z.string(),
  handId: z.string().optional(),
  type: PokerActionType,
  amount: z.number().int().nonnegative().optional(),
});
export type ActionRequest = z.infer<typeof ActionRequest>;

export const JoinRequest = z.object({
  agentId: z.string().optional(),
  name: z.string().optional(),
  archetype: z.string().optional(),
  did: z.string().optional(),
  openSession: z.boolean().optional(),
  /** Optional signed MPP session authorization (validated server-side by @table402/mpp). */
  session: z.unknown().optional(),
});
export type JoinRequest = z.infer<typeof JoinRequest>;

export const ReceiptDTO = z.object({
  id: z.string(),
  challengeId: z.string(),
  kind: FeeKind.nullable(),
  fromId: z.string(),
  fromLabel: z.string(),
  toId: z.string(),
  toLabel: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  receiptHash: z.string(),
  idempotencyKey: z.string().nullable(),
  reference: z.string().nullable(),
  handId: z.string().nullable(),
  service: z.string().nullable(),
  unlocks: z.string().nullable(),
  timestamp: z.string(),
});
export type ReceiptDTO = z.infer<typeof ReceiptDTO>;

export const GraphNodeDTO = z.object({
  id: z.string(),
  type: z.enum(['agent', 'table', 'service']),
  label: z.string(),
  sublabel: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});
export type GraphNodeDTO = z.infer<typeof GraphNodeDTO>;

export const GraphEdgeDTO = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: FeeKind,
  amount: z.number().int(),
  currency: z.string(),
  provider: z.string(),
  receiptHash: z.string(),
  idempotencyKey: z.string().nullable(),
  timestamp: z.string(),
  verified: z.boolean(),
  unlocks: z.string().nullable(),
});
export type GraphEdgeDTO = z.infer<typeof GraphEdgeDTO>;

export const SpendSummaryDTO = z.object({
  totalPaid: z.number().int(),
  edgeCount: z.number().int(),
  byKind: z.record(z.number().int()),
  byNode: z.array(
    z.object({ id: z.string(), label: z.string(), paid: z.number().int(), received: z.number().int() }),
  ),
});
export type SpendSummaryDTO = z.infer<typeof SpendSummaryDTO>;

export const GraphDTO = z.object({
  handId: z.string(),
  nodes: z.array(GraphNodeDTO),
  edges: z.array(GraphEdgeDTO),
  summary: SpendSummaryDTO,
  verified: z.boolean(),
});
export type GraphDTO = z.infer<typeof GraphDTO>;

export const ServiceEntryDTO = z.object({
  id: z.string(),
  name: z.string(),
  serviceUrl: z.string(),
  description: z.string(),
  categories: z.array(z.string()),
  availability: z.enum(['available', 'degraded', 'unavailable']).default('available'),
  source: z.enum(['local', 'mpp.dev', 'cache']).default('local'),
  priceHint: z.string().nullable().optional(),
});
export type ServiceEntryDTO = z.infer<typeof ServiceEntryDTO>;

/** Server -> client live feed over the `/play` WebSocket. */
export const WsEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), tableId: z.string() }),
  z.object({ type: z.literal('state'), state: HandStateDTO }),
  z.object({
    type: z.literal('action'),
    handId: z.string(),
    seat: z.number().int(),
    agentLabel: z.string(),
    action: PokerActionType,
    amount: z.number().int(),
    street: Street,
  }),
  z.object({ type: z.literal('payment'), receipt: ReceiptDTO }),
  z.object({ type: z.literal('hand-start'), handId: z.string(), number: z.number().int() }),
  z.object({
    type: z.literal('hand-complete'),
    handId: z.string(),
    winners: z.array(z.object({ seat: z.number().int(), label: z.string(), amount: z.number().int() })),
    board: z.array(z.string()),
    results: z.array(
      z.object({
        seat: z.number().int(),
        label: z.string(),
        delta: z.number().int(),
        bankrollAfter: z.number().int(),
      }),
    ),
    /** Number of pots awarded (>1 ⇒ side pots), and whether any single pot was split (a tie). */
    potCount: z.number().int().optional(),
    split: z.boolean().optional(),
    showdown: z.boolean().optional(),
  }),
  z.object({ type: z.literal('graph'), handId: z.string() }),
  z.object({ type: z.literal('table-idle') }),
  z.object({ type: z.literal('log'), level: z.enum(['info', 'warn', 'error']), message: z.string() }),
  z.object({
    type: z.literal('retreat-complete'),
    clientId: z.string(),
    agentId: z.string(),
    mode: z.enum(['retreat', 'sit-out']),
    refunded: z.number().int(),
    currency: z.string(),
  }),
  z.object({
    type: z.literal('retreat-error'),
    clientId: z.string(),
    message: z.string(),
  }),
]);
export type WsEvent = z.infer<typeof WsEvent>;

export const WsCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('retreat'), clientId: z.string() }),
  z.object({ type: z.literal('sit-out'), clientId: z.string() }),
]);
export type WsCommand = z.infer<typeof WsCommand>;
