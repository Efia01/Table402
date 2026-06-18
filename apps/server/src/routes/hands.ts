import type { FastifyInstance } from 'fastify';
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { GraphDTO } from '@table402/shared';
import { db } from '../db/client';
import { agents, actions, bankrollLog, hands, payments, receiptGraphs } from '../db/schema';
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

  // A player's bankroll + cumulative P&L + per-hand log.
  app.get('/pnl', async (req, reply) => {
    const agentId = (req.query as { agentId?: string }).agentId;
    if (!agentId) {
      reply.code(400);
      return { error: 'agentId required' };
    }
    const agent = await db.select().from(agents).where(eq(agents.id, agentId)).get();
    const log = await db
      .select()
      .from(bankrollLog)
      .where(eq(bankrollLog.agentId, agentId))
      .orderBy(desc(bankrollLog.createdAt))
      .limit(200);
    const agg = await db
      .select({ total: sql<number>`coalesce(sum(${bankrollLog.delta}), 0)`, n: sql<number>`count(*)` })
      .from(bankrollLog)
      .where(eq(bankrollLog.agentId, agentId))
      .get();
    return {
      agentId,
      name: agent?.name ?? agentId,
      bankroll: agent?.bankroll ?? 0,
      cumulative: Number(agg?.total ?? 0),
      handsPlayed: Number(agg?.n ?? 0),
      log: log.map((r) => ({
        handId: r.handId,
        handNumber: r.handNumber,
        buyIn: r.buyIn,
        finalStack: r.finalStack,
        delta: r.delta,
        bankrollAfter: r.bankrollAfter,
        result: r.result,
        timestamp: r.createdAt,
      })),
    };
  });

  // Every player's profit/loss for a single hand.
  app.get('/hands/:id/results', async (req) => {
    const { id } = req.params as { id: string };
    const rows = await db
      .select()
      .from(bankrollLog)
      .where(eq(bankrollLog.handId, id))
      .orderBy(desc(bankrollLog.delta));
    return {
      results: rows.map((r) => ({
        agentId: r.agentId,
        name: r.agentName,
        buyIn: r.buyIn,
        finalStack: r.finalStack,
        delta: r.delta,
        bankrollAfter: r.bankrollAfter,
        result: r.result,
      })),
    };
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
