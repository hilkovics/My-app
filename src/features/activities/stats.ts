// Pure statistics for activities: day values for the year map, weekly mix, weekly goals and streaks.
import { MINUTE, addDays, startOfDay, startOfWeek, weekdayIndex, ymd } from '../../lib/dates';
import { logDuration, type Activity, type ActivityLog } from './repository';

export const MAX_MIX_SERIES = 8;

// ---------------------------------------------------------------- Day values / year map

/** Minutes per day for timed activities, ticks per day for check activities. */
export function dayValues(logs: ActivityLog[], activity: Pick<Activity, 'kind'>, now = Date.now()): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of logs) {
    const v = activity.kind === 'check' ? l.count : logDuration(l, now) / MINUTE;
    if (v > 0) out.set(l.day, (out.get(l.day) ?? 0) + v);
  }
  return out;
}

/** Whether an activity counts as "done" on a day (any time logged, or the daily target reached). */
function doneOnDay(a: Activity, value: number): boolean {
  return a.kind === 'check' ? value >= a.targetPerDay : value > 0;
}

/** Overall year map value: number of different activities done each day. */
export function activitiesPerDay(logs: ActivityLog[], activities: Activity[], now = Date.now()): Map<string, number> {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const perActivityDay = new Map<string, number>();
  for (const l of logs) {
    const a = byId.get(l.activityId);
    if (!a) continue;
    const key = `${l.activityId}|${l.day}`;
    const v = a.kind === 'check' ? l.count : logDuration(l, now) / MINUTE;
    perActivityDay.set(key, (perActivityDay.get(key) ?? 0) + v);
  }
  const out = new Map<string, number>();
  for (const [key, v] of perActivityDay) {
    const [id, day] = key.split('|');
    if (doneOnDay(byId.get(id)!, v)) out.set(day, (out.get(day) ?? 0) + 1);
  }
  return out;
}

/** Scale for the colour levels: the daily target if there is one, otherwise the 90th percentile of non-zero days. */
export function heatScale(values: Iterable<number>, target?: number | null): number {
  if (target && target > 0) return target;
  const nz = [...values].filter((v) => v > 0).sort((a, b) => a - b);
  if (!nz.length) return 1;
  return Math.max(1e-9, nz[Math.min(nz.length - 1, Math.floor(nz.length * 0.9))]);
}

/** 0 = nothing, 1–4 = increasing intensity. */
export function heatLevel(value: number, scale: number): number {
  if (value <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((4 * value) / scale)));
}

