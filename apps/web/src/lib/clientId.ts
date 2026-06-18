import { useState } from 'react';

const KEY = 'table402.clientId';

/** A stable per-browser id used to enforce "one agent per user". */
export function getClientId(): string {
  // Allow ?client=<id> to pin the identity (handy for resuming or sharing a session).
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
  const [id] = useState(getClientId);
  return id;
}
