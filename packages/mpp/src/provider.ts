import { createIdentity, type MppIdentity } from './identity';
import { sha256Hex } from './encoding';
import { MppError } from './types';

export interface SettleChargeArgs {
  from: string;
  to: string;
  currency: string;
  amount: number;
  reference: string;
}

export interface SettleResult {
  reference: string;
  txHash: string;
  /** Block-explorer URL for the settlement tx (on-chain providers only). */
  explorerUrl?: string;
}

export interface OpenChannelArgs {
  channelId: string;
  from: string;
  to: string;
  currency: string;
  deposit: number;
}

export interface VoucherArgs {
  channelId: string;
  /** Incremental amount to draw from the channel for this voucher. */
  amount: number;
  reference: string;
}

export interface LedgerEvent {
  kind: 'credit' | 'charge' | 'channel-open' | 'voucher' | 'channel-close';
  from?: string;
  to?: string;
  currency: string;
  amount: number;
  reference: string;
  txHash: string;
  channelId?: string;
  explorerUrl?: string;
}

/**
 * The settlement backend. This is the ONLY part of the MPP layer that is
 * simulated — everything else (wire protocol, signatures, receipts) is real.
 * A real `mppx`/Tempo provider would implement this same interface against the
 * Tempo testnet, and the rest of the system would be unchanged.
 */
export interface MppProvider {
  readonly mode: string;
  createIdentity(privateKey?: `0x${string}`): MppIdentity;
  getBalance(address: string, currency: string): number;
  credit(address: string, currency: string, amount: number, reference?: string): void;
  settleCharge(args: SettleChargeArgs): SettleResult;
  openChannel(args: OpenChannelArgs): { channelId: string };
  settleVoucher(args: VoucherArgs): SettleResult;
  closeChannel(channelId: string, reference?: string): { refunded: number };
  setListener(fn: (event: LedgerEvent) => void): void;
}

interface Channel {
  channelId: string;
  from: string;
  to: string;
  currency: string;
  deposit: number;
  drawn: number;
  status: 'open' | 'closed';
}

/**
 * In-process simulated ledger. Balances and channels live in memory; an optional
 * listener lets the host persist every movement to SQLite for the receipt graph.
 */
export class SimulatedProvider implements MppProvider {
  readonly mode = 'simulated';
  private balances = new Map<string, number>();
  private channels = new Map<string, Channel>();
  private listener: ((event: LedgerEvent) => void) | null = null;
  private txCounter = 0;

  private key(address: string, currency: string): string {
    return `${address.toLowerCase()}|${currency}`;
  }

  private txHash(reference: string): string {
    return `0x${sha256Hex(`${reference}:${this.txCounter++}`)}`;
  }

  private emit(event: LedgerEvent): void {
    this.listener?.(event);
  }

  setListener(fn: (event: LedgerEvent) => void): void {
    this.listener = fn;
  }

  createIdentity(privateKey?: `0x${string}`): MppIdentity {
    return createIdentity(privateKey);
  }

  getBalance(address: string, currency: string): number {
    return this.balances.get(this.key(address, currency)) ?? 0;
  }

  private adjust(address: string, currency: string, delta: number): void {
    const k = this.key(address, currency);
    const next = (this.balances.get(k) ?? 0) + delta;
    if (next < 0) {
      throw new MppError('payment-insufficient', 402, `Insufficient ${currency} balance for ${address}`);
    }
    this.balances.set(k, next);
  }

  credit(address: string, currency: string, amount: number, reference = 'faucet'): void {
    if (amount < 0) throw new MppError('verification-failed', 400, 'Cannot credit a negative amount');
    this.adjust(address, currency, amount);
    this.emit({ kind: 'credit', to: address, currency, amount, reference, txHash: this.txHash(reference) });
  }

  settleCharge(args: SettleChargeArgs): SettleResult {
    const { from, to, currency, amount, reference } = args;
    if (amount < 0) throw new MppError('verification-failed', 400, 'Negative charge amount');
    if (this.getBalance(from, currency) < amount) {
      throw new MppError('payment-insufficient', 402, `Insufficient ${currency} balance for ${from}`);
    }
    this.adjust(from, currency, -amount);
    this.adjust(to, currency, amount);
    const txHash = this.txHash(reference);
    this.emit({ kind: 'charge', from, to, currency, amount, reference, txHash });
    return { reference, txHash };
  }

  openChannel(args: OpenChannelArgs): { channelId: string } {
    const { channelId, from, to, currency, deposit } = args;
    if (deposit < 0) throw new MppError('verification-failed', 400, 'Negative channel deposit');
    if (this.getBalance(from, currency) < deposit) {
      throw new MppError('payment-insufficient', 402, `Insufficient ${currency} balance to open channel`);
    }
    this.adjust(from, currency, -deposit); // escrow
    this.channels.set(channelId, { channelId, from, to, currency, deposit, drawn: 0, status: 'open' });
    this.emit({
      kind: 'channel-open',
      from,
      to,
      currency,
      amount: deposit,
      reference: channelId,
      txHash: this.txHash(channelId),
      channelId,
    });
    return { channelId };
  }

  settleVoucher(args: VoucherArgs): SettleResult {
    const { channelId, amount, reference } = args;
    const channel = this.channels.get(channelId);
    if (!channel || channel.status !== 'open') {
      throw new MppError('invalid-challenge', 409, `Channel ${channelId} is not open`);
    }
    if (channel.drawn + amount > channel.deposit) {
      throw new MppError('budget-exceeded', 402, `Voucher exceeds channel deposit for ${channelId}`);
    }
    channel.drawn += amount;
    this.adjust(channel.to, channel.currency, amount);
    const txHash = this.txHash(reference);
    this.emit({
      kind: 'voucher',
      from: channel.from,
      to: channel.to,
      currency: channel.currency,
      amount,
      reference,
      txHash,
      channelId,
    });
    return { reference, txHash };
  }

  closeChannel(channelId: string, reference = channelId): { refunded: number } {
    const channel = this.channels.get(channelId);
    if (!channel) throw new MppError('invalid-challenge', 404, `Unknown channel ${channelId}`);
    if (channel.status === 'closed') return { refunded: 0 };
    const refunded = channel.deposit - channel.drawn;
    if (refunded > 0) this.adjust(channel.from, channel.currency, refunded);
    channel.status = 'closed';
    this.emit({
      kind: 'channel-close',
      from: channel.to,
      to: channel.from,
      currency: channel.currency,
      amount: refunded,
      reference,
      txHash: this.txHash(reference),
      channelId,
    });
    return { refunded };
  }
}
