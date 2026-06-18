import './warnings';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { resolveDbPath } from './paths';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class DbLockedError extends Error {}

/**
 * Remove the SQLite files so we can re-seed from scratch. Retries a few times to
 * ride out transient locks (antivirus / search indexer). If the file is still
 * locked, a Table402 server is almost certainly still running — say so clearly.
 */
async function resetDbFiles(dbPath: string): Promise<void> {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = dbPath + suffix;
    if (!existsSync(file)) continue;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        rmSync(file, { force: true });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        await sleep(250);
      }
    }
    if (lastErr) {
      throw new DbLockedError(
        `the database file is locked:\n  ${file}\n\n` +
          `A Table402 server is probably still running and holding it open.\n` +
          `Stop it first, then run \`pnpm dev\` again:\n` +
          `  • close the other \`pnpm dev\` terminal, or\n` +
          `  • Windows:      taskkill /F /IM node.exe\n` +
          `  • macOS / Linux: pkill -f tsx`,
      );
    }
  }
}

async function main(): Promise<void> {
  const dbPath = resolveDbPath();
  mkdirSync(path.dirname(dbPath), { recursive: true });

  await resetDbFiles(dbPath);

  // Import lazily so the database file is opened AFTER the reset above.
  const { runMigrations } = await import('./migrate');
  const { seedDatabase } = await import('./seed');

  runMigrations();
  const summary = await seedDatabase();

  console.log(`[db] ready at ${dbPath}`);
  console.log(`[db] seeded ${summary.tables} table(s) and ${summary.agents} agent(s)`);
}

main().catch((err) => {
  if (err instanceof DbLockedError) {
    console.error(`\n[db] ${err.message}\n`);
  } else {
    console.error('[db] setup failed:', err);
  }
  process.exit(1);
});
