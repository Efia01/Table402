import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { SERVICE_FEES, SERVICE_IDS } from '@table402/shared';
import type { AppContext } from '../core/context';
import { registerPaidService } from './paid-service';

interface SeedBody {
  handId?: string;
  tableId?: string;
}

/**
 * RNG service. The table buys one cryptographically-random seed per hand, which
 * deterministically derives the shuffle. POST /services/rng/seed -> 402 -> pay -> seed.
 */
export function registerRngService(app: FastifyInstance, ctx: AppContext): void {
  registerPaidService<SeedBody, { seed: string }>(app, ctx, {
    path: '/services/rng/seed',
    service: 'rng',
    providerId: SERVICE_IDS.rng,
    walletId: SERVICE_IDS.rng,
    fee: SERVICE_FEES.rng,
    description: 'One verifiable random seed for a poker shuffle',
    handle: async (body) => {
      const seed = randomBytes(32).toString('hex');
      return { result: { seed }, handId: body.handId ?? null };
    },
  });
}
