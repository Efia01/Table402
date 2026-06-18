import type { WsEvent } from '@table402/shared';

export interface SocketLike {
  send(data: string): void;
  readyState?: number;
}

/** A minimal pub/sub hub: WebSocket clients subscribe per table; the runtime broadcasts live events. */
export class Hub {
  private rooms = new Map<string, Set<SocketLike>>();

  subscribe(tableId: string, socket: SocketLike): () => void {
    let room = this.rooms.get(tableId);
    if (!room) {
      room = new Set();
      this.rooms.set(tableId, room);
    }
    room.add(socket);
    return () => this.unsubscribe(tableId, socket);
  }

  unsubscribe(tableId: string, socket: SocketLike): void {
    this.rooms.get(tableId)?.delete(socket);
  }

  broadcast(tableId: string, event: WsEvent): void {
    const room = this.rooms.get(tableId);
    if (!room || room.size === 0) return;
    const data = JSON.stringify(event);
    for (const socket of room) {
      try {
        if (socket.readyState === undefined || socket.readyState === 1) socket.send(data);
      } catch {
        /* drop broken sockets silently */
      }
    }
  }

  count(tableId: string): number {
    return this.rooms.get(tableId)?.size ?? 0;
  }
}
