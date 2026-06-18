import { formatUsd } from '@table402/shared';
import { ROSTER, AgentRuntime } from '@table402/agent';
import { runDemo } from './demo';

const BASE = process.env.TABLE402_API ?? 'http://127.0.0.1:402';
const TABLE = process.env.TABLE402_TABLE ?? 'neon-six-max-402';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Real-time pacing for interactive play.
const THINK_MIN = Number(process.env.AGENT_THINK_MIN_MS ?? 1200);
const THINK_MAX = Number(process.env.AGENT_THINK_MAX_MS ?? 2800);

function listAgents(): void {
  console.log('\n  Table402 agent roster\n');
  for (const a of ROSTER) {
    console.log(`  ${a.name.padEnd(13)} ${a.archetype.padEnd(7)} maxSpend ${formatUsd(a.budget.maxSpend)} · maxSeat ${formatUsd(a.budget.maxSeatFee)} · maxAction ${formatUsd(a.budget.maxActionFee)}`);
  }
  console.log();
}

async function discover(): Promise<void> {
  const tables = (await (await fetch(`${BASE}/tables`)).json()) as any;
  console.log('\n  Tables:');
  for (const t of tables.tables) {
    console.log(`    ${t.name} (${t.id}) — seat ${formatUsd(t.seatFee)} · hand ${formatUsd(t.perHandFee)} · action ${formatUsd(t.perActionFee)}`);
  }
  const disc = (await (await fetch(`${BASE}/discovery/services`)).json()) as any;
  console.log(`\n  Services (remote registry: ${disc.remote}):`);
  for (const s of disc.services) {
    console.log(`    [${s.source}] ${s.name} — ${s.categories.join(', ')}${s.priceHint ? ` (${s.priceHint})` : ''}`);
  }
  console.log();
}

async function joinOnly(): Promise<void> {
  const agents = ROSTER.map((s) => new AgentRuntime(s, { baseUrl: BASE, tableId: TABLE, log: (m) => console.log('  ' + m) }));
  for (const a of agents) {
    await a.join();
    await sleep(200);
  }
  console.log('\n  All agents joined (not playing). Run `pnpm agents:play` or `pnpm demo`.');
  process.exit(0);
}

async function play(): Promise<void> {
  const agents = ROSTER.map(
    (s) =>
      new AgentRuntime(s, {
        baseUrl: BASE,
        tableId: TABLE,
        log: (m) => console.log('  ' + m),
        thinkMinMs: THINK_MIN,
        thinkMaxMs: THINK_MAX,
      }),
  );
  for (const a of agents) {
    await a.join();
    await sleep(200);
  }
  for (const a of agents) a.start();
  console.log('\n  Agents are playing continuously. Press Ctrl+C to stop.');
  process.on('SIGINT', () => {
    for (const a of agents) a.stop();
    process.exit(0);
  });
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'demo';
  switch (cmd) {
    case 'list':
      listAgents();
      break;
    case 'discover':
      await discover();
      break;
    case 'join':
      await joinOnly();
      break;
    case 'play':
      await play();
      break;
    case 'demo':
    default:
      await runDemo();
      break;
  }
}

main().catch((err) => {
  console.error('agents cli failed:', err);
  process.exit(1);
});
