import { createWalletClient, custom, getAddress, type WalletClient } from 'viem';
import { CHAIN_ID } from '@table402/shared';

export interface WalletConnection {
  address: `0x${string}`;
  did: string;
  client: WalletClient;
}

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
  return { address, did: addressToDid(address), client };
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
  return { address, did: addressToDid(address), client };
}