/** Weeks (Monday first) of day starts, the last week containing `today`. */
export function yearGrid(today = Date.now(), weeks = 53): number[][] {
  const first = addDays(startOfWeek(startOfDay(today)), -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
}

// ---------------------------------------------------------------- Weeks

/** `n` week starts ending with the current week. */
export function recentWeekStarts(today = Date.now(), n = 12): number[] {
  const cur = startOfWeek(startOfDay(today));
  return Array.from({ length: n }, (_, i) => addDays(cur, (i - n + 1) * 7));
}

function weekKey(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return startOfWeek(new Date(y, m - 1, d).getTime());
}

export interface MixSeries {
  key: string;
  name: string;
  colorSlot: number | null; // null = "Ostatné"
}

export interface WeeklyMix {
  series: MixSeries[];
  /** values[w][s] = minutes of series s in week w */
  values: number[][];
  weekStarts: number[];
}

/** Minutes per week split by timed activity; beyond MAX_MIX_SERIES the smallest fold into "Ostatné". */
export function weeklyMix(logs: ActivityLog[], activities: Activity[], weekStarts: number[], now = Date.now()): WeeklyMix {
  const timed = activities.filter((a) => a.kind === 'timed');
  const index = new Map(weekStarts.map((w, i) => [w, i]));
  const perActivity = new Map<string, number[]>();
  for (const l of logs) {
    const wi = index.get(weekKey(l.day));
    if (wi == null) continue;
    if (!timed.some((a) => a.id === l.activityId)) continue;
    const arr = perActivity.get(l.activityId) ?? new Array<number>(weekStarts.length).fill(0);
    arr[wi] += logDuration(l, now) / MINUTE;
    perActivity.set(l.activityId, arr);
  }
  const total = (id: string) => (perActivity.get(id) ?? []).reduce((a, b) => a + b, 0);
  // Keep the activities' own order (colour follows the entity, never its rank).
  const withData = timed.filter((a) => total(a.id) > 0);
  let kept = withData;
  let other: string[] = [];
  if (withData.length > MAX_MIX_SERIES) {
    const top = new Set(
      [...withData]
        .sort((a, b) => total(b.id) - total(a.id))
        .slice(0, MAX_MIX_SERIES - 1)
        .map((a) => a.id),
    );
    kept = withData.filter((a) => top.has(a.id));
    other = withData.filter((a) => !top.has(a.id)).map((a) => a.id);
  }
  const series: MixSeries[] = kept.map((a) => ({ key: a.id, name: `${a.icon} ${a.name}`, colorSlot: a.colorSlot }));
  if (other.length) series.push({ key: 'other', name: 'Ostatné', colorSlot: null });
  const values = weekStarts.map((_, wi) => {
    const row = kept.map((a) => perActivity.get(a.id)?.[wi] ?? 0);
    if (other.length) row.push(other.reduce((acc, id) => acc + (perActivity.get(id)?.[wi] ?? 0), 0));
    return row;
  });
  return { series, values, weekStarts };
}

/** Progress towards the weekly goal in the goal's unit (sessions, minutes or km). */
export function weekValue(a: Activity, logs: ActivityLog[], weekStart: number, now = Date.now()): number {
  const end = addDays(weekStart, 7);
  const inWeek = logs.filter((l) => {
    if (l.activityId !== a.id) return false;
    const [y, m, d] = l.day.split('-').map(Number);
    const t = new Date(y, m - 1, d).getTime();
    return t >= weekStart && t < end;
  });
  switch (a.goalType) {
    case 'minutes':
      return inWeek.reduce((acc, l) => acc + logDuration(l, now), 0) / MINUTE;
    case 'km':
      return inWeek.reduce((acc, l) => acc + (l.distanceM ?? 0), 0) / 1000;
    case 'sessions':
    default:
      return a.kind === 'check'
        ? inWeek.filter((l) => l.count >= a.targetPerDay).length
        : inWeek.filter((l) => logDuration(l, now) > 0).length;
  }
}

/**
 * Consecutive weeks with the weekly goal met, ending with the current week.
 * The current week counts once met; until then the streak continues from last week.
 */
export function weekStreak(a: Activity, logs: ActivityLog[], today = Date.now()): number {
  if (!a.goalType || !a.goalValue) return 0;
  let week = startOfWeek(startOfDay(today));
  if (weekValue(a, logs, week, today) < a.goalValue) week = addDays(week, -7);
  const firstWeek = startOfWeek(startOfDay(a.createdAt));
  let n = 0;
  for (let i = 0; i < 520 && week >= firstWeek; i++, week = addDays(week, -7)) {
    if (weekValue(a, logs, week, today) >= a.goalValue) n++;
    else break;
  }
  return n;
}

// ---------------------------------------------------------------- Check activities (former habits)

export function isScheduled(a: Pick<Activity, 'days'>, day: number): boolean {
  return a.days[weekdayIndex(day)] === '1';
}

/**
 * Consecutive scheduled days meeting the daily target, ending today. If today is scheduled but
 * not done yet, the streak counts from yesterday. Unscheduled days are skipped.
 */
export function dayStreak(a: Pick<Activity, 'days' | 'targetPerDay' | 'createdAt'>, counts: Map<string, number> | undefined, today = Date.now()): number {
  if (!a.days.includes('1')) return 0;
  const created = startOfDay(a.createdAt);
  let day = startOfDay(today);
  let streak = 0;
  let first = true;
  for (let i = 0; i < 3660 && day >= created; i++, day = addDays(day, -1)) {
    if (!isScheduled(a, day)) continue;
    const done = (counts?.get(ymd(day)) ?? 0) >= a.targetPerDay;
    if (done) streak++;
    else if (!first) break;
    first = false;
  }
  return streak;
}

/** Share of scheduled days in the last `days` days that met the target. */
export function completionRate(a: Pick<Activity, 'days' | 'targetPerDay' | 'createdAt'>, counts: Map<string, number> | undefined, days = 30, today = Date.now()): number {
  let scheduled = 0;
  let done = 0;
  const created = startOfDay(a.createdAt);
  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(today), -i);
    if (day < created) break;
    if (!isScheduled(a, day)) continue;
    scheduled++;
    if ((counts?.get(ymd(day)) ?? 0) >= a.targetPerDay) done++;
  }
  return scheduled ? done / scheduled : 0;
}

// ---------------------------------------------------------------- Formatting

/** "5,2 km" */
export function fmtDistance(m: number): string {
  return `${String(Number((m / 1000).toFixed(m >= 10_000 ? 1 : 2))).replace('.', ',')} km`;
}

/** Running pace, "5:23 /km". */
export function fmtPace(durationMs: number, distanceM: number): string | null {
  if (!distanceM || durationMs <= 0) return null;
  const secPerKm = Math.round(durationMs / 1000 / (distanceM / 1000));
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`;
}

export function fmtGoal(a: Pick<Activity, 'goalType' | 'goalValue'>, value: number): string {
  const v = Math.round(value * 10) / 10;
  const g = a.goalValue ?? 0;
  switch (a.goalType) {
    case 'minutes':
      return `${Math.round(value)}/${g} min`;
    case 'km':
      return `${String(v).replace('.', ',')}/${String(g).replace('.', ',')} km`;
    default:
      return `${Math.round(value)}/${g}×`;
  }
}
