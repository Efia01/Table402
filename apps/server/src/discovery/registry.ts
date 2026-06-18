import type { ServiceEntryDTO } from '@table402/shared';

/**
 * Service discovery. Tries the public MPP registry (mpp.dev/api/services), caches
 * the result, and always includes Table402's own local paid services so the demo
 * works fully offline.
 */
export class ServiceRegistry {
  private cache: ServiceEntryDTO[] | null = null;
  private cachedAt = 0;
  private remoteReachable: boolean | null = null;

  constructor(
    private localServices: ServiceEntryDTO[],
    private ttlMs = 5 * 60_000,
  ) {}

  async discoverServices(force = false): Promise<ServiceEntryDTO[]> {
    const now = Date.now();
    if (!force && this.cache && now - this.cachedAt < this.ttlMs) return this.cache;
    const remote = await this.fetchRemote();
    const merged = [...this.localServices, ...remote];
    this.cache = merged;
    this.cachedAt = now;
    return merged;
  }

  cacheServices(services: ServiceEntryDTO[]): void {
    this.cache = services;
    this.cachedAt = Date.now();
  }

  async searchServices(query: string): Promise<ServiceEntryDTO[]> {
    const all = await this.discoverServices();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.categories.some((c) => c.toLowerCase().includes(q)),
    );
  }

  get remoteStatus(): 'reachable' | 'unreachable' | 'unknown' {
    if (this.remoteReachable === null) return 'unknown';
    return this.remoteReachable ? 'reachable' : 'unreachable';
  }

  private async fetchRemote(): Promise<ServiceEntryDTO[]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://mpp.dev/api/services', { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        this.remoteReachable = false;
        return [];
      }
      const data = (await res.json()) as unknown;
      const arr: any[] = Array.isArray(data)
        ? data
        : ((data as { services?: any[] }).services ?? []);
      this.remoteReachable = true;
      return arr.slice(0, 48).map((s) => ({
        id: String(s.id ?? s.name ?? 'unknown'),
        name: String(s.name ?? s.id ?? 'Unknown'),
        serviceUrl: String(s.serviceUrl ?? s.url ?? ''),
        description: String(s.description ?? ''),
        categories: Array.isArray(s.categories) ? s.categories.map(String) : [],
        availability: 'available' as const,
        source: 'mpp.dev' as const,
        priceHint: null,
      }));
    } catch {
      this.remoteReachable = false;
      return [];
    }
  }
}
