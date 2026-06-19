import type {
  GraphDTO,
  HandStateDTO,
  ReceiptDTO,
  SeatDTO,
  ServiceEntryDTO,
  TableDTO,
} from '@table402/shared';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export const API_BASE = API;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  // Non-2xx without a structured {ok} body -> normalize to an error result.
  if (!res.ok && (data == null || typeof (data as { ok?: unknown }).ok === 'undefined')) {
    return { ok: false, error: `HTTP ${res.status}` } as T;
  }
  return (data ?? {}) as T;
}

export interface MineStatus {
  agentId: string;
  name: string;
  archetype: string;
  seatIndex: number | null;
  autopilot: boolean;
}
export interface AgentControlStatus {
  mine: MineStatus | null;
  userCount: number;
  botCount: number;
  seated: number;
  /** Persistent bank account for this browser's player (default if never played). */
  bankroll: number;
  /** Stable agent id for this browser — usable to list this session's hands. */
  agentId: string;
}

export interface AgentViewDTO {
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
}

export interface PnlEntry {
  handId: string;
  handNumber: number;
  buyIn: number;
  finalStack: number;
  delta: number;
  bankrollAfter: number;
  result: string;
  timestamp: string;
}
export interface PnlResponse {
  agentId: string;
  name: string;
  bankroll: number;
  cumulative: number;
  handsPlayed: number;
  log: PnlEntry[];
}
export interface HandResult {
  agentId: string;
  name: string;
  buyIn: number;
  finalStack: number;
  delta: number;
  bankrollAfter: number;
  result: string;
}

export interface AgentRow {
  id: string;
  name: string;
  archetype: string;
  did: string;
  address: string;
  balance: number;
  bankroll: number;
  seated: boolean;
}

export interface BalanceRow {
  address: string;
  label: string | null;
  type: string | null;
  amount: number;
  currency: string;
}

export interface ReceiptRow {
  id: string;
  challengeId: string;
  kind: string | null;
  intent: string;
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  txHash: string | null;
  handId: string | null;
  service: string | null;
  unlocks: string | null;
  timestamp: string;
}

export interface HandRow {
  id: string;
  tableId: string;
  number: number;
  seed: string;
  button: number;
  board: string[];
  status: string;
  refereeValid: boolean | null;
  winners: Array<{ seat: number; label: string; amount: number }> | null;
  commentary: { summary: string; bestMove: string; source: string } | null;
  history: unknown;
  startedAt: string;
  endedAt: string | null;
}

export interface ActionRow {
  id: string;
  handId: string;
  seatIndex: number;
  agentId: string;
  type: string;
  amount: number;
  street: string;
  seq: number;
}

export interface TableDetail {
  table: TableDTO;
  seats: SeatDTO[];
  hand: HandStateDTO | null;
  walletAddress: string;
  balance: number;
}

export const api = {
  tables: () => get<{ tables: TableDTO[] }>('/tables'),
  table: (id: string) => get<TableDetail>(`/tables/${id}`),
  agents: () => get<{ agents: AgentRow[] }>('/agents'),
  balances: () => get<{ balances: BalanceRow[]; currency: string }>('/balances'),
  discovery: () => get<{ services: ServiceEntryDTO[]; remote: string }>('/discovery/services'),
  receipts: (qs = '') => get<{ count: number; receipts: ReceiptRow[] }>(`/receipts${qs}`),
  hands: () => get<{ hands: HandRow[] }>('/hands'),
  hand: (id: string) => get<{ hand: HandRow; actions: ActionRow[] }>(`/hands/${id}`),
  handReceipts: (id: string) => get<{ receipts: ReceiptDTO[] }>(`/hands/${id}/receipts`),
  graph: (id: string) => get<{ graph: GraphDTO }>(`/hands/${id}/graph`),
  agentStatus: (clientId: string) =>
    get<AgentControlStatus>(`/agents/status?clientId=${encodeURIComponent(clientId)}`),
  startAgent: (clientId: string, opts: { name?: string; archetype?: string; buyIn?: number }) =>
    post<{ ok: boolean; mine?: MineStatus; error?: string }>('/agents/start', { clientId, ...opts }),
  stopAgent: (clientId: string) =>
    post<{ ok: boolean; stopped?: boolean }>('/agents/stop', { clientId }),
  setAutopilot: (clientId: string, on: boolean) =>
    post<{ ok: boolean; mine?: MineStatus }>('/agents/autopilot', { clientId, on }),
  agentView: (tableId: string, agentId: string) =>
    get<{ view: AgentViewDTO | null }>(
      `/tables/${tableId}/view?agentId=${encodeURIComponent(agentId)}`,
    ),
  submitAction: (tableId: string, agentId: string, type: string, amount?: number) =>
    post<{ ok: boolean; error?: string; paidVia?: string }>(`/tables/${tableId}/action`, {
      agentId,
      type,
      amount,
    }),
  pnl: (agentId: string) => get<PnlResponse>(`/pnl?agentId=${encodeURIComponent(agentId)}`),
  handResults: (handId: string) => get<{ results: HandResult[] }>(`/hands/${handId}/results`),
};
