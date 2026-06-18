import type { MppIdentity } from '@table402/mpp';

export type WalletType = 'agent' | 'table' | 'service';

export interface WalletInfo {
  id: string;
  label: string;
  type: WalletType;
  address: string;
  did: string;
}

export function shortenAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/**
 * Tracks every wallet the server knows about (table, services, joined agents) so
 * receipts and the graph can be labelled by human name. Holds private identities
 * only for wallets the server itself controls (table + services).
 */
export class WalletRegistry {
  private byAddress = new Map<string, WalletInfo>();
  private byId = new Map<string, WalletInfo>();
  private identities = new Map<string, MppIdentity>();

  register(info: WalletInfo, identity?: MppIdentity): WalletInfo {
    this.byAddress.set(info.address.toLowerCase(), info);
    this.byId.set(info.id, info);
    if (identity) this.identities.set(info.id, identity);
    return info;
  }

  getByAddress(address: string): WalletInfo | undefined {
    return this.byAddress.get(address.toLowerCase());
  }

  getById(id: string): WalletInfo | undefined {
    return this.byId.get(id);
  }

  identity(id: string): MppIdentity | undefined {
    return this.identities.get(id);
  }

  labelForAddress(address: string): string {
    return this.getByAddress(address)?.label ?? shortenAddress(address);
  }

  all(): WalletInfo[] {
    return [...this.byAddress.values()];
  }
}
