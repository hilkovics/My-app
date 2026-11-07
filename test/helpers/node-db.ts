// node:sqlite adapter implementing the app's Db interface, for tests.
import { DatabaseSync } from 'node:sqlite';

import { migrate } from '../../src/db/schema';
import type { Db, SqlParam } from '../../src/db/types';

export function createNodeDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  let depth = 0;
  return {
    raw,
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, ...params: SqlParam[]) {
      const r = raw.prepare(source).run(...params);
      return { changes: Number(r.changes) };
    },
    async getAllAsync<T>(source: string, ...params: SqlParam[]) {
      return raw.prepare(source).all(...params).map((r) => ({ ...r })) as T[];
    },
    async getFirstAsync<T>(source: string, ...params: SqlParam[]) {
      const row = raw.prepare(source).get(...params);
      return row ? ({ ...row } as T) : null;
    },
    async withTransactionAsync(task) {
      if (depth > 0) return task();
      depth++;
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
  };
}

export async function createMigratedDb() {
  const db = createNodeDb();
  await migrate(db);
  return db;
}
