import { notifyChange } from '../../db/changes';
import type { Db, SqlParam } from '../../db/types';
import { MINUTE, ymd } from '../../lib/dates';
import { newId } from '../../lib/id';
import { sessionDuration } from '../focus/stats';

export type ActivityKind = 'timed' | 'check';
export type GoalType = 'sessions' | 'minutes' | 'km';

export interface Activity {
  id: string;
  name: string;
  icon: string;
  /** Index into the validated categorical palette (0–7). */
  colorSlot: number;
  /** timed = measured sessions (instrument, running); check = daily tick-off (former habits). */
  kind: ActivityKind;
  trackDistance: boolean;
  trackRating: boolean;
  /** check: 7 chars, Monday first, '1' = scheduled. */
  days: string;
  /** check: ticks needed per day. */
  targetPerDay: number;
  /** Weekly goal. */
  goalType: GoalType | null;
  goalValue: number | null;
  archived: boolean;
  position: number;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  activityId: string;
  /** Local date (YYYY-MM-DD) of the start. */
  day: string;
  startedAt: number;
  /** null = timer running */
  endedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
  /** Set for manual entries; timer entries derive it from start/end/pauses. */
  durationMs: number | null;
  distanceM: number | null;
  /** check activities: ticks that day */
  count: number;
  rating: number | null;
  note: string;
  createdAt: number;
}

interface ActivityRow {
  id: string;
  name: string;
  icon: string;
  color_slot: number;
  kind: ActivityKind;
  track_distance: number;
  track_rating: number;
  days: string;
  target_per_day: number;
  goal_type: GoalType | null;
  goal_value: number | null;
  archived: number;
  position: number;
  created_at: number;
}

interface LogRow {
  id: string;
  activity_id: string;
  day: string;
  started_at: number;
  ended_at: number | null;
  paused_at: number | null;
  paused_ms: number;
  duration_ms: number | null;
  distance_m: number | null;
  count: number;
  rating: number | null;
  note: string;
  created_at: number;
}

const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  colorSlot: r.color_slot,
  kind: r.kind,
  trackDistance: !!r.track_distance,
  trackRating: !!r.track_rating,
  days: r.days,
  targetPerDay: r.target_per_day,
  goalType: r.goal_type,
  goalValue: r.goal_value,
  archived: !!r.archived,
  position: r.position,
  createdAt: r.created_at,
});

const toLog = (r: LogRow): ActivityLog => ({
  id: r.id,
  activityId: r.activity_id,
  day: r.day,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  pausedAt: r.paused_at,
  pausedMs: r.paused_ms,
  durationMs: r.duration_ms,
  distanceM: r.distance_m,
  count: r.count,
  rating: r.rating,
  note: r.note,
  createdAt: r.created_at,
});

/** Worked milliseconds of a log entry (0 for check ticks). */
export function logDuration(l: Pick<ActivityLog, 'durationMs' | 'startedAt' | 'endedAt' | 'pausedAt' | 'pausedMs' | 'count'>, now = Date.now()): number {
  if (l.durationMs != null) return l.durationMs;
  if (l.count > 0) return 0; // check tick, not a timed session
  return sessionDuration(l, now);
}

/** Entries shorter than this are discarded when a timer is stopped. */
export const MIN_LOG_MS = MINUTE;

// ---------------------------------------------------------------- Activities

export type ActivityInput = Pick<Activity, 'name' | 'kind'> & Partial<Omit<Activity, 'id' | 'createdAt' | 'position'>>;

const ACTIVITY_COLUMNS: Record<string, string> = {
  name: 'name',
  icon: 'icon',
  colorSlot: 'color_slot',
  kind: 'kind',
  trackDistance: 'track_distance',
  trackRating: 'track_rating',
  days: 'days',
  targetPerDay: 'target_per_day',
  goalType: 'goal_type',
  goalValue: 'goal_value',
  archived: 'archived',
};

function param(v: unknown): SqlParam {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as SqlParam;
}

