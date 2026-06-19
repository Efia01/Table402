import { parseUsd } from './money';

/** Isomorphic env read — safe in browsers where `process` is undeclared. */
function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc && proc.env ? proc.env[key] : undefined;
}

/**
 * Network mode. By default Table402 runs against an in-process *simulated ledger*
 * (no chain, no real funds). The documented real-mode targets the Tempo *testnet*
 * only — never mainnet. Safety is structural, not a UI disclaimer.
 */
export const NETWORK = {
  mode: (readEnv('MPP_MODE') as 'simulated' | 'tempo-testnet' | undefined) ?? 'simulated',
  realm: 'table402.local',
  simulatedLabel: 'Simulated Ledger',
  testnetLabel: 'Tempo Testnet',
} as const;

/** Seed table — "Neon Six Max". Fees are in atomic simUSD units. */
export const DEFAULT_TABLE = {
  id: 'neon-six-max-402',
  name: 'Neon Six Max',
  maxSeats: 6,
  startingChips: 1000,
  smallBlind: 5,
  bigBlind: 10,
  seatFee: parseUsd('0.01'), // 10,000
  perHandFee: parseUsd('0.002'), // 2,000
  perActionFee: parseUsd('0.0002'), // 200
} as const;

/**
 * The maison's rooms. The first is the canonical seed table; the others give the
 * lobby a real choice. Fees match across rooms so any house bot can afford a seat;
 * the rooms differ by stakes & buy-in so they feel distinct.
 */
export const TABLES = [
  DEFAULT_TABLE,
  {
    id: 'velvet-room-402',
    name: 'Velvet Room',
    maxSeats: 6,
    startingChips: 1500,
    smallBlind: 10,
    bigBlind: 20,
    seatFee: parseUsd('0.01'),
    perHandFee: parseUsd('0.002'),
    perActionFee: parseUsd('0.0002'),
  },
  {
    id: 'noir-highroller-402',
    name: 'Noir High Roller',
    maxSeats: 6,
    startingChips: 3000,
    smallBlind: 25,
    bigBlind: 50,
    seatFee: parseUsd('0.01'),
    perHandFee: parseUsd('0.002'),
    perActionFee: parseUsd('0.0002'),
  },
] as const;

/** Per-call fees the *table* pays to the composable paid services. */
export const SERVICE_FEES = {
  rng: parseUsd('0.0005'),
  referee: parseUsd('0.0008'),
  commentary: parseUsd('0.0003'),
} as const;

/**
 * Fixed think window for a *human's own* agent: the agent waits this long before
 * acting on the human's behalf, leaving a predictable window to step in manually.
 * Shared so the table UI can render an accurate auto-play countdown.
 */
export const USER_AGENT_THINK_MS = 9000;

/** Each agent's simulated wallet is funded with this much simUSD to pay fees. */
export const AGENT_FAUCET = parseUsd('5.00');

/** The table's own wallet faucet (so it can pre-pay services before fees arrive). */
export const TABLE_FAUCET = parseUsd('10.00');

/** Identifiers used for the service-provider wallets / receipt-graph nodes. */
export const SERVICE_IDS = {
  rng: 'svc-rng-entropy',
  referee: 'svc-referee-validator',
  commentary: 'svc-commentary-desk',
} as const;

export const SEEDED_AGENTS = [
  { id: 'agent-ada', name: 'Ada Tight', archetype: 'tight' },
  { id: 'agent-bruno', name: 'Bruno Aggro', archetype: 'aggro' },
  { id: 'agent-cy', name: 'Cy Random', archetype: 'random' },
  { id: 'agent-delta', name: 'Delta Budget', archetype: 'budget' },
  { id: 'agent-echo', name: 'Echo Tight', archetype: 'tight' },
  { id: 'agent-faye', name: 'Faye Aggro', archetype: 'aggro' },
] as const;

export type Archetype = 'tight' | 'aggro' | 'random' | 'budget';
