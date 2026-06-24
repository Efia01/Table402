import type { FastifyInstance } from 'fastify';
import { DEFAULT_TABLE, SIM_USD, WsCommand } from '@table402/shared';
import type { AppContext } from '../core/context';
import type { SocketLike } from '../core/hub';
import type { AgentController } from '../game/agent-controller';

interface WsSocket extends SocketLike {
  on(event: 'close' | 'error' | 'message', cb: (...args: unknown[]) => void): void;
}

/** Live game + payment feed over `/play?table=<id>`, plus inbound retreat commands. */
export function registerPlayWebSocket(
  app: FastifyInstance,
  ctx: AppContext,
  controller: AgentController,
): void {
  app.get('/play', { websocket: true }, (connection: unknown, req) => {
    const socket = ((connection as { socket?: WsSocket }).socket ?? connection) as WsSocket;
    const tableId = ((req.query as { table?: string }).table ?? DEFAULT_TABLE.id) as string;

    const unsubscribe = ctx.hub.subscribe(tableId, socket);

    try {
      socket.send(JSON.stringify({ type: 'hello', tableId }));
      const snapshot = ctx.table.snapshot();
      if (snapshot) socket.send(JSON.stringify({ type: 'state', state: snapshot }));
    } catch {
      /* ignore */
    }

    socket.on('message', (raw: unknown) => {
      const parsed = WsCommand.safeParse(safeJson(raw));
      if (!parsed.success) return;
      void dispatch(parsed.data);
    });

    async function dispatch(cmd: WsCommand): Promise<void> {
      try {
        if (cmd.type === 'retreat') {
          let result = await controller.retreat(cmd.clientId);
          if (!result) {
            const seat = ctx.table.findSeat({ did: cmd.clientId, agentId: cmd.clientId });
            if (seat.seated && seat.agentId) {
              const left = await ctx.table.leave(seat.agentId);
              result = { agentId: seat.agentId, refunded: left.refunded ?? 0 };
            }
          }
          if (!result) {
            send(socket, { type: 'retreat-error', clientId: cmd.clientId, message: 'no active agent for this client' });
            return;
          }
          ctx.hub.broadcast(tableId, {
            type: 'retreat-complete',
            clientId: cmd.clientId,
            agentId: result.agentId,
            mode: 'retreat',
            refunded: result.refunded,
            currency: SIM_USD.code,
          });
        } else {
          const result = controller.sitOut(cmd.clientId);
          if (!result) {
            send(socket, { type: 'retreat-error', clientId: cmd.clientId, message: 'no active agent for this client' });
            return;
          }
          ctx.hub.broadcast(tableId, {
            type: 'retreat-complete',
            clientId: cmd.clientId,
            agentId: result.agentId,
            mode: 'sit-out',
            refunded: 0,
            currency: SIM_USD.code,
          });
        }
      } catch (err) {
        send(socket, { type: 'retreat-error', clientId: cmd.clientId, message: (err as Error).message });
      }
    }

    socket.on('close', () => unsubscribe());
    socket.on('error', () => unsubscribe());
  });
}

function safeJson(raw: unknown): unknown {
  try {
    return JSON.parse(typeof raw === 'string' ? raw : String(raw));
  } catch {
    return null;
  }
}

function send(socket: SocketLike, event: unknown): void {
  try {
    socket.send(JSON.stringify(event));
  } catch {
    /* ignore */
  }
}
