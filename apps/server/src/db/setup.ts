import './warnings';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { resolveDbPath } from './paths';

/**
 * Reset + (re)create the SQLite database, apply migrations, and seed it.
 * Run by `pnpm db:setup` (invoked automatically before `pnpm dev`).
 */
async function main(): Promise<void> {
  const dbPath = resolveDbPath();
  mkdirSync(path.dirname(dbPath), { recursive: true });

  // Start from a clean, freshly-seeded database each run.
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix;
    if (existsSync(file)) rmSync(file, { force: true });
  }

  // Import lazily so the database file is opened AFTER the reset above.
  const { runMigrations } = await import('./migrate');
  const { seedDatabase } = await import('./seed');

  runMigrations();
  const summary = await seedDatabase();

  console.log(`[db] ready at ${dbPath}`);
  console.log(`[db] seeded ${summary.tables} table(s) and ${summary.agents} agent(s)`);
}

main().catch((err) => {
  console.error('[db] setup failed:', err);
  process.exit(1);
});
