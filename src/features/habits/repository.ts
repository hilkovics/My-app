import { notifyChange } from '../../db/changes';
import type { Db, Habit } from '../../db/types';
import { newId } from '../../lib/id';

interface HabitRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  days: string;
  target_per_day: number;
  archived: number;
  created_at: number;
}

function toHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    days: r.days,
    targetPerDay: r.target_per_day,
    archived: !!r.archived,
    createdAt: r.created_at,
  };
}

export type HabitInput = Pick<Habit, 'name'> & Partial<Omit<Habit, 'id' | 'createdAt'>>;

export async function createHabit(db: Db, input: HabitInput, now = Date.now()): Promise<Habit> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO habits (id, name, icon, color, days, target_per_day, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    input.name.trim(),
    input.icon ?? '✓',
    input.color ?? '#3c87f7',
    input.days ?? '1111111',
    Math.max(1, input.targetPerDay ?? 1),
    input.archived ? 1 : 0,
    now,
  );
  notifyChange();
  return (await getHabit(db, id))!;
}

export async function updateHabit(db: Db, id: string, patch: Partial<HabitInput>): Promise<void> {
  const map: Record<string, string> = {
    name: 'name',
    icon: 'icon',
    color: 'color',
    days: 'days',
    targetPerDay: 'target_per_day',
    archived: 'archived',
  };
  const sets: string[] = [];
  const params: (string | number)[] = [];
  for (const [k, col] of Object.entries(map)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) {
      sets.push(`${col} = ?`);
      params.push(typeof v === 'boolean' ? (v ? 1 : 0) : (v as string | number));
    }
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE habits SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
  notifyChange();
}

export async function deleteHabit(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM habits WHERE id = ?', id);
  notifyChange();
}

export async function getHabit(db: Db, id: string): Promise<Habit | null> {
  const r = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', id);
  return r ? toHabit(r) : null;
}

export async function listHabits(db: Db, includeArchived = false): Promise<Habit[]> {
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT * FROM habits ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY archived, created_at`,
  );
  return rows.map(toHabit);
}

/** Adds `delta` to the day's count (never below 0). */
export async function logHabit(db: Db, habitId: string, date: string, delta: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO habit_logs (habit_id, date, count) VALUES (?, ?, MAX(0, ?))
     ON CONFLICT (habit_id, date) DO UPDATE SET count = MAX(0, count + ?)`,
    habitId,
    date,
    delta,
    delta,
  );
  await db.runAsync('DELETE FROM habit_logs WHERE count = 0');
  notifyChange();
}

/** Map of habitId → (date → count) for dates in [from, to] (YYYY-MM-DD, inclusive). */
export async function getHabitLogs(db: Db, from: string, to: string): Promise<Map<string, Map<string, number>>> {
  const rows = await db.getAllAsync<{ habit_id: string; date: string; count: number }>(
    'SELECT habit_id, date, count FROM habit_logs WHERE date >= ? AND date <= ?',
    from,
    to,
  );
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!out.has(r.habit_id)) out.set(r.habit_id, new Map());
    out.get(r.habit_id)!.set(r.date, r.count);
  }
  return out;
}
