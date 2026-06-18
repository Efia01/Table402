import { SEEDED_AGENTS, parseUsd, type Archetype } from '@table402/shared';

export interface AgentBudget {
  maxSpend: number;
  maxSeatFee: number;
  maxHandFee: number;
  maxActionFee: number;
}

export interface AgentSpec {
  id: string;
  name: string;
  archetype: Archetype;
  budget: AgentBudget;
}

export const ARCHETYPES: Archetype[] = ['tight', 'aggro', 'random', 'budget'];

export function budgetFor(archetype: Archetype): AgentBudget {
  if (archetype === 'budget') {
    return {
      maxSpend: parseUsd('0.60'),
      maxSeatFee: parseUsd('0.012'),
      maxHandFee: parseUsd('0.0025'),
      maxActionFee: parseUsd('0.00025'),
    };
  }
  return {
    maxSpend: parseUsd('2.00'),
    maxSeatFee: parseUsd('0.02'),
    maxHandFee: parseUsd('0.005'),
    maxActionFee: parseUsd('0.0005'),
  };
}

export const ROSTER: AgentSpec[] = SEEDED_AGENTS.map((a) => ({
  id: a.id,
  name: a.name,
  archetype: a.archetype as Archetype,
  budget: budgetFor(a.archetype as Archetype),
}));
