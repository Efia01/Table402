import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { SIM_USD, type FeeKind } from '@table402/shared';
import { decodeJson, encodeJson } from './encoding';
import { buildWwwAuthenticate } from './headers';
import { MppError, type MppReceipt } from './types';
import type { MppServer, PaymentMeta } from './server';

declare module 'fastify' {
  interface FastifyRequest {
    mppReceipt?: MppReceipt;
    mppPayment?: { amount: number; kind?: FeeKind; recipient: string };
  }
}

export interface RequirePaymentConfig {
  amount: number;
  currency?: string;
  recipient: string;
  description?: string;
  kind?: FeeKind;
  meta?: (req: FastifyRequest) => PaymentMeta;
}

/**
 * The universal 402 enforcer. No `Authorization: Payment` -> issue a 402 challenge.
 * Header present -> verify + settle + attach receipt, then continue. Never bypassed.
 */
export function requirePayment(
  server: MppServer,
  config: RequirePaymentConfig | ((req: FastifyRequest) => RequirePaymentConfig),
): preHandlerHookHandler {
  return async function paymentPreHandler(req: FastifyRequest, reply: FastifyReply) {
    const cfg = typeof config === 'function' ? config(req) : config;
    const currency = cfg.currency ?? SIM_USD.code;
    const authHeader = req.headers['authorization'];

    const challenge402 = (err?: MppError) => {
      const challenge = server.createChallenge({
        intent: 'charge',
        amount: cfg.amount,
        currency,
        recipient: cfg.recipient,
        description: cfg.description,
      });
      const problem = (err ?? new MppError('payment-required', 402, cfg.description ?? 'Payment required')).toProblem(
        challenge,
      );
      reply
        .code(err?.status ?? 402)
        .header('WWW-Authenticate', buildWwwAuthenticate(challenge))
        .header('Cache-Control', 'no-store')
        .type('application/problem+json')
        .send(problem);
      return reply;
    };

    if (!authHeader || !/^Payment\s+/i.test(authHeader)) {
      return challenge402();
    }

    const token = authHeader.replace(/^Payment\s+/i, '').trim();
    let credential: unknown;
    try {
      credential = decodeJson(token);
    } catch {
      const e = new MppError('malformed-credential', 400, 'Authorization payment token is not valid base64url JSON');
      reply.code(400).type('application/problem+json').send(e.toProblem());
      return reply;
    }

    try {
      const meta: PaymentMeta = cfg.meta ? cfg.meta(req) : {};
      if (cfg.kind) meta.kind = cfg.kind;
      const receipt = await server.verifyCredential(credential, meta);
      req.mppReceipt = receipt;
      req.mppPayment = { amount: cfg.amount, kind: cfg.kind, recipient: cfg.recipient };
      reply.header('Payment-Receipt', encodeJson(receipt)).header('Cache-Control', 'private');
      // fall through -> handler runs
    } catch (err) {
      if (err instanceof MppError) {
        if (err.status === 400) {
          reply.code(400).type('application/problem+json').send(err.toProblem());
          return reply;
        }
        return challenge402(err);
      }
      throw err;
    }
  };
}
