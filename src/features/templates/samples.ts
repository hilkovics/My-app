import type { Db } from '../../db/types';
import { newId } from '../../lib/id';
import { SAMPLE_TEMPLATES } from './vzory';

/** Inserts the sample templates whose names don't exist yet; returns how many were added. */
export async function insertSampleTemplates(db: Db, now = Date.now()): Promise<number> {
  let added = 0;
  for (const t of SAMPLE_TEMPLATES) {
    const exists = await db.getFirstAsync('SELECT 1 FROM templates WHERE name = ? AND kind = ?', t.name, t.kind);
    if (exists) continue;
    await db.runAsync(
      'INSERT INTO templates (id, name, icon, kind, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      newId(),
      t.name,
      t.icon,
      t.kind,
      JSON.stringify(t.payload),
      now,
    );
    added++;
  }
  return added;
}
