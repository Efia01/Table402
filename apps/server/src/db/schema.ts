import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  archetype: text('archetype').notNull(),
  did: text('did').notNull(),
  address: text('address').notNull(),
  createdAt: text('created_at').notNull(),
});

export const tables = sqliteTable('tables', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  maxSeats: integer('max_seats').notNull(),
  startingChips: integer('starting_chips').notNull(),
  smallBlind: integer('small_blind').notNull(),
  bigBlind: integer('big_blind').notNull(),
  seatFee: integer('seat_fee').notNull(),
  perHandFee: integer('per_hand_fee').notNull(),
  perActionFee: integer('per_action_fee').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('open'),
  handsPlayed: integer('hands_played').notNull().default(0),
  walletAddress: text('wallet_address').notNull(),
  createdAt: text('created_at').notNull(),
});

export const hands = sqliteTable('hands', {
  id: text('id').primaryKey(),
  tableId: text('table_id').notNull(),
  number: integer('number').notNull(),
  seed: text('seed').notNull(),
  button: integer('button').notNull(),
  smallBlind: integer('small_blind').notNull(),
  bigBlind: integer('big_blind').notNull(),
  board: text('board', { mode: 'json' }).$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('in-progress'),
  seedReceiptId: text('seed_receipt_id'),
  refereeReceiptId: text('referee_receipt_id'),
  commentaryReceiptId: text('commentary_receipt_id'),
  refereeValid: integer('referee_valid', { mode: 'boolean' }),
  history: text('history', { mode: 'json' }).$type<unknown>(),
  winners: text('winners', { mode: 'json' }).$type<unknown>(),
  commentary: text('commentary', { mode: 'json' }).$type<unknown>(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
});

export const actions = sqliteTable('actions', {
  id: text('id').primaryKey(),
  handId: text('hand_id').notNull(),
  tableId: text('table_id').notNull(),
  seatIndex: integer('seat_index').notNull(),
  position: integer('position').notNull(),
  agentId: text('agent_id').notNull(),
  type: text('type').notNull(),
  amount: integer('amount').notNull().default(0),
  street: text('street').notNull(),
  seq: integer('seq').notNull(),
  paymentId: text('payment_id'),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  tableId: text('table_id').notNull(),
  currency: text('currency').notNull(),
  deposit: integer('deposit').notNull(),
  maxDeposit: integer('max_deposit').notNull(),
  spent: integer('spent').notNull().default(0),
  units: integer('units').notNull().default(0),
  status: text('status').notNull().default('open'),
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at'),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull(),
  idempotencyKey: text('idempotency_key'),
  kind: text('kind'),
  intent: text('intent').notNull(),
  fromId: text('from_id').notNull(),
  fromAddress: text('from_address').notNull(),
  fromLabel: text('from_label').notNull(),
  toId: text('to_id').notNull(),
  toAddress: text('to_address').notNull(),
  toLabel: text('to_label').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  reference: text('reference').notNull(),
  txHash: text('tx_hash'),
  status: text('status').notNull(),
  handId: text('hand_id'),
  service: text('service'),
  unlocks: text('unlocks'),
  createdAt: text('created_at').notNull(),
});

export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull(),
  challengeId: text('challenge_id').notNull(),
  method: text('method').notNull(),
  intent: text('intent').notNull(),
  reference: text('reference').notNull(),
  settlementAmount: integer('settlement_amount').notNull(),
  settlementCurrency: text('settlement_currency').notNull(),
  status: text('status').notNull(),
  receiptHash: text('receipt_hash').notNull(),
  idempotencyKey: text('idempotency_key'),
  source: text('source').notNull(),
  recipient: text('recipient').notNull(),
  channelId: text('channel_id'),
  raw: text('raw', { mode: 'json' }).$type<unknown>().notNull(),
  createdAt: text('created_at').notNull(),
});

export const serviceCalls = sqliteTable('service_calls', {
  id: text('id').primaryKey(),
  handId: text('hand_id'),
  service: text('service').notNull(),
  providerId: text('provider_id').notNull(),
  request: text('request', { mode: 'json' }).$type<unknown>(),
  response: text('response', { mode: 'json' }).$type<unknown>(),
  paymentId: text('payment_id'),
  receiptId: text('receipt_id'),
  createdAt: text('created_at').notNull(),
});

export const receiptGraphs = sqliteTable('receipt_graphs', {
  id: text('id').primaryKey(),
  handId: text('hand_id').notNull(),
  tableId: text('table_id').notNull(),
  nodes: text('nodes', { mode: 'json' }).$type<unknown>().notNull(),
  edges: text('edges', { mode: 'json' }).$type<unknown>().notNull(),
  summary: text('summary', { mode: 'json' }).$type<unknown>().notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const balances = sqliteTable('balances', {
  id: text('id').primaryKey(),
  address: text('address').notNull(),
  label: text('label'),
  ownerType: text('owner_type'),
  currency: text('currency').notNull(),
  amount: integer('amount').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

export type AgentRow = typeof agents.$inferSelect;
export type TableRow = typeof tables.$inferSelect;
export type HandRow = typeof hands.$inferSelect;
export type ActionRow = typeof actions.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type ReceiptRow = typeof receipts.$inferSelect;
export type ServiceCallRow = typeof serviceCalls.$inferSelect;
export type ReceiptGraphRow = typeof receiptGraphs.$inferSelect;
export type BalanceRow = typeof balances.$inferSelect;
