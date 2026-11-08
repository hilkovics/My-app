// Conversion of the old habits tables (schema ≤ 3) into activities. Used by migration v4 and by
// importing an older backup. Kept free of app imports so the schema module can use it.
import type { Db, SqlParam } from '../../db/types';
import { parseYmd } from '../../lib/dates';
import { newId } from '../../lib/id';

export interface LegacyHabit {
  id: string;
  name: string;
  icon: string;
  color: string;
  days: string;
  target_per_day: number;
  archived: number;
  created_at: number;
}

export interface LegacyHabitLog {
  habit_id: string;
  date: string;
  count: number;
}

export type Row = Record<string, SqlParam>;

export function habitsToActivities(habits: LegacyHabit[], logs: LegacyHabitLog[]): { activities: Row[]; logs: Row[] } {
  const activities = habits.map((h, i) => ({
    id: h.id,
    name: h.name,
    icon: h.icon,
    color_slot: i % 8,
    kind: 'check',
    track_distance: 0,
    track_rating: 0,
    days: h.days,
    target_per_day: h.target_per_day,
    goal_type: null,
    goal_value: null,
    archived: h.archived,
    position: i,
    created_at: h.created_at,
  }));
  const ids = new Set(habits.map((h) => h.id));
  const out = logs
    .filter((l) => ids.has(l.habit_id) && l.count > 0)
    .map((l) => {
      const t = parseYmd(l.date);
      return {
        id: newId(),
        activity_id: l.habit_id,
        day: l.date,
        started_at: t,
        ended_at: t,
        paused_ms: 0,
        count: l.count,
        note: '',
        created_at: t,
      };
    });
  return { activities, logs: out };
}

export async function insertRows(db: Db, table: string, rows: Row[]): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
    if (!cols.length) continue;
    await db.runAsync(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      ...cols.map((c) => row[c] ?? null),
    );
  }
}
