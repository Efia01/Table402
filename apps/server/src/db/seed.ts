import { TABLES, SEEDED_AGENTS, SIM_USD, nowIso } from '@table402/shared';
import { deriveIdentity } from '@table402/mpp';
import { db } from './client';
import { agents, tables } from './schema';

/** Seed every maison room and the six demo agents. */
export async function seedDatabase(): Promise<{ tables: number; agents: number }> {
  const now = nowIso();

  for (const t of TABLES) {
    const tableWallet = deriveIdentity(`table:${t.id}`);
    await db
      .insert(tables)
      .values({
        id: t.id,
        name: t.name,
        maxSeats: t.maxSeats,
        startingChips: t.startingChips,
        smallBlind: t.smallBlind,
        bigBlind: t.bigBlind,
        seatFee: t.seatFee,
        perHandFee: t.perHandFee,
        perActionFee: t.perActionFee,
        currency: SIM_USD.code,
        status: 'open',
        handsPlayed: 0,
        walletAddress: tableWallet.address,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

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

  return { tables: TABLES.length, agents: SEEDED_AGENTS.length };
}
