import { createWalletClient, custom, getAddress, http, type WalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID } from '@table402/shared';

export type WalletKind = 'injected' | 'burner';

export interface WalletConnection {
  address: `0x${string}`;
  did: string;
  client: WalletClient;
  kind: WalletKind;
}

const BURNER_KEY = 'table402.burnerKey';

export function addressToDid(address: string): string {
  return `did:pkh:eip155:${CHAIN_ID}:${getAddress(address)}`;
}

export function didToAddress(did: string): `0x${string}` {
  const parts = did.split(':');
  const addr = parts[parts.length - 1];
  if (!addr || !addr.startsWith('0x')) {
    throw new Error(`Invalid did, cannot extract address: ${did}`);
  }
  return getAddress(addr);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

export async function connectInjectedWallet(): Promise<WalletConnection> {
  if (!hasInjectedWallet()) {
    throw new Error('No Web3 wallet detected. Install a wallet to continue.');
  }
  const transport = custom(window.ethereum!);
  const probe = createWalletClient({ transport });
  const accounts = await probe.requestAddresses();
  const account = accounts[0];
  if (!account) {
    throw new Error('No account authorized by the wallet.');
  }
  const address = getAddress(account);
  const client = createWalletClient({ account: address, transport });
  return { address, did: addressToDid(address), client, kind: 'injected' };
}

export async function getAuthorizedWallet(): Promise<WalletConnection | null> {
  if (!hasInjectedWallet()) return null;
  const transport = custom(window.ethereum!);
  const probe = createWalletClient({ transport });
  const accounts = await probe.getAddresses();
  const account = accounts[0];
  if (!account) return null;
  const address = getAddress(account);
  const client = createWalletClient({ account: address, transport });
  return { address, did: addressToDid(address), client, kind: 'injected' };
}

function loadBurnerKey(): `0x${string}` {
  try {
    const existing = localStorage.getItem(BURNER_KEY);
    if (existing && /^0x[0-9a-fA-F]{64}$/.test(existing)) return existing as `0x${string}`;
  } catch {
    /* ignore */
  }
  const key = generatePrivateKey();
  try {
    localStorage.setItem(BURNER_KEY, key);
  } catch {
    /* ignore */
  }
  return key;
}

export function hasBurnerWallet(): boolean {
  try {
    return /^0x[0-9a-fA-F]{64}$/.test(localStorage.getItem(BURNER_KEY) ?? '');
  } catch {
    return false;
  }
}

export function connectBurnerWallet(): WalletConnection {
  const account = privateKeyToAccount(loadBurnerKey());
  const client = createWalletClient({ account, transport: http() });
  return { address: account.address, did: addressToDid(account.address), client, kind: 'burner' };
}

export function getBurnerWallet(): WalletConnection | null {
  if (!hasBurnerWallet()) return null;
  return connectBurnerWallet();
}
