import { verifyMessage } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID } from '@table402/shared';
import { sha256Hex } from './encoding';

/**
 * A cryptographic identity. The keypair and signatures are **real** (viem /
 * secp256k1, EIP-191 personal_sign). Only the *settlement* is simulated.
 */
export interface MppIdentity {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  did: string;
}

export function addressToDid(address: string): string {
  return `did:pkh:eip155:${CHAIN_ID}:${address}`;
}

export function didToAddress(did: string): `0x${string}` {
  const parts = did.split(':');
  const addr = parts[parts.length - 1];
  if (!addr || !addr.startsWith('0x')) {
    throw new Error(`Invalid did, cannot extract address: ${did}`);
  }
  return addr as `0x${string}`;
}

export function createIdentity(privateKey?: `0x${string}`): MppIdentity {
  const pk = privateKey ?? generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { privateKey: pk, address: account.address, did: addressToDid(account.address) };
}

/** Deterministic identity from a 32-byte hex seed — handy for stable demo wallets. */
export function identityFromSeedHex(seedHex: string): MppIdentity {
  let hex = seedHex.replace(/^0x/, '');
  if (hex.length < 64) hex = hex.padStart(64, '0');
  hex = hex.slice(0, 64);
  return createIdentity(`0x${hex}` as `0x${string}`);
}

/**
 * Deterministically derive a stable identity from a human label, so the same
 * agent/table/service always has the same address across runs (reproducible
 * demos + a stable receipt graph). Testnet-only throwaway keys — never reuse a
 * derivation scheme like this for real funds.
 */
export function deriveIdentity(label: string): MppIdentity {
  return identityFromSeedHex(sha256Hex(`table402-wallet:${label}`));
}

export async function signMessage(
  privateKey: `0x${string}`,
  message: string,
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message });
}

export async function verifySignature(
  address: `0x${string}`,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    return await verifyMessage({ address, message, signature: signature as `0x${string}` });
  } catch {
    return false;
  }
}
