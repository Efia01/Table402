import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/server/src/db

/** Repository root (apps/server/src/db -> ../../../..). */
export function repoRoot(): string {
  return path.resolve(here, '../../../..');
}

/** Absolute path to the SQLite database file. */
export function resolveDbPath(): string {
  const fromEnv = process.env.DATABASE_PATH;
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot(), 'data', 'sqlite.db');
}

/** Directory holding the generated Drizzle migration SQL (apps/server/drizzle). */
export function drizzleDir(): string {
  return path.resolve(here, '../../drizzle');
}
