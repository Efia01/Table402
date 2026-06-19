import { useEffect, useState } from 'react';
import { useWallet } from './WalletProvider';

const KEY = 'table402.clientId';

export function getClientId(): string {
  try {
    const override = new URLSearchParams(location.search).get('client');
    if (override) {
      localStorage.setItem(KEY, override);
      return override;
    }
  } catch {
    /* ignore */
  }
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `c-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36).slice(-4)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function useClientId(): string {
  const { did } = useWallet();
  const [id, setId] = useState(getClientId);

  useEffect(() => {
    if (did) {
      localStorage.setItem(KEY, did);
      setId(did);
    }
  }, [did]);

  return id;
}
