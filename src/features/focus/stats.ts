// Pure statistics over focus sessions. Sessions crossing midnight (or an hour boundary)
// are split proportionally, so every minute is counted on the day/hour it happened.
import { HOUR, MINUTE, addDays, startOfDay, ymd } from '../../lib/dates';

export interface SessionTimes {
  startedAt: number;
  endedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
}

/** Worked milliseconds (pauses excluded). Running sessions count up to `now`. */
export function sessionDuration(s: SessionTimes, now = Date.now()): number {
  const end = s.endedAt ?? now;
  const pausedOpen = s.endedAt == null && s.pausedAt != null ? Math.max(0, now - s.pausedAt) : 0;
  return Math.max(0, end - s.startedAt - s.pausedMs - pausedOpen);
}

/**
 * Worked time spread over the wall-clock span [start, end]. Pauses are spread evenly over the
 * span (we don't store individual pause intervals), which is accurate enough for statistics.
 */
function spread(
  s: SessionTimes,
  now: number,
  bucketStart: (t: number) => number,
  next: (t: number) => number,
  cb: (bucket: number, ms: number) => void,
) {
  const end = s.endedAt ?? now;
  const span = end - s.startedAt;
  if (span <= 0) return;
  const ratio = Math.min(1, sessionDuration(s, now) / span);
  let t = s.startedAt;
  while (t < end) {
    const b = bucketStart(t);
    const nb = Math.min(next(b), end);
    cb(b, (nb - t) * ratio);
    t = nb;
  }
}

/** Minutes per day (key = YYYY-MM-DD). */
export function minutesByDay(sessions: SessionTimes[], now = Date.now()): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessions) {
    spread(s, now, startOfDay, (d) => addDays(d, 1), (day, ms) => {
      const k = ymd(day);
      out.set(k, (out.get(k) ?? 0) + ms / MINUTE);
    });
  }
  return out;
}

/** Minutes per hour of day (24 buckets), e.g. to see when you focus best. */
export function minutesByHour(sessions: SessionTimes[], now = Date.now()): number[] {
  const out = new Array<number>(24).fill(0);
  for (const s of sessions) {
    spread(
      s,
      now,
      (t) => Math.floor(t / HOUR) * HOUR,
      (h) => h + HOUR,
      (h, ms) => {
        out[new Date(h).getHours()] += ms / MINUTE;
      },
    );
  }
  return out;
}

/** Totals for consecutive days starting at `from` (day starts). */
export function dailySeries(byDay: Map<string, number>, from: number, days: number): { day: number; minutes: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(startOfDay(from), i);
    return { day, minutes: byDay.get(ymd(day)) ?? 0 };
  });
}

/**
 * Consecutive days reaching the goal, ending today. Today counts once reached;
 * if not reached yet, the streak continues from yesterday (it isn't broken yet).
 */
export function goalStreak(byDay: Map<string, number>, goalMinutes: number, today = Date.now()): number {
  if (goalMinutes <= 0) return 0;
  let day = startOfDay(today);
  let streak = 0;
  if ((byDay.get(ymd(day)) ?? 0) < goalMinutes) day = addDays(day, -1);
  for (let i = 0; i < 3660; i++, day = addDays(day, -1)) {
    if ((byDay.get(ymd(day)) ?? 0) >= goalMinutes) streak++;
    else break;
  }
  return streak;
}

export interface PeriodSummary {
  totalMinutes: number;
  /** Average over days of the period up to today (future days excluded). */
  avgMinutes: number;
  best: { day: number; minutes: number } | null;
  daysWithGoal: number;
}

export function summarize(series: { day: number; minutes: number }[], goalMinutes: number, today = Date.now()): PeriodSummary {
  const past = series.filter((d) => d.day <= startOfDay(today));
  const total = past.reduce((a, d) => a + d.minutes, 0);
  const best = past.reduce<{ day: number; minutes: number } | null>((b, d) => (d.minutes > (b?.minutes ?? 0) ? d : b), null);
  return {
    totalMinutes: total,
    avgMinutes: past.length ? total / past.length : 0,
    best,
    daysWithGoal: past.filter((d) => goalMinutes > 0 && d.minutes >= goalMinutes).length,
  };
}

/** The 2-hour window with the most focus, e.g. [9, 11], or null without data. */
export function bestWindow(byHour: number[]): [number, number] | null {
  let best = -1;
  let at = 0;
  for (let h = 0; h < 24; h++) {
    const v = byHour[h] + byHour[(h + 1) % 24];
    if (v > best) {
      best = v;
      at = h;
    }
  }
  return best > 0 ? [at, (at + 2) % 24] : null;
}

/** "2 h 05 min", "45 min", "0 min" */
export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')} min` : `${h} h`;
}

/** Clock display for a running timer: "1:05:09" or "25:00". */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
