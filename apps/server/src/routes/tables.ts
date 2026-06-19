import type { FastifyInstance } from 'fastify';
import {
  addressToDid,
  buildWwwAuthenticate,
  decodeJson,
  didToAddress,
  encodeJson,
  MppError,
  requirePayment,
  type SessionAuthorization,
} from '@table402/mpp';
import { ActionRequest, AGENT_FAUCET, JoinRequest, SIM_USD, parseUsd } from '@table402/shared';
import { db } from '../db/client';
import { agents as agentsTable, balances } from '../db/schema';
import { shortenAddress } from '../core/wallets';
import type { AppContext } from '../core/context';

export function registerTableRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/tables', async () => {
    return { tables: [...ctx.tables.values()].map((t) => t.tableDTO()) };
  });

  app.get('/tables/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const table = ctx.tableFor(id);
    if (!table) {
      reply.code(404);
      return { error: 'unknown table' };
    }
    return {
      table: table.tableDTO(),
      seats: table.seatsOverview(),
      hand: table.snapshot(),
      walletAddress: table.walletAddress,
      balance: ctx.balanceOf(table.walletAddress),
    };
  });

  // An agent's private view (its own hole cards + legal actions on its turn).
  app.get('/tables/:id/view', async (req, reply) => {
    const agentId = (req.query as { agentId?: string }).agentId;
    if (!agentId) {
      reply.code(400);
      return { error: 'agentId query param required' };
    }
    const table = ctx.tableFor((req.params as { id: string }).id);
    if (!table) {
      reply.code(404);
      return { view: null };
    }
    const view = table.agentView(agentId);
    return { view };
  });

  // --- Join: 402 seat fee, then take a seat (+ optional session) ---
  app.post(
    '/tables/:id/join',
    {
      preHandler: requirePayment(ctx.mpp, (req) => {
        const table = ctx.tableFor((req.params as { id: string }).id) ?? ctx.table;
        return {
          amount: table.seatFee,
          recipient: table.walletAddress,
          currency: table.currency,
          kind: 'seat-fee',
          description: `Seat fee for ${table.name}`,
        };
      }),
    },
    async (req, reply) => {
      const table = ctx.tableFor((req.params as { id: string }).id);
      if (!table) {
        reply.code(404);
        return { ok: false, error: 'unknown table' };
      }
      const receipt = req.mppReceipt!;
      const did = receipt.source;
      const address = didToAddress(did);
      const body = JoinRequest.parse(req.body ?? {});
      // `buyIn` is read raw (not part of the shared JoinRequest schema, which strips unknown keys).
      const rawBuyIn = Number((req.body as { buyIn?: unknown })?.buyIn);
      const requestedBuyIn = Number.isFinite(rawBuyIn) && rawBuyIn > 0 ? Math.floor(rawBuyIn) : undefined;
      const agentId = body.agentId ?? `agent-${address.slice(2, 10).toLowerCase()}`;
      const name = body.name ?? agentId;
      const archetype = body.archetype ?? 'random';

      ctx.ensureAgentWallet({ id: agentId, label: name, address, did });

      // Upsert agent row so unknown agents persist too.
      await db
        .insert(agentsTable)
        .values({ id: agentId, name, archetype, did, address, createdAt: receipt.timestamp })
        .onConflictDoUpdate({ target: agentsTable.id, set: { name, archetype, did, address } });

      try {
        const { seatIndex, sessionId } = await table.join({
          agentId,
          name,
          archetype,
          address,
          did,
          seatReceipt: receipt,
          sessionAuth: body.session as SessionAuthorization | undefined,
          requestedBuyIn,
        });
        return { ok: true, seatIndex, sessionId, agentId, did, balance: ctx.balanceOf(address) };
      } catch (err) {
        // The seat fee was already settled in the preHandler, but the join failed
        // (e.g. the session escrow couldn't open) — refund it so funds aren't burned.
        try {
          ctx.provider.settleCharge({
            from: table.walletAddress,
            to: address,
            currency: table.currency,
            amount: Number(receipt.settlement.amount),
            reference: `seat-fee-refund:${receipt.challengeId}`,
          });
        } catch {
          /* best-effort refund */
        }
        reply.code((err as { statusCode?: number }).statusCode ?? 400);
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  // --- Action: session voucher OR per-action 402 charge ---
  app.post('/tables/:id/action', async (req, reply) => {
    const table = ctx.tableFor((req.params as { id: string }).id);
    if (!table) {
      reply.code(404);
      return { ok: false, error: 'unknown table' };
    }
    const body = ActionRequest.parse(req.body);
    const sessionId = table.hasOpenSession(body.agentId);

    if (sessionId) {
      await table.submitAction(body.agentId, { type: body.type, amount: body.amount });
      return { ok: true, paidVia: 'session' };
    }

    // No session -> require a fresh per-action 402 charge.
    const auth = req.headers['authorization'];
    if (!auth || !/^Payment\s+/i.test(auth)) {
      const challenge = ctx.mpp.createChallenge({
        intent: 'charge',
        amount: table.perActionFee,
        currency: table.currency,
        recipient: table.walletAddress,
        description: 'Per-action fee',
      });
      const problem = new MppError(
        'payment-required',
        402,
        'A per-action fee is required (or open a session at join).',
      ).toProblem(challenge);
      reply
        .code(402)
        .header('WWW-Authenticate', buildWwwAuthenticate(challenge))
        .header('Cache-Control', 'no-store')
        .type('application/problem+json')
        .send(problem);
      return reply;
    }

    let receipt;
    try {
      const credential = decodeJson(auth.replace(/^Payment\s+/i, '').trim());
      receipt = await ctx.mpp.verifyCredential(credential, {
        kind: 'action-fee',
        handId: table.currentHandId() ?? undefined,
      });
    } catch (err) {
      if (err instanceof MppError) {
        reply.code(err.status).type('application/problem+json').send(err.toProblem());
        return reply;
      }
      throw err;
    }
    await table.submitAction(
      body.agentId,
      { type: body.type, amount: body.amount },
      { prepaidReceipt: receipt },
    );
    reply.header('Payment-Receipt', encodeJson(receipt)).header('Cache-Control', 'private');
    return { ok: true, paidVia: 'charge' };
  });

  app.post('/tables/:id/leave', async (req, reply) => {
    const table = ctx.tableFor((req.params as { id: string }).id);
    if (!table) {
      reply.code(404);
      return { ok: false, error: 'unknown table' };
    }
    const body = (req.body ?? {}) as { agentId?: string };
    if (!body.agentId) return { ok: false, error: 'agentId required' };
    const result = await table.leave(body.agentId);
    return { ok: result.left, refunded: result.refunded };
  });

  // --- Agents directory (lobby) ---
  app.get('/agents', async () => {
    const rows = await db.select().from(agentsTable);
    const seated = new Set(
      [...ctx.tables.values()].flatMap((t) => t.seatsOverview().map((s) => s.agentId)).filter(Boolean),
    );
    const out = await Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        name: a.name,
        archetype: a.archetype,
        did: a.did,
        address: a.address,
        balance: ctx.balanceOf(a.address),
        bankroll: a.bankroll,
        seated: seated.has(a.id),
      })),
    );
    return { agents: out };
  });

  // Testnet faucet: fund a brand-new agent wallet so it can pay its first seat fee.
  app.post('/faucet', async (req) => {
    const { address, label } = (req.body ?? {}) as { address?: string; label?: string };
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return { ok: false, error: 'a valid 0x address is required' };
    }
    // Register the wallet so it appears in /balances even before it joins a table.
    if (!ctx.wallets.getByAddress(address)) {
      ctx.ensureAgentWallet({
        id: `agent:${address.slice(2, 12).toLowerCase()}`,
        label: label ?? shortenAddress(address),
        address,
        did: addressToDid(address),
      });
    }
    if (ctx.balanceOf(address) < parseUsd('0.10')) {
      ctx.fund(address, AGENT_FAUCET, 'faucet');
    }
    return { ok: true, balance: ctx.balanceOf(address), currency: SIM_USD.code };
  });

  app.get('/balances', async () => {
    const rows = await db.select().from(balances);
    return {
      balances: rows.map((b) => ({
        address: b.address,
        label: b.label,
        type: b.ownerType,
        amount: b.amount,
        currency: b.currency,
      })),
      currency: SIM_USD.code,
    };
  });
}
