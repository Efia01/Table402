/**
 * The simulation currency. Field shapes deliberately mirror Tempo's pathUSD so a
 * real `mppx` provider can map onto them 1:1 when swapping out the simulated ledger.
 */
export const SIM_USD = {
  symbol: '$',
  code: 'simUSD',
  label: 'simUSD',
  atomicDecimals: 6,
  /** Mirrors the Tempo pathUSD precompile currency address shape. */
  address: '0x20c0000000000000000000000000000000000000',
} as const;

export type CurrencyCode = typeof SIM_USD.code;

/** Tempo testnet chain id — used inside `did:pkh:eip155:<chainId>:<addr>` identities. */
export const CHAIN_ID = 4217;

export const PAYMENT_METHOD = 'tempo' as const;
