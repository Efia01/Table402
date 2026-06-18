import { useEffect, useRef, useState } from 'react';
import type { HandStateDTO, ReceiptDTO, WsEvent } from '@table402/shared';

export interface ActionFeedItem {
  id: string;
  seat: number;
  label: string;
  action: string;
  amount: number;
  street: string;
  t: number;
}

export interface LogItem {
  id: string;
  level: string;
  message: string;
  t: number;
}

export interface HandResultBanner {
  handId: string;
  winners: Array<{ seat: number; label: string; amount: number }>;
  board: string[];
  results: Array<{ seat: number; label: string; delta: number; bankrollAfter: number }>;
}

export interface TableFeed {
  connected: boolean;
  hand: HandStateDTO | null;
  payments: ReceiptDTO[];
  actions: ActionFeedItem[];
  logs: LogItem[];
  lastComplete: HandResultBanner | null;
  graphTick: number;
}

const EMPTY: TableFeed = {
  connected: false,
  hand: null,
  payments: [],
  actions: [],
  logs: [],
  lastComplete: null,
  graphTick: 0,
};

let seq = 0;

function reduce(f: TableFeed, msg: WsEvent): TableFeed {
  switch (msg.type) {
    case 'state':
      return { ...f, hand: msg.state };
    case 'payment':
      return { ...f, payments: [msg.receipt, ...f.payments].slice(0, 100) };
    case 'action':
      return {
        ...f,
        actions: [
          { id: `a${seq++}`, seat: msg.seat, label: msg.agentLabel, action: msg.action, amount: msg.amount, street: msg.street, t: Date.now() },
          ...f.actions,
        ].slice(0, 100),
      };
    case 'hand-complete':
      return {
        ...f,
        lastComplete: {
          handId: msg.handId,
          winners: msg.winners,
          board: msg.board,
          results: msg.results,
        },
      };
    case 'graph':
      return { ...f, graphTick: f.graphTick + 1 };
    case 'table-idle':
      return { ...f, hand: null };
    case 'log':
      return {
        ...f,
        logs: [{ id: `l${seq++}`, level: msg.level, message: msg.message, t: Date.now() }, ...f.logs].slice(0, 80),
      };
    default:
      return f;
  }
}

export function useTableFeed(tableId: string): TableFeed {
  const [feed, setFeed] = useState<TableFeed>(EMPTY);
  const ref = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    const connect = () => {
      if (closed) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const base = (import.meta.env.VITE_WS_URL as string | undefined) ?? `${proto}://${location.host}/play`;
      const ws = new WebSocket(`${base}?table=${tableId}`);
      ref.current = ws;
      ws.onopen = () => setFeed((f) => ({ ...f, connected: true }));
      ws.onclose = () => {
        setFeed((f) => ({ ...f, connected: false }));
        if (!closed) setTimeout(connect, 1200);
      };
      ws.onmessage = (ev) => {
        let msg: WsEvent;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
        } catch {
          return;
        }
        setFeed((prev) => reduce(prev, msg));
      };
    };
    connect();
    return () => {
      closed = true;
      ref.current?.close();
    };
  }, [tableId]);

  return feed;
}
