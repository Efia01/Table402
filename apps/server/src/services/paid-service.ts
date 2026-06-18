import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requirePayment } from '@table402/mpp';
import { newId, nowIso } from '@table402/shared';
import { db } from '../db/client';
import { serviceCalls } from '../db/schema';
import type { AppContext } from '../core/context';

export interface PaidServiceOptions<TBody, TResult> {
  path: string;
  service: string;
  providerId: string;
  walletId: string;
  fee: number;
  description: string;
  handle: (body: TBody, req: FastifyRequest) => Promise<{ result: TResult; handId?: string | null }>;
}

/**
 * Register a 402-gated paid endpoint: requirePayment enforces the charge, then the
 * handler runs, the call is logged, and the result echoes back the MPP receipt.
 */
export function registerPaidService<TBody, TResult extends object>(
  app: FastifyInstance,
  ctx: AppContext,
  opts: PaidServiceOptions<TBody, TResult>,
): void {
  const wallet = ctx.wallets.getById(opts.walletId);
  if (!wallet) throw new Error(`Paid service wallet not registered: ${opts.walletId}`);

  app.post(
    opts.path,
    {
      preHandler: requirePayment(ctx.mpp, {
        amount: opts.fee,
        recipient: wallet.address,
        kind: 'service-fee',
        description: opts.description,
      }),
    },
    async (req) => {
      const body = (req.body ?? {}) as TBody;
      const { result, handId } = await opts.handle(body, req);
      await db.insert(serviceCalls).values({
        id: newId('svc'),
        handId: handId ?? null,
        service: opts.service,
        providerId: opts.providerId,
        request: body,
        response: result,
        paymentId: null,
        receiptId: req.mppReceipt?.challengeId ?? null,
        createdAt: nowIso(),
      });
      return { ...result, providerId: opts.providerId, receipt: req.mppReceipt };
    },
  );
}
