import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { sqlite } from './client';
import { drizzleDir } from './paths';

/** Apply the generated Drizzle migration SQL via the built-in node:sqlite handle. */
export function runMigrations(): void {
  const dir = drizzleDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), 'utf8');
    sqlite.exec(sql);
  }
}
