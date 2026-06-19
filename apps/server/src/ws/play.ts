import type { FastifyInstance } from 'fastify';
import { DEFAULT_TABLE } from '@table402/shared';
import type { AppContext } from '../core/context';
import type { SocketLike } from '../core/hub';

interface WsSocket extends SocketLike {
  on(event: 'close' | 'error' | 'message', cb: (...args: unknown[]) => void): void;
}

/** Live game + payment feed over `/play?table=<id>`. */
export function registerPlayWebSocket(app: FastifyInstance, ctx: AppContext): void {
  app.get('/play', { websocket: true }, (connection: unknown, req) => {
    // @fastify/websocket v11 passes the socket directly; older versions pass { socket }.
    const socket = ((connection as { socket?: WsSocket }).socket ?? connection) as WsSocket;
    const tableId = ((req.query as { table?: string }).table ?? DEFAULT_TABLE.id) as string;

    const unsubscribe = ctx.hub.subscribe(tableId, socket);

    try {
      socket.send(JSON.stringify({ type: 'hello', tableId }));
      const snapshot = (ctx.tableFor(tableId) ?? ctx.table).snapshot();
      if (snapshot) socket.send(JSON.stringify({ type: 'state', state: snapshot }));
    } catch {
      /* ignore */
    }

    socket.on('close', () => unsubscribe());
    socket.on('error', () => unsubscribe());
  });
}
