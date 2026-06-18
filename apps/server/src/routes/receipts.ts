import type { FastifyInstance } from 'fastify';
import { and, desc, eq, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { payments } from '../db/schema';
import type { AppContext } from '../core/context';

/** Receipt explorer with filters: ?agent= &service= &hand= &status= &kind= &limit= */
export function registerReceiptRoutes(app: FastifyInstance, ctx: AppContext): void {
  void ctx;

  app.get('/receipts', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const filters: SQL[] = [];
    if (q.agent) filters.push(or(eq(payments.fromId, q.agent), eq(payments.toId, q.agent))!);
    if (q.service) filters.push(or(eq(payments.service, q.service), eq(payments.toId, q.service))!);
    if (q.hand) filters.push(eq(payments.handId, q.hand));
    if (q.status) filters.push(eq(payments.status, q.status));
    if (q.kind) filters.push(eq(payments.kind, q.kind));

    const limit = Math.min(Number(q.limit ?? 200) || 200, 500);
    const where = filters.length ? and(...filters) : undefined;
    const rows = await db
      .select()
      .from(payments)
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return {
      count: rows.length,
      receipts: rows.map((p) => ({
        id: p.id,
        challengeId: p.challengeId,
        kind: p.kind,
        intent: p.intent,
        fromId: p.fromId,
        fromLabel: p.fromLabel,
        toId: p.toId,
        toLabel: p.toLabel,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        reference: p.reference,
        txHash: p.txHash,
        handId: p.handId,
        service: p.service,
        unlocks: p.unlocks,
        timestamp: p.createdAt,
      })),
    };
  });
}
