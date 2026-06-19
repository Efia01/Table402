import './db/warnings';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { eq } from 'drizzle-orm';
import { deriveIdentity } from '@table402/mpp';
import {
  DEFAULT_TABLE,
  TABLES,
  SERVICE_FEES,
  SERVICE_IDS,
  SIM_USD,
  TABLE_FAUCET,
  AGENT_FAUCET,
  formatUsd,
  type ServiceEntryDTO,
} from '@table402/shared';
import { loadConfig } from './config';
import { db } from './db/client';
import { agents as agentsTable, tables } from './db/schema';
import { runMigrations } from './db/migrate';
import { seedDatabase } from './db/seed';
import { AppContext } from './core/context';
import { TableRuntime, type TableConfigRow } from './game/table-runtime';
import { AgentController, ControllerHub } from './game/agent-controller';
import { ServiceRegistry } from './discovery/registry';
import { registerTableRoutes } from './routes/tables';
import { registerHandRoutes } from './routes/hands';
import { registerReceiptRoutes } from './routes/receipts';
import { registerDiscoveryRoutes } from './routes/discovery';
import { registerControlRoutes } from './routes/control';
import { registerPlayWebSocket } from './ws/play';
import { registerRngService } from './services/rng';
import { registerRefereeService } from './services/referee';
import { registerCommentaryService } from './services/commentary';

function toConfig(row: typeof tables.$inferSelect): TableConfigRow {
  return {
    id: row.id,
    name: row.name,
    maxSeats: row.maxSeats,
    startingChips: row.startingChips,
    smallBlind: row.smallBlind,
    bigBlind: row.bigBlind,
    seatFee: row.seatFee,
    perHandFee: row.perHandFee,
    perActionFee: row.perActionFee,
    currency: row.currency,
    walletAddress: row.walletAddress,
  };
}

