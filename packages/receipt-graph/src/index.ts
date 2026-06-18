import { computeReceiptHash, type MppReceipt } from '@table402/mpp';
import type { FeeKind, GraphDTO, GraphEdgeDTO, GraphNodeDTO, SpendSummaryDTO } from '@table402/shared';

export type GraphNodeType = GraphNodeDTO['type'];

/**
 * A single settled payment, enriched with the context needed to draw it in the
 * receipt graph (who/what/which-action-it-unlocked).
 */
export interface GraphPayment {
  id: string;
  kind: FeeKind;
  fromId: string;
  fromLabel: string;
  fromType: GraphNodeType;
  toId: string;
  toLabel: string;
  toType: GraphNodeType;
  amount: number;
  currency: string;
  provider: string;
  receiptHash: string;
  idempotencyKey: string | null;
  reference: string;
  timestamp: string;
  unlocks: string | null;
  /** Full receipt, when available, enabling hash re-verification. */
  receipt?: MppReceipt;
}

export interface GraphVerification {
  ok: boolean;
  verifiedEdges: number;
  totalEdges: number;
  problems: Array<{ edgeId: string; problem: string }>;
}

function summarize(nodes: GraphNodeDTO[], edges: GraphEdgeDTO[]): SpendSummaryDTO {
  const byKind: Record<string, number> = {};
  const paid = new Map<string, number>();
  const received = new Map<string, number>();
  let totalPaid = 0;
  for (const e of edges) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + e.amount;
    paid.set(e.from, (paid.get(e.from) ?? 0) + e.amount);
    received.set(e.to, (received.get(e.to) ?? 0) + e.amount);
    totalPaid += e.amount;
  }
  const byNode = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    paid: paid.get(n.id) ?? 0,
    received: received.get(n.id) ?? 0,
  }));
  return { totalPaid, edgeCount: edges.length, byKind, byNode };
}

/** Build the per-hand receipt graph from its settled payments. */
export function createReceiptGraph(handId: string, payments: GraphPayment[]): GraphDTO {
  const nodeMap = new Map<string, GraphNodeDTO>();
  const addNode = (id: string, type: GraphNodeType, label: string) => {
    if (!nodeMap.has(id)) nodeMap.set(id, { id, type, label });
  };

  const edges: GraphEdgeDTO[] = payments.map((p) => {
    addNode(p.fromId, p.fromType, p.fromLabel);
    addNode(p.toId, p.toType, p.toLabel);
    const verified = p.receipt ? computeReceiptHash(p.receipt) === p.receiptHash : Boolean(p.receiptHash);
    return {
      id: p.id,
      from: p.fromId,
      to: p.toId,
      kind: p.kind,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      receiptHash: p.receiptHash,
      idempotencyKey: p.idempotencyKey,
      timestamp: p.timestamp,
      verified,
      unlocks: p.unlocks,
    };
  });

  const nodes = [...nodeMap.values()];
  return {
    handId,
    nodes,
    edges,
    summary: summarize(nodes, edges),
    verified: edges.length > 0 && edges.every((e) => e.verified),
  };
}

/** Independently re-verify every payment by recomputing its receipt hash. */
export function verifyGraph(payments: GraphPayment[]): GraphVerification {
  const problems: GraphVerification['problems'] = [];
  let verified = 0;
  for (const p of payments) {
    if (!p.receipt) {
      problems.push({ edgeId: p.id, problem: 'no receipt attached for verification' });
      continue;
    }
    if (computeReceiptHash(p.receipt) !== p.receiptHash) {
      problems.push({ edgeId: p.id, problem: 'receipt hash mismatch' });
      continue;
    }
    if (String(p.amount) !== p.receipt.settlement.amount) {
      problems.push({ edgeId: p.id, problem: 'amount does not match settlement' });
      continue;
    }
    verified += 1;
  }
  return { ok: problems.length === 0, verifiedEdges: verified, totalEdges: payments.length, problems };
}

export function summarizeSpend(graph: GraphDTO): SpendSummaryDTO {
  return summarize(graph.nodes, graph.edges);
}

export function exportGraph(graph: GraphDTO): string {
  return JSON.stringify(graph, null, 2);
}

export interface PositionedNode extends GraphNodeDTO {
  position: { x: number; y: number };
}

/** A simple layered layout (agents | table | services) for React Flow. */
export function layoutGraph(graph: GraphDTO): { nodes: PositionedNode[]; edges: GraphEdgeDTO[] } {
  const columnX: Record<GraphNodeType, number> = { agent: 0, table: 380, service: 760 };
  const counters: Record<GraphNodeType, number> = { agent: 0, table: 0, service: 0 };
  const nodes = graph.nodes.map((n) => {
    const row = counters[n.type]++;
    return { ...n, position: { x: columnX[n.type], y: row * 120 + 40 } };
  });
  return { nodes, edges: graph.edges };
}
