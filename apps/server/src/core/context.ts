import { MppServer, SimulatedProvider, type MppReceipt } from '@table402/mpp';
import {
  DEFAULT_TABLE,
  SIM_USD,
  newId,
  nowIso,
  type FeeKind,
  type ReceiptDTO,
} from '@table402/shared';
import { db } from '../db/client';
import { balances, payments, receipts } from '../db/schema';
import type { AppConfig } from '../config';
import { Hub } from './hub';
import { WalletRegistry, type WalletType } from './wallets';
import type { TableRuntime } from '../game/table-runtime';

export interface PaymentParty {
  id: string;
  label: string;
  type: WalletType;
  address: string;
}

export interface RecordPaymentInput {
  receipt: MppReceipt;
  kind: FeeKind;
  from: PaymentParty;
  to: PaymentParty;
  tableId?: string;
  handId?: string | null;
  service?: string | null;
  unlocks?: string | null;
}

export interface RecordedPayment {
  paymentId: string;
  receiptId: string;
  dto: ReceiptDTO;
}

/** Shared application state: the MPP stack, wallets, the live hub, and persistence. */
export class AppContext {
  readonly provider: SimulatedProvider;
  readonly mpp: MppServer;
  readonly wallets: WalletRegistry;
  readonly hub: Hub;
  readonly config: AppConfig;
  table!: TableRuntime;

  constructor(config: AppConfig) {
    this.config = config;
    this.provider = new SimulatedProvider();
    this.mpp = new MppServer({ secret: config.secret, provider: this.provider, realm: 'table402.local' });
    this.wallets = new WalletRegistry();
    this.hub = new Hub();
  }

  balanceOf(address: string): number {
    return this.provider.getBalance(address, SIM_USD.code);
  }

  fund(address: string, amount: number, reference = 'faucet'): void {
    this.provider.credit(address, SIM_USD.code, amount, reference);
  }

  /** Register (upsert) an agent wallet so receipts + the graph show its name.
   *  Funding comes from boot (seeded agents) or the /faucet endpoint (new agents). */
  ensureAgentWallet(info: { id: string; label: string; address: string; did: string }): void {
    this.wallets.register({ ...info, type: 'agent' });
  }

  /** Persist a settled payment + its receipt, and broadcast it to the live feed. */
  async recordPayment(input: RecordPaymentInput): Promise<RecordedPayment> {
    const { receipt, kind, from, to } = input;
    const amount = Number(receipt.settlement.amount);
    const paymentId = newId('pay');
    const receiptId = newId('rcpt');
    const now = receipt.timestamp ?? nowIso();
    const tableId = input.tableId ?? DEFAULT_TABLE.id;

    await db.insert(payments).values({
      id: paymentId,
      challengeId: receipt.challengeId,
      idempotencyKey: receipt.idempotencyKey ?? null,
      kind,
      intent: receipt.intent,
      fromId: from.id,
      fromAddress: from.address,
      fromLabel: from.label,
      toId: to.id,
      toAddress: to.address,
      toLabel: to.label,
      amount,
      currency: receipt.settlement.currency,
      reference: receipt.reference,
      txHash: receipt.txHash ?? null,
      status: receipt.status,
      handId: input.handId ?? null,
      service: input.service ?? null,
      unlocks: input.unlocks ?? null,
      createdAt: now,
    });

    await db.insert(receipts).values({
      id: receiptId,
      paymentId,
      challengeId: receipt.challengeId,
      method: receipt.method,
      intent: receipt.intent,
      reference: receipt.reference,
      settlementAmount: amount,
      settlementCurrency: receipt.settlement.currency,
      status: receipt.status,
      receiptHash: receipt.receiptHash,
      idempotencyKey: receipt.idempotencyKey ?? null,
      source: receipt.source,
      recipient: receipt.recipient,
      channelId: receipt.channelId ?? null,
      raw: receipt,
      createdAt: now,
    });

    const dto: ReceiptDTO = {
      id: receiptId,
      challengeId: receipt.challengeId,
      kind,
      fromId: from.id,
      fromLabel: from.label,
      toId: to.id,
      toLabel: to.label,
      amount,
      currency: receipt.settlement.currency,
      status: receipt.status,
      receiptHash: receipt.receiptHash,
      idempotencyKey: receipt.idempotencyKey ?? null,
      reference: receipt.reference,
      handId: input.handId ?? null,
      service: input.service ?? null,
      unlocks: input.unlocks ?? null,
      timestamp: now,
    };

    this.hub.broadcast(tableId, { type: 'payment', receipt: dto });
    return { paymentId, receiptId, dto };
  }

  /** Mirror live in-memory balances into SQLite for the dashboard. */
  async snapshotBalances(): Promise<void> {
    const now = nowIso();
    for (const w of this.wallets.all()) {
      const amount = this.provider.getBalance(w.address, SIM_USD.code);
      const id = `${w.address.toLowerCase()}|${SIM_USD.code}`;
      await db
        .insert(balances)
        .values({
          id,
          address: w.address,
          label: w.label,
          ownerType: w.type,
          currency: SIM_USD.code,
          amount,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: balances.id,
          set: { amount, label: w.label, updatedAt: now },
        });
    }
  }
}
