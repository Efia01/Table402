import { DEFAULT_TABLE, SEEDED_AGENTS, SIM_USD, nowIso } from '@table402/shared';
import { deriveIdentity } from '@table402/mpp';
import { db } from './client';
import { agents, tables } from './schema';

/** Seed the canonical table (Neon Six Max) and the six demo agents. */
export async function seedDatabase(): Promise<{ tables: number; agents: number }> {
  const now = nowIso();
  const tableWallet = deriveIdentity(`table:${DEFAULT_TABLE.id}`);

  await db.insert(tables).values({
    id: DEFAULT_TABLE.id,
    name: DEFAULT_TABLE.name,
    maxSeats: DEFAULT_TABLE.maxSeats,
    startingChips: DEFAULT_TABLE.startingChips,
    smallBlind: DEFAULT_TABLE.smallBlind,
    bigBlind: DEFAULT_TABLE.bigBlind,
    seatFee: DEFAULT_TABLE.seatFee,
    perHandFee: DEFAULT_TABLE.perHandFee,
    perActionFee: DEFAULT_TABLE.perActionFee,
    currency: SIM_USD.code,
    status: 'open',
    handsPlayed: 0,
    walletAddress: tableWallet.address,
    createdAt: now,
  });

  for (const agent of SEEDED_AGENTS) {
    const identity = deriveIdentity(agent.id);
    await db.insert(agents).values({
      id: agent.id,
      name: agent.name,
      archetype: agent.archetype,
      did: identity.did,
      address: identity.address,
      createdAt: now,
    });
  }

  return { tables: 1, agents: SEEDED_AGENTS.length };
}
