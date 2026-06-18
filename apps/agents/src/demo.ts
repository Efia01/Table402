import { formatUsd } from '@table402/shared';
import { ROSTER, AgentRuntime } from '@table402/agent';

const BASE = process.env.TABLE402_API ?? 'http://127.0.0.1:4020';
const TABLE = process.env.TABLE402_TABLE ?? 'neon-six-max-402';
const TARGET = Number(process.env.DEMO_HANDS ?? 10);
// The demo is a throughput showcase — paced moderately so it stays watchable but
// still completes quickly. Interactive `pnpm agents:play` and the web run slower.
const THINK_MIN = Number(process.env.DEMO_THINK_MIN_MS ?? 350);
const THINK_MAX = Number(process.env.DEMO_THINK_MAX_MS ?? 850);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

async function handsPlayed(): Promise<number> {
  try {
    const res = await fetch(`${BASE}/healthz`);
    return ((await res.json()) as { hands: number }).hands;
  } catch {
    return 0;
  }
}

function rule(label = ''): void {
  console.log(`\n${'─'.repeat(72)}${label ? ' ' + label : ''}`);
}

export async function runDemo(): Promise<void> {
  console.log('\n  ╔══════════════════════════════════════════════════════════════════╗');
  console.log('  ║   Table402 — autonomous agents on the Machine Payments Protocol   ║');
  console.log('  ║   testnet simulation · simulation chips · no cash-out            ║');
  console.log('  ╚══════════════════════════════════════════════════════════════════╝');

  if (!(await waitForServer())) {
    console.error(`\n  ✗ Server not reachable at ${BASE}. Start it first with \`pnpm dev\`.`);
    process.exit(1);
  }

  // 1. Discover the table + services.
  rule('DISCOVER');
  const tablesRes = (await (await fetch(`${BASE}/tables`)).json()) as any;
  const t = tablesRes.tables[0];
  console.log(
    `  table ${t.name} · seat ${formatUsd(t.seatFee)} · hand ${formatUsd(t.perHandFee)} · action ${formatUsd(t.perActionFee)} · ${t.maxSeats} seats`,
  );
  const disc = (await (await fetch(`${BASE}/discovery/services`)).json()) as any;
  console.log(`  service discovery: ${disc.services.length} services (remote registry: ${disc.remote})`);
  for (const s of disc.services.filter((x: any) => x.source === 'local')) {
    console.log(`    • ${s.name} — ${s.priceHint}`);
  }

  // 2. Six agents discover + join (each shows a 402 flow).
  rule('JOIN (402 → pay seat fee → seat)');
  const agents = ROSTER.map(
    (spec) =>
      new AgentRuntime(spec, {
        baseUrl: BASE,
        tableId: TABLE,
        log: (m) => console.log('  ' + m),
        thinkMinMs: THINK_MIN,
        thinkMaxMs: THINK_MAX,
      }),
  );
  let joined = 0;
  for (const a of agents) {
    if (await a.join()) joined += 1;
    await sleep(250);
  }
  console.log(`\n  ${joined}/${agents.length} agents seated.`);

  // 3. Play autonomously until the target number of hands completes.
  rule(`PLAY (target: ${TARGET} hands)`);
  const startHands = await handsPlayed();
  for (const a of agents) a.start();

  let last = -1;
  while ((await handsPlayed()) < startHands + TARGET) {
    const done = (await handsPlayed()) - startHands;
    if (done !== last) {
      process.stdout.write(`\r  hands completed: ${done}/${TARGET}   `);
      last = done;
    }
    await sleep(600);
  }
  console.log(`\r  hands completed: ${TARGET}/${TARGET}   ✓`);

  // 4. Leave (close sessions, refund unspent escrow).
  for (const a of agents) await a.leave();
  await sleep(400);
  for (const a of agents) a.stop();

  // 5. Summary.
  rule('SUMMARY');
  const totalHands = await handsPlayed();
  const receipts = (await (await fetch(`${BASE}/receipts?limit=2000`)).json()) as any;
  const agentRows = (await (await fetch(`${BASE}/agents`)).json()) as any;
  console.log(`  hands played (server total): ${totalHands}`);
  console.log(`  receipts persisted (SQLite): ${receipts.count}`);
  console.log(`  agents:`);
  for (const a of agentRows.agents) {
    console.log(
      `    ${a.name.padEnd(13)} balance ${formatUsd(a.balance).padStart(9)}  did ${a.did.slice(0, 28)}…`,
    );
  }
  const latest = (await (await fetch(`${BASE}/hands`)).json()) as any;
  const lastComplete = latest.hands.find((h: any) => h.status === 'complete');
  if (lastComplete) {
    console.log(`\n  ▶ explore the receipt graph for the last hand:`);
    console.log(`     web dashboard:  http://localhost:5173/graph/${lastComplete.id}`);
    console.log(`     api:            ${BASE}/hands/${lastComplete.id}/graph`);
  }
  console.log(`\n  ✓ demo complete. Open the dashboard at http://localhost:5173\n`);
  process.exit(0);
}
