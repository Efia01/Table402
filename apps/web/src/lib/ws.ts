import { useCallback, useEffect, useRef, useState } from 'react';
import type { HandStateDTO, ReceiptDTO, WsCommand, WsEvent } from '@table402/shared';

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
  potCount: number;
  split: boolean;
  showdown: boolean;
}

export interface RetreatOutcome {
  agentId: string;
  mode: 'retreat' | 'sit-out';
  refunded: number;
  currency: string;
  error: string | null;
  t: number;
}

export interface TableFeed {
  connected: boolean;
  hand: HandStateDTO | null;
  payments: ReceiptDTO[];
  actions: ActionFeedItem[];
  logs: LogItem[];
  lastComplete: HandResultBanner | null;
  graphTick: number;
  retreat: RetreatOutcome | null;
}

const EMPTY: TableFeed = {
  connected: false,
  hand: null,
  payments: [],
  actions: [],
  logs: [],
  lastComplete: null,
  graphTick: 0,
  retreat: null,
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
          potCount: msg.potCount ?? 1,
          split: msg.split ?? false,
          showdown: msg.showdown ?? false,
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
    case 'retreat-complete':
      return {
        ...f,
        retreat: {
          agentId: msg.agentId,
          mode: msg.mode,
          refunded: msg.refunded,
          currency: msg.currency,
          error: null,
          t: Date.now(),
        },
      };
    case 'retreat-error':
      return {
        ...f,
        retreat: { agentId: '', mode: 'retreat', refunded: 0, currency: '', error: msg.message, t: Date.now() },
      };
    default:
      return f;
  }
}

export interface TableConnection {
  feed: TableFeed;
  send: (cmd: WsCommand) => boolean;
}

export function useTableFeed(tableId: string): TableConnection {
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

  const send = useCallback((cmd: WsCommand) => {
    const ws = ref.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(cmd));
    return true;
  }, []);

  return { feed, send };
}