/** Ensure every maison room exists in the DB, then return their configs. */
async function ensureSeeded(): Promise<TableConfigRow[]> {
  try {
    await db.select().from(tables).where(eq(tables.id, DEFAULT_TABLE.id)).get();
  } catch {
    runMigrations();
  }
  // seedDatabase upserts (onConflictDoNothing), so this backfills any new rooms.
  try {
    await seedDatabase();
  } catch {
    /* tolerate partial seed */
  }
  const rows: TableConfigRow[] = [];
  for (const t of TABLES) {
    const row = await db.select().from(tables).where(eq(tables.id, t.id)).get();
    if (row) rows.push(toConfig(row));
  }
  if (rows.length === 0) throw new Error('Could not initialize the database. Run `pnpm db:setup`.');
  return rows;
}

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const ctx = new AppContext(config);
  const tableConfigs = await ensureSeeded();
  const defaultConfig = tableConfigs[0]!;

  // --- Wallets: every room's table, services, seeded agents ---
  const tableIdentities = new Map<string, ReturnType<typeof deriveIdentity>>();
  for (const tc of tableConfigs) {
    const identity = deriveIdentity(`table:${tc.id}`);
    tableIdentities.set(tc.id, identity);
    ctx.wallets.register(
      { id: `table:${tc.id}`, label: tc.name, type: 'table', address: identity.address, did: identity.did },
      identity,
    );
    ctx.fund(identity.address, TABLE_FAUCET, 'table-faucet');
  }

  const serviceLabels: Record<string, string> = {
    [SERVICE_IDS.rng]: 'RNG service',
    [SERVICE_IDS.referee]: 'Referee service',
    [SERVICE_IDS.commentary]: 'Commentary desk',
  };
  for (const [svc, walletId] of Object.entries(SERVICE_IDS)) {
    const identity = deriveIdentity(`service:${svc}`);
    ctx.wallets.register(
      { id: walletId, label: serviceLabels[walletId]!, type: 'service', address: identity.address, did: identity.did },
      identity,
    );
  }

  const agentRows = await db.select().from(agentsTable);
  for (const a of agentRows) {
    ctx.wallets.register({ id: a.id, label: a.name, type: 'agent', address: a.address, did: a.did });
    ctx.fund(a.address, AGENT_FAUCET, 'faucet');
  }

  // --- Runtimes + web-driven agent controllers (one room each) ---
  const controllers = new Map<string, AgentController>();
  for (const tc of tableConfigs) {
    const runtime = new TableRuntime(ctx, tc, tableIdentities.get(tc.id)!);
    ctx.tables.set(tc.id, runtime);
    controllers.set(
      tc.id,
      new AgentController(ctx, {
        baseUrl: config.publicBaseUrl,
        tableId: tc.id,
        minPlayers: config.minPlayers,
        maxSeats: tc.maxSeats,
        thinkMinMs: config.agentThinkMinMs,
        thinkMaxMs: config.agentThinkMaxMs,
        startingChips: tc.startingChips,
      }),
    );
  }
  ctx.table = ctx.tables.get(defaultConfig.id)!;
  const hub = new ControllerHub(controllers);
  await ctx.snapshotBalances();

  // --- Service registry (local services + remote discovery) ---
  const base = config.publicBaseUrl;
  const localServices: ServiceEntryDTO[] = [
    {
      id: SERVICE_IDS.rng,
      name: 'Table402 RNG',
      serviceUrl: `${base}/services/rng/seed`,
      description: 'Verifiable random shuffle seeds, one per hand.',
      categories: ['rng', 'entropy', 'poker'],
      availability: 'available',
      source: 'local',
      priceHint: `${formatUsd(SERVICE_FEES.rng)} / seed`,
    },
    {
      id: SERVICE_IDS.referee,
      name: 'Table402 Referee',
      serviceUrl: `${base}/services/referee/validate`,
      description: 'Independent replay-based validation of completed hands.',
      categories: ['validation', 'poker', 'integrity'],
      availability: 'available',
      source: 'local',
      priceHint: `${formatUsd(SERVICE_FEES.referee)} / hand`,
    },
    {
      id: SERVICE_IDS.commentary,
      name: 'Table402 Commentary',
      serviceUrl: `${base}/services/commentary/commentary`,
      description: 'AI hand recaps + best-move reads (Claude or template).',
      categories: ['commentary', 'ai', 'text'],
      availability: 'available',
      source: 'local',
      priceHint: `${formatUsd(SERVICE_FEES.commentary)} / recap`,
    },
  ];
  const registry = new ServiceRegistry(localServices);

  // --- Fastify ---
  const app = Fastify({ logger: false, bodyLimit: 2_000_000 });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get('/', async () => ({
    name: 'Table402 API',
    tagline: 'A multiplayer poker arena for autonomous agents powered by MPP.',
    network: config.autoPlay ? 'simulated-ledger (auto-play)' : 'simulated-ledger',
    currency: SIM_USD.code,
    endpoints: ['/tables', '/agents', '/receipts', '/hands/:id', '/hands/:id/graph', '/discovery/services', '/openapi.json', '/play (ws)'],
  }));
  app.get('/healthz', async () => ({
    ok: true,
    hands: [...ctx.tables.values()].reduce((n, t) => n + t.completedHands, 0),
    tables: ctx.tables.size,
  }));

  registerRngService(app, ctx);
  registerRefereeService(app, ctx);
  registerCommentaryService(app, ctx);
  registerTableRoutes(app, ctx);
  registerHandRoutes(app, ctx);
  registerReceiptRoutes(app, ctx);
  registerDiscoveryRoutes(app, ctx, registry);
  registerControlRoutes(app, ctx, hub);
  registerPlayWebSocket(app, ctx);

  app.setErrorHandler((err: unknown, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    reply.code(status).send({ error: (err as Error).message, statusCode: status });
  });

  await app.listen({ host: config.host, port: config.port });
  // Seat self-funding house bots in every room so the lobby is alive & choosable
  // (the server must be listening first — bots join over HTTP).
  void hub.prefillAll().catch(() => {});
  console.log(`\n  ▟ Table402 server  →  http://${config.host}:${config.port}`);
  console.log(`    rooms: ${tableConfigs.map((t) => t.name).join(' · ')}`);
  console.log(`    table: ${defaultConfig.name} · seat ${formatUsd(defaultConfig.seatFee)} · hand ${formatUsd(defaultConfig.perHandFee)} · action ${formatUsd(defaultConfig.perActionFee)}`);
  console.log(`    services: RNG ${formatUsd(SERVICE_FEES.rng)} · Referee ${formatUsd(SERVICE_FEES.referee)} · Commentary ${formatUsd(SERVICE_FEES.commentary)}`);
  console.log(`    commentary: ${config.anthropicApiKey ? 'Claude (claude-haiku-4-5)' : 'template (set ANTHROPIC_API_KEY for Claude)'}`);
  console.log(`    discovery: GET /discovery/services · /openapi.json\n`);
}

bootstrap().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
