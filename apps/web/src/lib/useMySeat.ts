import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, API_BASE } from './api';
import { useWallet } from './WalletProvider';

export interface MySeat {
  seated: boolean;
  seatIndex: number | null;
  agentId: string | null;
  name: string | null;
  sessionId: string | null;
  address: string | null;
  walletBalance: number;
  currency: string;
}

export function useMySeat(tableId: string) {
  const { did } = useWallet();
  return useQuery<MySeat>({
    queryKey: ['myseat', tableId, did],
    queryFn: () => api.seat(tableId, { did: did! }),
    enabled: !!did,
    refetchInterval: 6000,
  });
}

export function releaseSeatBeacon(tableId: string, did: string): void {
  try {
    const url = `${API_BASE}/tables/${tableId}/leave`;
    const body = JSON.stringify({ did });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
    }
  } catch {
    /* ignore */
  }
}

export function useReleaseOnExit(tableId: string, did: string | null, active: boolean): void {
  useEffect(() => {
    if (!active || !did) return;
    const onUnload = () => releaseSeatBeacon(tableId, did);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
    };
  }, [tableId, did, active]);
}
