import { notifyChange } from '../../db/changes';
import type { Db } from '../../db/types';
import { MINUTE } from '../../lib/dates';
import { newId } from '../../lib/id';
import { getItem } from '../items/repository';
import { sessionDuration } from './stats';

export type FocusMode = 'stopwatch' | 'pomodoro';

export interface FocusSession {
  id: string;
  mode: FocusMode;
  startedAt: number;
  endedAt: number | null;
  plannedMinutes: number | null;
  pausedAt: number | null;
  pausedMs: number;
  itemId: string | null;
  itemTitle: string | null;
  tag: string | null;
  note: string;
}

interface Row {
  id: string;
  mode: FocusMode;
  started_at: number;
  ended_at: number | null;
  planned_minutes: number | null;
  paused_at: number | null;
  paused_ms: number;
  item_id: string | null;
  item_title: string | null;
  tag: string | null;
  note: string;
}

const SELECT = `SELECT f.*, i.title AS item_title FROM focus_sessions f LEFT JOIN items i ON i.id = f.item_id`;

const toSession = (r: Row): FocusSession => ({
  id: r.id,
  mode: r.mode,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  plannedMinutes: r.planned_minutes,
  pausedAt: r.paused_at,
  pausedMs: r.paused_ms,
  itemId: r.item_id,
  itemTitle: r.item_title,
  tag: r.tag,
  note: r.note,
});

/** Sessions shorter than this are discarded when stopped (accidental taps). */
export const MIN_SESSION_MS = MINUTE;

export async function getRunningSession(db: Db): Promise<FocusSession | null> {
  const r = await db.getFirstAsync<Row>(`${SELECT} WHERE f.ended_at IS NULL LIMIT 1`);
  return r ? toSession(r) : null;
}

export interface StartInput {
  mode: FocusMode;
  plannedMinutes?: number | null;
  itemId?: string | null;
  /** Defaults to the item's first tag. */
  tag?: string | null;
  note?: string;
}

/** Starts a session (stopping any running one first). */
export async function startSession(db: Db, input: StartInput, now = Date.now()): Promise<FocusSession> {
  await stopSession(db, now);
  let tag = input.tag?.trim().replace(/^#/, '') || null;
  if (!tag && input.itemId) tag = (await getItem(db, input.itemId))?.tags[0] ?? null;
  const id = newId();
  await db.runAsync(
    'INSERT INTO focus_sessions (id, mode, started_at, planned_minutes, item_id, tag, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    input.mode,
    now,
    input.mode === 'pomodoro' ? Math.max(1, Math.round(input.plannedMinutes ?? 25)) : null,
    input.itemId ?? null,
    tag,
    input.note ?? '',
  );
  notifyChange();
  return (await getRunningSession(db))!;
}

export async function pauseSession(db: Db, now = Date.now()): Promise<void> {
  await db.runAsync('UPDATE focus_sessions SET paused_at = ? WHERE ended_at IS NULL AND paused_at IS NULL', now);
  notifyChange();
}

export async function resumeSession(db: Db, now = Date.now()): Promise<void> {
  await db.runAsync(
    'UPDATE focus_sessions SET paused_ms = paused_ms + MAX(0, ? - paused_at), paused_at = NULL WHERE ended_at IS NULL AND paused_at IS NOT NULL',
    now,
  );
  notifyChange();
}

/** When a running Pomodoro reaches its planned length (wall-clock time), or null. */
export function pomodoroEndsAt(s: FocusSession): number | null {
  if (s.mode !== 'pomodoro' || s.plannedMinutes == null || s.endedAt != null || s.pausedAt != null) return null;
  return s.startedAt + s.pausedMs + s.plannedMinutes * MINUTE;
}

/**
 * Stops the running session. A Pomodoro that ran over is cut at its planned end.
 * Returns the finished session, or null if none was running or it was too short (then it is deleted).
 */
export async function stopSession(db: Db, now = Date.now()): Promise<FocusSession | null> {
  const s = await getRunningSession(db);
  if (!s) return null;
  let end = now;
  let pausedMs = s.pausedMs;
  if (s.pausedAt != null) {
    // Stopping while paused: the pause lasts until now.
    pausedMs += Math.max(0, now - s.pausedAt);
  }
  const due = pomodoroEndsAt(s);
  if (due != null && due < end) end = due;
  const finished = { ...s, endedAt: end, pausedAt: null, pausedMs };
  if (sessionDuration(finished, end) < MIN_SESSION_MS) {
    await db.runAsync('DELETE FROM focus_sessions WHERE id = ?', s.id);
    notifyChange();
    return null;
  }
  await db.runAsync(
    'UPDATE focus_sessions SET ended_at = ?, paused_at = NULL, paused_ms = ? WHERE id = ?',
    end,
    pausedMs,
    s.id,
  );
  notifyChange();
  return finished;
}

/** Finishes a Pomodoro whose time is up (app was closed or in background). */
export async function finishDuePomodoro(db: Db, now = Date.now()): Promise<FocusSession | null> {
  const s = await getRunningSession(db);
  const due = s && pomodoroEndsAt(s);
  return due != null && due <= now ? stopSession(db, now) : null;
}

/** Sessions overlapping [from, to), including a running one. */
export async function listSessions(db: Db, from: number, to: number): Promise<FocusSession[]> {
  const rows = await db.getAllAsync<Row>(
    `${SELECT} WHERE f.started_at < ? AND COALESCE(f.ended_at, ?) > ? ORDER BY f.started_at`,
    to,
    Number.MAX_SAFE_INTEGER,
    from,
  );
  return rows.map(toSession);
}

export async function updateSession(
  db: Db,
  id: string,
  patch: Partial<Pick<FocusSession, 'tag' | 'note' | 'itemId'>>,
): Promise<void> {
  const sets: string[] = [];
  const params: (string | null)[] = [];
  if ('tag' in patch) {
    sets.push('tag = ?');
    params.push(patch.tag?.trim().replace(/^#/, '') || null);
  }
  if ('note' in patch) {
    sets.push('note = ?');
    params.push(patch.note ?? '');
  }
  if ('itemId' in patch) {
    sets.push('item_id = ?');
    params.push(patch.itemId ?? null);
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE focus_sessions SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
  notifyChange();
}

export async function deleteSession(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM focus_sessions WHERE id = ?', id);
  notifyChange();
}

/** Puts a deleted session back (undo of a delete), keeping its id. */
export async function restoreSession(db: Db, s: FocusSession): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO focus_sessions (id, mode, started_at, ended_at, planned_minutes, paused_at, paused_ms, item_id, tag, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    s.id,
    s.mode,
    s.startedAt,
    s.endedAt,
    s.plannedMinutes,
    s.pausedAt,
    s.pausedMs,
    s.itemId,
    s.tag,
    s.note,
  );
  notifyChange();
}

/** Total worked minutes on an item (finished and running sessions). */
export async function itemFocusMinutes(db: Db, itemId: string, now = Date.now()): Promise<number> {
  const rows = await db.getAllAsync<Row>(`${SELECT} WHERE f.item_id = ?`, itemId);
  return rows.map(toSession).reduce((a, s) => a + sessionDuration(s, now), 0) / MINUTE;
}

/** Tags used in focus sessions, most used first (for quick picking). */
export async function listFocusTags(db: Db, limit = 12): Promise<string[]> {
  const rows = await db.getAllAsync<{ tag: string }>(
    'SELECT tag FROM focus_sessions WHERE tag IS NOT NULL GROUP BY tag ORDER BY COUNT(*) DESC, MAX(started_at) DESC LIMIT ?',
    limit,
  );
  return rows.map((r) => r.tag);
}
