import { describe, expect, it } from 'vitest';
import { computeReceiptHash, type MppReceipt } from '@table402/mpp';
import { createReceiptGraph, verifyGraph, summarizeSpend, type GraphPayment } from './index';

function makeReceipt(amount: number, source: string, recipient: string): MppReceipt {
  const r: MppReceipt = {
    challengeId: `ch-${amount}-${recipient}`,
    method: 'tempo',
    intent: 'charge',
    reference: '0xref',
    settlement: { amount: String(amount), currency: 'simUSD' },
    status: 'success',
    timestamp: '2026-01-01T00:00:00.000Z',
    receiptHash: '',
    idempotencyKey: 'k',
    source,
    recipient,
  };
  r.receiptHash = computeReceiptHash(r);
  return r;
}

function payment(over: Partial<GraphPayment> & { id: string; amount: number }): GraphPayment {
  const receipt = makeReceipt(over.amount, over.fromId ?? 'a', over.toId ?? 'b');
  return {
    kind: 'service-fee',
    fromId: 'agent-ada',
    fromLabel: 'Ada Tight',
    fromType: 'agent',
    toId: 'table',
    toLabel: 'Neon Six Max',
    toType: 'table',
    currency: 'simUSD',
    provider: 'table',
    receiptHash: receipt.receiptHash,
    idempotencyKey: 'k',
    reference: '0xref',
    timestamp: '2026-01-01T00:00:00.000Z',
    unlocks: null,
    receipt,
    ...over,
  };
}

describe('receipt graph', () => {
  const payments: GraphPayment[] = [
    payment({ id: 'e1', kind: 'seat-fee', amount: 10_000, fromId: 'agent-ada', toId: 'table', unlocks: 'seat #2' }),
    payment({ id: 'e2', kind: 'action-fee', amount: 200, fromId: 'agent-ada', toId: 'table', unlocks: 'raise to 40' }),
    payment({
      id: 'e3',
      kind: 'service-fee',
      amount: 500,
      fromId: 'table',
      fromLabel: 'Neon Six Max',
      fromType: 'table',
      toId: 'svc-rng',
      toLabel: 'RNG',
      toType: 'service',
      provider: 'svc-rng',
      unlocks: 'hand #7 seed',
    }),
  ];

  it('builds nodes, edges, and a spend summary', () => {
    const graph = createReceiptGraph('hand-7', payments);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['agent-ada', 'svc-rng', 'table']);
    expect(graph.edges).toHaveLength(3);
    expect(graph.verified).toBe(true);
    expect(graph.summary.totalPaid).toBe(10_700);
    expect(graph.summary.byKind['seat-fee']).toBe(10_000);
    const tableNode = graph.summary.byNode.find((n) => n.id === 'table')!;
    expect(tableNode.received).toBe(10_200); // seat + action fee
    expect(tableNode.paid).toBe(500); // service fee out
  });

  it('verifies real hashes and flags a tampered one', () => {
    expect(verifyGraph(payments).ok).toBe(true);
    expect(verifyGraph(payments).verifiedEdges).toBe(3);

    const tampered = payments.map((p, i) => (i === 0 ? { ...p, receiptHash: 'deadbeef' } : p));
    const result = verifyGraph(tampered);
    expect(result.ok).toBe(false);
    expect(result.problems[0]?.edgeId).toBe('e1');

    const graph = createReceiptGraph('hand-7', tampered);
    expect(graph.verified).toBe(false);
    expect(graph.edges.find((e) => e.id === 'e1')?.verified).toBe(false);
  });

  it('summarizeSpend matches the embedded summary', () => {
    const graph = createReceiptGraph('hand-7', payments);
    expect(summarizeSpend(graph)).toEqual(graph.summary);
  });
});
