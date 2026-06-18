import './db/warnings';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { eq } from 'drizzle-orm';
import { deriveIdentity } from '@table402/mpp';
import {
  DEFAULT_TABLE,
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
import { AgentController } from './game/agent-controller';
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

async function ensureSeeded(): Promise<TableConfigRow> {
  let row: typeof tables.$inferSelect | undefined;
  try {
    row = await db.select().from(tables).where(eq(tables.id, DEFAULT_TABLE.id)).get();
  } catch {
    runMigrations();
  }
  if (!row) {
    try {
      await seedDatabase();
    } catch {
      /* tolerate partial seed */
    }
    row = await db.select().from(tables).where(eq(tables.id, DEFAULT_TABLE.id)).get();
  }
  if (!row) throw new Error('Could not initialize the database. Run `pnpm db:setup`.');
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

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const ctx = new AppContext(config);
  const tableConfig = await ensureSeeded();

  // --- Wallets: table, services, seeded agents ---
  const tableIdentity = deriveIdentity(`table:${tableConfig.id}`);
  ctx.wallets.register(
    { id: `table:${tableConfig.id}`, label: tableConfig.name, type: 'table', address: tableIdentity.address, did: tableIdentity.did },
    tableIdentity,
  );
  ctx.fund(tableIdentity.address, TABLE_FAUCET, 'table-faucet');

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

  // --- Runtime + web-driven agent controller ---
  ctx.table = new TableRuntime(ctx, tableConfig, tableIdentity);
  await ctx.snapshotBalances();

  const controller = new AgentController(ctx, {
    baseUrl: config.publicBaseUrl,
    tableId: tableConfig.id,
    minPlayers: config.minPlayers,
    maxSeats: tableConfig.maxSeats,
    thinkMinMs: config.agentThinkMinMs,
    thinkMaxMs: config.agentThinkMaxMs,
  });

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
  app.get('/healthz', async () => ({ ok: true, hands: ctx.table.completedHands }));

  registerRngService(app, ctx);
  registerRefereeService(app, ctx);
  registerCommentaryService(app, ctx);
  registerTableRoutes(app, ctx);
  registerHandRoutes(app, ctx);
  registerReceiptRoutes(app, ctx);
  registerDiscoveryRoutes(app, ctx, registry);
  registerControlRoutes(app, ctx, controller);
  registerPlayWebSocket(app, ctx);

  app.setErrorHandler((err: unknown, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    reply.code(status).send({ error: (err as Error).message, statusCode: status });
  });

  await app.listen({ host: config.host, port: config.port });
  console.log(`\n  ▟ Table402 server  →  http://${config.host}:${config.port}`);
  console.log(`    table: ${tableConfig.name} · seat ${formatUsd(tableConfig.seatFee)} · hand ${formatUsd(tableConfig.perHandFee)} · action ${formatUsd(tableConfig.perActionFee)}`);
  console.log(`    services: RNG ${formatUsd(SERVICE_FEES.rng)} · Referee ${formatUsd(SERVICE_FEES.referee)} · Commentary ${formatUsd(SERVICE_FEES.commentary)}`);
  console.log(`    commentary: ${config.anthropicApiKey ? 'Claude (claude-haiku-4-5)' : 'template (set ANTHROPIC_API_KEY for Claude)'}`);
  console.log(`    discovery: GET /discovery/services · /openapi.json\n`);
}

bootstrap().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
