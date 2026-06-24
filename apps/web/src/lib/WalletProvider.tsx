import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  connectBurnerWallet,
  connectInjectedWallet,
  getAuthorizedWallet,
  getBurnerWallet,
  hasInjectedWallet,
  type WalletConnection,
} from './wallet';

interface WalletContextValue {
  connection: WalletConnection | null;
  address: `0x${string}` | null;
  did: string | null;
  isConnected: boolean;
  isAvailable: boolean;
  isBurner: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<WalletConnection | null>;
  connectBurner: () => WalletConnection;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = hasInjectedWallet();

  useEffect(() => {
    let active = true;
    getAuthorizedWallet()
      .then((existing) => {
        if (!active) return;
        if (existing) {
          setConnection(existing);
          return;
        }
        const burner = getBurnerWallet();
        if (burner) setConnection(burner);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const next = await connectInjectedWallet();
      setConnection(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet connection failed.');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectBurner = useCallback(() => {
    setError(null);
    const next = connectBurnerWallet();
    setConnection(next);
    return next;
  }, []);

  const disconnect = useCallback(() => {
    setConnection(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!isAvailable) return;
    const provider = window.ethereum!;
    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts.length) {
        setConnection(null);
        return;
      }
      getAuthorizedWallet()
        .then((next) => setConnection(next))
        .catch(() => setConnection(null));
    };
    provider.on?.('accountsChanged', onAccountsChanged as (...args: unknown[]) => void);
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged as (...args: unknown[]) => void);
    };
  }, [isAvailable]);

  const value = useMemo<WalletContextValue>(
    () => ({
      connection,
      address: connection?.address ?? null,
      did: connection?.did ?? null,
      isConnected: connection !== null,
      isAvailable,
      isBurner: connection?.kind === 'burner',
      isConnecting,
      error,
      connect,
      connectBurner,
      disconnect,
    }),
    [connection, isAvailable, isConnecting, error, connect, connectBurner, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
