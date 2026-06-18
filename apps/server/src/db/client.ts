import './warnings';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema';
import { resolveDbPath } from './paths';

const dbPath = resolveDbPath();
mkdirSync(path.dirname(dbPath), { recursive: true });

/** The raw Node built-in SQLite handle (used for migrations / PRAGMAs). */
export const sqlite = new DatabaseSync(dbPath);
sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');

type Primitive = string | number | bigint | null | Uint8Array;

function sanitize(params: unknown[]): Primitive[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as Primitive;
  });
}

/**
 * Drizzle, executed through `node:sqlite` via the sqlite-proxy driver. The proxy
 * contract: `get` returns `{ rows: <single row as value-array> | undefined }`;
 * `all`/`values` return `{ rows: <array of value-arrays> }`.
 */
export const db = drizzle(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    const args = sanitize(params);
    if (method === 'run') {
      stmt.run(...args);
      return { rows: [] };
    }
    if (method === 'get') {
      const row = stmt.get(...args) as Record<string, unknown> | undefined;
      // sqlite-proxy expects `undefined` (not []) when a `.get()` finds no row.
      return { rows: row ? Object.values(row) : undefined } as { rows: unknown[] };
    }
    const rows = stmt.all(...args) as Record<string, unknown>[];
    return { rows: rows.map((r) => Object.values(r)) };
  },
  { schema },
);

export { schema };
