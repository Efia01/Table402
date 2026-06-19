import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  getAddress,
  type Account,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { tempoModerato } from 'viem/chains';
import { createIdentity, type MppIdentity } from './identity';
import { MppError } from './types';
import type {
  LedgerEvent,
  MppProvider,
  OpenChannelArgs,
  SettleChargeArgs,
  SettleResult,
  VoucherArgs,
} from './provider';

const TIP20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

export interface MppxProviderOptions {
  signerKey: Hex;
  token: `0x${string}`;
  rpcUrl?: string;
  tokenDecimals?: number;
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

function envKey(name: string): string | undefined {
  const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  return v && v.length > 0 ? v : undefined;
}

export class MppxProvider implements MppProvider {
  readonly mode = 'tempo-testnet';
  private public: ReturnType<typeof createPublicClient>;
  private wallet: ReturnType<typeof createWalletClient>;
  private account: Account;
  private token: `0x${string}`;
  private tokenDecimals: number;
  private listener: ((event: LedgerEvent) => void) | null = null;
  private balanceCache = new Map<string, number>();
  private channels = new Map<string, Channel>();

  constructor(opts: MppxProviderOptions) {
    const rpcUrl = opts.rpcUrl ?? tempoModerato.rpcUrls.default.http[0];
    this.account = privateKeyToAccount(opts.signerKey);
    this.token = getAddress(opts.token);
    this.tokenDecimals = opts.tokenDecimals ?? tempoModerato.nativeCurrency.decimals;
    this.public = createPublicClient({ transport: http(rpcUrl) });
    this.wallet = createWalletClient({ account: this.account, transport: http(rpcUrl) });
  }

  static fromEnv(): MppxProvider {
    const signerKey = envKey('TEMPO_SIGNER_KEY') ?? envKey('MPP_SIGNER_KEY');
    if (!signerKey) {
      throw new MppError(
        'verification-failed',
        500,
        'MPP_MODE=tempo-testnet requires TEMPO_SIGNER_KEY (a funded 0x private key on Tempo Moderato).',
      );
    }
    const token = envKey('TEMPO_TOKEN') ?? '0x20c0000000000000000000000000000000000001';
    return new MppxProvider({
      signerKey: signerKey as Hex,
      token: token as `0x${string}`,
      rpcUrl: envKey('TEMPO_RPC_URL'),
      tokenDecimals: envKey('TEMPO_TOKEN_DECIMALS') ? Number(envKey('TEMPO_TOKEN_DECIMALS')) : undefined,
    });
  }

  private toBaseUnits(atomic: number): bigint {
    return BigInt(Math.round((atomic / 1_000_000) * 10 ** this.tokenDecimals));
  }

  private fromBaseUnits(raw: bigint): number {
    return Math.round((Number(raw) / 10 ** this.tokenDecimals) * 1_000_000);
  }

  private explorerTx(hash: string): string {
    return `${tempoModerato.blockExplorers.default.url}/tx/${hash}`;
  }

  setListener(fn: (event: LedgerEvent) => void): void {
    this.listener = fn;
  }

  createIdentity(privateKey?: `0x${string}`): MppIdentity {
    return createIdentity(privateKey);
  }

  getBalance(address: string, currency: string): number {
    const key = `${getAddress(address)}|${currency}`;
    void this.public
      .readContract({ address: this.token, abi: TIP20_ABI, functionName: 'balanceOf', args: [getAddress(address)] })
      .then((raw) => this.balanceCache.set(key, this.fromBaseUnits(raw as bigint)))
      .catch(() => undefined);
    return this.balanceCache.get(key) ?? 0;
  }

  credit(): void {
    throw new MppError(
      'verification-failed',
      400,
      'On-chain mode does not mint funds — fund the wallet from the Tempo testnet faucet.',
    );
  }

  settleCharge(args: SettleChargeArgs): SettleResult {
    const { from, to, currency, amount, reference } = args;
    if (amount < 0) throw new MppError('verification-failed', 400, 'Negative charge amount');
    const value = this.toBaseUnits(amount);

    const pending = this.wallet.writeContract({
      account: this.account,
      chain: tempoModerato,
      address: this.token,
      abi: TIP20_ABI,
      functionName: 'transfer',
      args: [getAddress(to), value],
    });

    const txHash = `pending:${reference}`;
    void pending
      .then((hash) => {
        this.emit({
          kind: 'charge',
          from,
          to,
          currency,
          amount,
          reference,
          txHash: hash,
          explorerUrl: this.explorerTx(hash),
        });
        return this.public.waitForTransactionReceipt({ hash });
      })
      .catch(() => undefined);

    return { reference, txHash };
  }

  openChannel(args: OpenChannelArgs): { channelId: string } {
    const { channelId, from, to, currency, deposit } = args;
    this.channels.set(channelId, { channelId, from, to, currency, deposit, drawn: 0, status: 'open' });
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
    const settle = this.settleCharge({
      from: channel.from,
      to: channel.to,
      currency: channel.currency,
      amount,
      reference,
    });
    this.emit({
      kind: 'voucher',
      from: channel.from,
      to: channel.to,
      currency: channel.currency,
      amount,
      reference,
      txHash: settle.txHash,
      channelId,
    });
    return settle;
  }

  closeChannel(channelId: string, reference = channelId): { refunded: number } {
    const channel = this.channels.get(channelId);
    if (!channel) throw new MppError('invalid-challenge', 404, `Unknown channel ${channelId}`);
    if (channel.status === 'closed') return { refunded: 0 };
    const refunded = channel.deposit - channel.drawn;
    channel.status = 'closed';
    this.emit({
      kind: 'channel-close',
      from: channel.to,
      to: channel.from,
      currency: channel.currency,
      amount: refunded,
      reference,
      txHash: `refund:${reference}`,
      channelId,
    });
    return { refunded };
  }

  private emit(event: LedgerEvent): void {
    this.listener?.(event);
  }
}
