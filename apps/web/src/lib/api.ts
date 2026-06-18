import type {
  GraphDTO,
  HandStateDTO,
  ReceiptDTO,
  SeatDTO,
  ServiceEntryDTO,
  TableDTO,
} from '@table402/shared';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

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
  return (await res.json()) as T;
}

export interface MineStatus {
  agentId: string;
  name: string;
  archetype: string;
  seatIndex: number | null;
}
export interface AgentControlStatus {
  mine: MineStatus | null;
  userCount: number;
  botCount: number;
  seated: number;
}

export interface AgentRow {
  id: string;
  name: string;
  archetype: string;
  did: string;
  address: string;
  balance: number;
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
  startAgent: (clientId: string, archetype: string) =>
    post<{ ok: boolean; mine?: MineStatus; error?: string }>('/agents/start', { clientId, archetype }),
  stopAgent: (clientId: string) =>
    post<{ ok: boolean; stopped?: boolean }>('/agents/stop', { clientId }),
};