export async function createActivity(db: Db, input: ActivityInput, now = Date.now()): Promise<Activity> {
  const stats = await db.getFirstAsync<{ n: number; p: number | null }>('SELECT COUNT(*) AS n, MAX(position) AS p FROM activities');
  const id = newId();
  const values: Record<string, unknown> = {
    icon: '⭐',
    colorSlot: (stats?.n ?? 0) % 8,
    days: '1111111',
    targetPerDay: 1,
    ...input,
    name: input.name.trim(),
  };
  const cols = ['id', 'position', 'created_at'];
  const params: SqlParam[] = [id, (stats?.p ?? -1) + 1, now];
  for (const [k, col] of Object.entries(ACTIVITY_COLUMNS)) {
    if (values[k] !== undefined) {
      cols.push(col);
      params.push(param(values[k]));
    }
  }
  await db.runAsync(`INSERT INTO activities (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...params);
  notifyChange();
  return (await getActivity(db, id))!;
}

export async function updateActivity(db: Db, id: string, patch: Partial<ActivityInput>): Promise<void> {
  const sets: string[] = [];
  const params: SqlParam[] = [];
  for (const [k, col] of Object.entries(ACTIVITY_COLUMNS)) {
    if (k in patch) {
      sets.push(`${col} = ?`);
      params.push(param((patch as Record<string, unknown>)[k]));
    }
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE activities SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
  notifyChange();
}

export async function deleteActivity(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM activities WHERE id = ?', id);
  notifyChange();
}

export async function getActivity(db: Db, id: string): Promise<Activity | null> {
  const r = await db.getFirstAsync<ActivityRow>('SELECT * FROM activities WHERE id = ?', id);
  return r ? toActivity(r) : null;
}

export async function listActivities(db: Db, includeArchived = false): Promise<Activity[]> {
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT * FROM activities ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY archived, position, created_at`,
  );
  return rows.map(toActivity);
}

// ---------------------------------------------------------------- Check (habit-style) ticks

/** Adds `delta` ticks to a check activity for a day (never below 0). */
export async function logCheck(db: Db, activityId: string, day: string, delta: number, now = Date.now()): Promise<void> {
  const row = await db.getFirstAsync<{ id: string; count: number }>(
    'SELECT id, count FROM activity_logs WHERE activity_id = ? AND day = ? AND count > 0 LIMIT 1',
    activityId,
    day,
  );
  const next = Math.max(0, (row?.count ?? 0) + delta);
  if (row && next === 0) await db.runAsync('DELETE FROM activity_logs WHERE id = ?', row.id);
  else if (row) await db.runAsync('UPDATE activity_logs SET count = ? WHERE id = ?', next, row.id);
  else if (next > 0) {
    const [y, m, d] = day.split('-').map(Number);
    const t = new Date(y, m - 1, d).getTime();
    await db.runAsync(
      'INSERT INTO activity_logs (id, activity_id, day, started_at, ended_at, count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newId(),
      activityId,
      day,
      t,
      t,
      next,
      now,
    );
  }
  notifyChange();
}

// ---------------------------------------------------------------- Timer

export async function getRunningActivity(db: Db): Promise<ActivityLog | null> {
  const r = await db.getFirstAsync<LogRow>('SELECT * FROM activity_logs WHERE ended_at IS NULL LIMIT 1');
  return r ? toLog(r) : null;
}

/** Starts a timer for an activity (stopping any running one first). */
export async function startActivity(db: Db, activityId: string, now = Date.now()): Promise<ActivityLog> {
  await stopActivity(db, now);
  await db.runAsync(
    'INSERT INTO activity_logs (id, activity_id, day, started_at, created_at) VALUES (?, ?, ?, ?, ?)',
    newId(),
    activityId,
    ymd(now),
    now,
    now,
  );
  notifyChange();
  return (await getRunningActivity(db))!;
}

export async function pauseActivity(db: Db, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE activity_logs SET paused_at = ? WHERE ended_at IS NULL AND paused_at IS NULL', now);
  notifyChange();
}

export async function resumeActivity(db: Db, now = Date.now()): Promise<void> {
  await db.runAsync(
    'UPDATE activity_logs SET paused_ms = paused_ms + MAX(0, ? - paused_at), paused_at = NULL WHERE ended_at IS NULL AND paused_at IS NOT NULL',
    now,
  );
  notifyChange();
}

