import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../core/context';
import type { ControllerHub } from '../game/agent-controller';

/** Web-driven agent control: one autonomous player per browser (clientId). */
export function registerControlRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  controller: ControllerHub,
): void {
  void ctx;

  app.post('/agents/start', async (req, reply) => {
    const { clientId, archetype, name, buyIn, tableId } = (req.body ?? {}) as {
      clientId?: string;
      archetype?: string;
      name?: string;
      buyIn?: number;
      tableId?: string;
    };
    if (!clientId) {
      reply.code(400);
      return { ok: false, error: 'clientId is required' };
    }
    try {
      const mine = await controller.start(clientId, { archetype, name, buyIn, tableId });
      return { ok: true, mine };
    } catch (err) {
      reply.code(409);
      return { ok: false, error: (err as Error).message };
    }
  });

  app.post('/agents/autopilot', async (req, reply) => {
    const { clientId, on } = (req.body ?? {}) as { clientId?: string; on?: boolean };
    if (!clientId) {
      reply.code(400);
      return { ok: false, error: 'clientId is required' };
    }
    const mine = controller.setAutopilot(clientId, !!on);
    if (!mine) {
      reply.code(404);
      return { ok: false, error: 'no active agent for this client' };
    }
    return { ok: true, mine };
  });

  app.post('/agents/stop', async (req) => {
    const { clientId } = (req.body ?? {}) as { clientId?: string };
    if (!clientId) return { ok: false, error: 'clientId is required' };
    return { ok: true, stopped: await controller.stop(clientId) };
  });

  // Re-buy: top up the seated player's bankroll so they can keep playing.
  app.post('/agents/rebuy', async (req, reply) => {
    const { clientId, amount } = (req.body ?? {}) as { clientId?: string; amount?: number };
    if (!clientId) {
      reply.code(400);
      return { ok: false, error: 'clientId is required' };
    }
    const bankroll = await controller.rebuy(clientId, amount);
    if (bankroll == null) {
      reply.code(404);
      return { ok: false, error: 'no active agent for this client' };
    }
    return { ok: true, bankroll };
  });

  app.get('/agents/status', async (req) => {
    const clientId = (req.query as { clientId?: string }).clientId ?? '';
    return controller.status(clientId);
  });
}
