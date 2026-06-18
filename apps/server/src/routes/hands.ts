import type { FastifyInstance } from 'fastify';
import { asc, desc, eq } from 'drizzle-orm';
import type { GraphDTO } from '@table402/shared';
import { db } from '../db/client';
import { actions, hands, payments, receiptGraphs } from '../db/schema';
import type { AppContext } from '../core/context';

function paymentToReceiptDTO(p: typeof payments.$inferSelect) {
  return {
    id: p.id,
    challengeId: p.challengeId,
    kind: p.kind,
    fromId: p.fromId,
    fromLabel: p.fromLabel,
    toId: p.toId,
    toLabel: p.toLabel,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    receiptHash: '',
    idempotencyKey: p.idempotencyKey,
    reference: p.reference,
    handId: p.handId,
    service: p.service,
    unlocks: p.unlocks,
    timestamp: p.createdAt,
  };
}

export function registerHandRoutes(app: FastifyInstance, ctx: AppContext): void {
  void ctx;

  app.get('/hands', async () => {
    const rows = await db.select().from(hands).orderBy(desc(hands.number)).limit(50);
    return { hands: rows };
  });

  app.get('/hands/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const hand = await db.select().from(hands).where(eq(hands.id, id)).get();
    if (!hand) {
      reply.code(404);
      return { error: 'hand not found' };
    }
    const handActions = await db
      .select()
      .from(actions)
      .where(eq(actions.handId, id))
      .orderBy(asc(actions.seq));
    return { hand, actions: handActions };
  });

  app.get('/hands/:id/receipts', async (req) => {
    const { id } = req.params as { id: string };
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.handId, id))
      .orderBy(asc(payments.createdAt));
    return { receipts: rows.map(paymentToReceiptDTO) };
  });

  app.get('/hands/:id/graph', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db
      .select()
      .from(receiptGraphs)
      .where(eq(receiptGraphs.handId, id))
      .orderBy(desc(receiptGraphs.createdAt))
      .get();
    if (!row) {
      reply.code(404);
      return { error: 'graph not found' };
    }
    const graph: GraphDTO = {
      handId: row.handId,
      nodes: row.nodes as GraphDTO['nodes'],
      edges: row.edges as GraphDTO['edges'],
      summary: row.summary as GraphDTO['summary'],
      verified: row.verified,
    };
    return { graph };
  });
}
