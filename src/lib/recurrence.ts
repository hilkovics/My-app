// Minimal RRULE subset: FREQ (DAILY|WEEKLY|MONTHLY|YEARLY), INTERVAL, BYDAY (weekly), UNTIL, COUNT.
// Occurrences keep the local time-of-day of the first occurrence (DST safe).

import { WEEKDAYS_LONG, WEEKDAYS_SHORT, addDays, startOfWeek, weekdayIndex } from './dates';

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Rule {
  freq: Freq;
  interval: number;
  /** Weekdays for WEEKLY rules, Monday = 0 … Sunday = 6. */
  byDay?: number[];
  /** Last allowed occurrence start (inclusive), epoch ms. */
  until?: number;
  /** Total number of occurrences. */
  count?: number;
}

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const FREQS: Freq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const MAX_ITERATIONS = 50_000;

export function parseRule(s: string | null | undefined): Rule | null {
  if (!s) return null;
  const parts = Object.fromEntries(
    s
      .replace(/^RRULE:/i, '')
      .split(';')
      .filter(Boolean)
      .map((p) => {
        const [k, v = ''] = p.split('=');
        return [k.toUpperCase(), v];
      }),
  );
  const freq = parts.FREQ?.toUpperCase() as Freq;
  if (!FREQS.includes(freq)) return null;
  const rule: Rule = { freq, interval: Math.max(1, Number(parts.INTERVAL) || 1) };
  if (parts.BYDAY) {
    const days = parts.BYDAY.toUpperCase()
      .split(',')
      .map((c: string) => DAY_CODES.indexOf(c))
      .filter((i: number) => i >= 0);
    if (days.length) rule.byDay = [...new Set<number>(days)].sort((a, b) => a - b);
  }
  if (parts.UNTIL && /^\d+$/.test(parts.UNTIL)) rule.until = Number(parts.UNTIL);
  if (parts.COUNT && Number(parts.COUNT) > 0) rule.count = Number(parts.COUNT);
  return rule;
}

/** Serialises a rule. UNTIL is stored as epoch ms (app-internal, not RFC 5545). */
export function formatRule(rule: Rule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay?.length) parts.push(`BYDAY=${rule.byDay.map((d) => DAY_CODES[d]).join(',')}`);
  if (rule.until != null) parts.push(`UNTIL=${rule.until}`);
  if (rule.count != null) parts.push(`COUNT=${rule.count}`);
  return parts.join(';');
}

/** RFC 5545 compatible RRULE (for .ics export). */
export function toIcsRule(rule: Rule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay?.length) parts.push(`BYDAY=${rule.byDay.map((d) => DAY_CODES[d]).join(',')}`);
  if (rule.count != null) parts.push(`COUNT=${rule.count}`);
  if (rule.until != null) {
    const u = new Date(rule.until);
    const z = (n: number) => String(n).padStart(2, '0');
    parts.push(
      `UNTIL=${u.getUTCFullYear()}${z(u.getUTCMonth() + 1)}${z(u.getUTCDate())}T${z(u.getUTCHours())}${z(u.getUTCMinutes())}${z(u.getUTCSeconds())}Z`,
    );
  }
  return parts.join(';');
}

export function describeRule(rule: Rule | null): string {
  if (!rule) return 'Neopakuje sa';
  const n = rule.interval;
  let text: string;
  switch (rule.freq) {
    case 'DAILY':
      text = n === 1 ? 'Každý deň' : `Každých ${n} dní`;
      break;
    case 'WEEKLY': {
      const base = n === 1 ? 'Každý týždeň' : `Každých ${n} týždňov`;
      if (rule.byDay?.length === 5 && rule.byDay.every((d) => d < 5)) text = n === 1 ? 'Každý pracovný deň' : `${base} (po–pi)`;
      else if (rule.byDay?.length === 1) text = n === 1 ? `Každý ${WEEKDAYS_LONG[rule.byDay[0]]}` : `${base} (${WEEKDAYS_LONG[rule.byDay[0]]})`;
      else if (rule.byDay?.length) text = `${base} (${rule.byDay.map((d) => WEEKDAYS_SHORT[d]).join(', ')})`;
      else text = base;
      break;
    }
    case 'MONTHLY':
      text = n === 1 ? 'Každý mesiac' : `Každých ${n} mesiacov`;
      break;
    case 'YEARLY':
      text = n === 1 ? 'Každý rok' : `Každých ${n} rokov`;
      break;
  }
  if (rule.count != null) text += `, ${rule.count}×`;
  return text;
}

/**
 * Generates occurrence starts in chronological order, starting with `dtstart`.
 * The callback returns false to stop iteration.
 */
function iterate(dtstart: number, rule: Rule, cb: (start: number) => boolean): void {
  const base = new Date(dtstart);
  const h = base.getHours();
  const mi = base.getMinutes();
  let emitted = 0;
  const emit = (t: number): boolean => {
    if (t < dtstart) return true;
    if (rule.until != null && t > rule.until) return false;
    if (rule.count != null && emitted >= rule.count) return false;
    emitted++;
    return cb(t);
  };

  for (let k = 0; k < MAX_ITERATIONS; k++) {
    switch (rule.freq) {
      case 'DAILY': {
        if (!emit(addDays(dtstart, k * rule.interval))) return;
        break;
      }
      case 'WEEKLY': {
        if (!rule.byDay?.length) {
          if (!emit(addDays(dtstart, k * 7 * rule.interval))) return;
          break;
        }
        const weekStart = addDays(startOfWeek(dtstart), k * 7 * rule.interval);
        for (const day of rule.byDay) {
          const d = new Date(addDays(weekStart, day));
          if (!emit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi).getTime())) return;
        }
        break;
      }
      case 'MONTHLY': {
        const d = new Date(base.getFullYear(), base.getMonth() + k * rule.interval, base.getDate(), h, mi);
        // Skip months that don't contain the day (e.g. the 31st).
        if (d.getDate() !== base.getDate()) break;
        if (!emit(d.getTime())) return;
        break;
      }
      case 'YEARLY': {
        const d = new Date(base.getFullYear() + k * rule.interval, base.getMonth(), base.getDate(), h, mi);
        if (d.getMonth() !== base.getMonth()) break; // Feb 29 in non-leap years
        if (!emit(d.getTime())) return;
        break;
      }
    }
  }
}

/** Occurrence starts whose [start, start+duration] overlaps [from, to). */
export function occurrencesBetween(
  dtstart: number,
  rule: Rule | null,
  from: number,
  to: number,
  durationMs = 0,
): number[] {
  if (!rule) return dtstart < to && dtstart + durationMs >= from ? [dtstart] : [];
  const out: number[] = [];
  iterate(dtstart, rule, (t) => {
    if (t >= to) return false;
    if (t + durationMs >= from) out.push(t);
    return out.length < 2000;
  });
  return out;
}

/** First occurrence start strictly after `after`, or null. */
export function nextOccurrence(dtstart: number, rule: Rule | null, after: number): number | null {
  if (!rule) return dtstart > after ? dtstart : null;
  let found: number | null = null;
  iterate(dtstart, rule, (t) => {
    if (t > after) {
      found = t;
      return false;
    }
    return true;
  });
  return found;
}

export function weekdayOf(t: number): number {
  return weekdayIndex(t);
}