/** Stops the running timer; returns the saved entry, or null if none ran or it was too short (deleted). */
export async function stopActivity(db: Db, now = Date.now()): Promise<ActivityLog | null> {
  const run = await getRunningActivity(db);
  if (!run) return null;
  const pausedMs = run.pausedMs + (run.pausedAt != null ? Math.max(0, now - run.pausedAt) : 0);
  const done = { ...run, endedAt: now, pausedAt: null, pausedMs };
  if (logDuration(done, now) < MIN_LOG_MS) {
    await db.runAsync('DELETE FROM activity_logs WHERE id = ?', run.id);
    notifyChange();
    return null;
  }
  await db.runAsync('UPDATE activity_logs SET ended_at = ?, paused_at = NULL, paused_ms = ? WHERE id = ?', now, pausedMs, run.id);
  notifyChange();
  return done;
}

// ---------------------------------------------------------------- Manual entries

export interface ManualLogInput {
  activityId: string;
  startedAt: number;
  minutes: number;
  distanceKm?: number | null;
  rating?: number | null;
  note?: string;
}

export async function addManualLog(db: Db, input: ManualLogInput, now = Date.now()): Promise<ActivityLog> {
  const id = newId();
  const dur = Math.max(0, Math.round(input.minutes * MINUTE));
  await db.runAsync(
    `INSERT INTO activity_logs (id, activity_id, day, started_at, ended_at, duration_ms, distance_m, rating, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.activityId,
    ymd(input.startedAt),
    input.startedAt,
    input.startedAt + dur,
    dur,
    input.distanceKm != null ? Math.round(input.distanceKm * 1000) : null,
    input.rating ?? null,
    input.note ?? '',
    now,
  );
  notifyChange();
  return (await getLog(db, id))!;
}

export interface LogPatch {
  startedAt?: number;
  minutes?: number;
  distanceKm?: number | null;
  rating?: number | null;
  note?: string;
}

/** Edits an entry. Setting minutes turns it into a fixed duration (pauses no longer matter). */
export async function updateLog(db: Db, id: string, patch: LogPatch): Promise<void> {
  const log = await getLog(db, id);
  if (!log) return;
  const start = patch.startedAt ?? log.startedAt;
  const dur = patch.minutes != null ? Math.max(0, Math.round(patch.minutes * MINUTE)) : log.durationMs;
  const running = log.endedAt == null;
  await db.runAsync(
    `UPDATE activity_logs SET day = ?, started_at = ?, duration_ms = ?, ended_at = ?, distance_m = ?, rating = ?, note = ? WHERE id = ?`,
    ymd(start),
    start,
    running ? null : dur,
    running ? null : dur != null ? start + dur : log.endedAt! + (start - log.startedAt),
    patch.distanceKm !== undefined ? (patch.distanceKm != null ? Math.round(patch.distanceKm * 1000) : null) : log.distanceM,
    patch.rating !== undefined ? patch.rating : log.rating,
    patch.note ?? log.note,
    id,
  );
  notifyChange();
}

export async function deleteLog(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM activity_logs WHERE id = ?', id);
  notifyChange();
}

export async function getLog(db: Db, id: string): Promise<ActivityLog | null> {
  const r = await db.getFirstAsync<LogRow>('SELECT * FROM activity_logs WHERE id = ?', id);
  return r ? toLog(r) : null;
}

/** Entries with day in [fromDay, toDay] (YYYY-MM-DD, inclusive). */
export async function listLogs(db: Db, fromDay: string, toDay: string, activityId?: string): Promise<ActivityLog[]> {
  const rows = await db.getAllAsync<LogRow>(
    `SELECT * FROM activity_logs WHERE day >= ? AND day <= ? ${activityId ? 'AND activity_id = ?' : ''} ORDER BY started_at`,
    fromDay,
    toDay,
    ...(activityId ? [activityId] : []),
  );
  return rows.map(toLog);
}

/** Newest entries of one activity (the diary). */
export async function listRecentLogs(db: Db, activityId: string, limit = 100): Promise<ActivityLog[]> {
  const rows = await db.getAllAsync<LogRow>(
    'SELECT * FROM activity_logs WHERE activity_id = ? ORDER BY started_at DESC LIMIT ?',
    activityId,
    limit,
  );
  return rows.map(toLog);
}
