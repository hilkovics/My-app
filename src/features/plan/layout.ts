// Day plan: turns the occurrences of one day into cards with a size proportional to their duration,
// a look by how demanding they are, and a position on a 24-hour ring. Pure functions, no UI.
//
// Output per entry follows the spec: `dimensions`, `visual_intensity` and `radial_position`.
import type { Energy } from '../../db/types';
import { MINUTE, addDays, minutesOfDay, startOfDay, withTime } from '../../lib/dates';
import type { Occurrence, OccurrenceKind } from '../calendar/agenda';

/** 80 px per hour: 15 min = 20 px, 60 min = 80 px. */
export const PX_PER_HOUR = 80;
/** Assumed for tasks without an estimate (such entries get `guessed: true`). */
export const DEFAULT_ESTIMATE_MIN = 30;
/** Entries up to this length are drawn as thin strips. */
export const COMPACT_MAX_MIN = 15;
/** A gap this long between two blocks counts as a break. */
export const BREAK_GAP_MIN = 15;
/** More than this many deep-work blocks in a row without a break is a burnout risk. */
export const MAX_DEEP_IN_ROW = 2;

export interface PlanSettings {
  capacityMinutes: number;
  sleepStartHour: number;
  sleepEndHour: number;
}

export interface Dimensions {
  /** Height in px, strictly proportional to the duration. */
  height: number;
  /** Offset from the top of the column in px (entries are stacked in order). */
  top: number;
  /** Up to 15 min: drawn as a thin strip without padding. */
  compact: boolean;
}

export interface VisualIntensity {
  energy: Energy;
  /** 1 = strong colour, lower = muted. */
  saturation: number;
  border_width: number;
  opacity: number;
}

export interface RadialPosition {
  /** Degrees, 0 = midnight at the top, clockwise (15° per hour). */
  start_angle: number;
  end_angle: number;
}

export interface PlanEntry {
  key: string;
  /** Local item id, or device event id for kind 'external'. */
  id: string;
  kind: OccurrenceKind;
  title: string;
  color: string | null;
  done: boolean;
  priority: number;
  energy: Energy;
  /** Events can't be shortened or moved by the planner; tasks can. */
  fixed: boolean;
  /** Placed by the planner into free time (the task has no time block of its own). */
  tentative: boolean;
  /** true = the duration is a guess (no estimate set), shown as "~30 min". */
  guessed: boolean;
  start: number | null;
  durationMin: number;
  /** Beyond the day's capacity. */
  overflow: boolean;
  dimensions: Dimensions;
  visual_intensity: VisualIntensity;
  /** null when a task found no free time in the ring. */
  radial_position: RadialPosition | null;
}

export interface BurnoutChain {
  keys: string[];
  deepCount: number;
  totalMinutes: number;
  start: number;
  end: number;
}

export interface BurnoutAudit {
  chains: BurnoutChain[];
  risk: boolean;
}

export interface DayPlan {
  day: number;
  entries: PlanEntry[];
  capacityMinutes: number;
  /** Minutes of work (breaks excluded) in the plan. */
  plannedMinutes: number;
  remainingMinutes: number;
  overflowMinutes: number;
  /** Free waking time left after everything (and, today, after now). */
  freeMinutes: number;
  /** Capacity used up, or no free waking time left. */
  full: boolean;
  /** Where the capacity ends in the stacked column, in px. */
  capacity_line_px: number;
  content_height_px: number;
  sleep: RadialPosition[];
  burnout: BurnoutAudit;
}

// ---------------------------------------------------------------- Intervals

type Interval = [number, number];

function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  const cuts = mergeIntervals(remove);
  const out: Interval[] = [];
  for (const [a, b] of base) {
    let cur = a;
    for (const [c, d] of cuts) {
      if (d <= cur || c >= b) continue;
      if (c > cur) out.push([cur, c]);
      cur = Math.max(cur, d);
    }
    if (cur < b) out.push([cur, b]);
  }
  return out;
}

const totalMs = (list: Interval[]) => list.reduce((acc, [a, b]) => acc + (b - a), 0);

/** Sleep as intervals of the given day (a window like 23→7 wraps around midnight). */
export function sleepIntervals(dayStart: number, s: Pick<PlanSettings, 'sleepStartHour' | 'sleepEndHour'>): Interval[] {
  const at = (h: number) => withTime(dayStart, h, 0);
  const end = addDays(dayStart, 1);
  if (s.sleepStartHour === s.sleepEndHour) return [];
  if (s.sleepStartHour > s.sleepEndHour) return [[dayStart, at(s.sleepEndHour)], [at(s.sleepStartHour), end]];
  return [[at(s.sleepStartHour), at(s.sleepEndHour)]];
}

/** Sleep window as ring angles (split in two when it wraps past midnight). */
export function sleepAngles(s: Pick<PlanSettings, 'sleepStartHour' | 'sleepEndHour'>): RadialPosition[] {
  const a = s.sleepStartHour * 15;
  const b = s.sleepEndHour * 15;
  if (s.sleepStartHour === s.sleepEndHour) return [];
  if (a > b) return [{ start_angle: a, end_angle: 360 }, ...(b > 0 ? [{ start_angle: 0, end_angle: b }] : [])];
  return [{ start_angle: a, end_angle: b }];
}

// ---------------------------------------------------------------- Visuals

export function visualIntensity(energy: Energy): VisualIntensity {
  switch (energy) {
    case 'deep':
      return { energy, saturation: 1, border_width: 3, opacity: 1 };
    case 'rest':
      return { energy, saturation: 0.2, border_width: 1, opacity: 0.6 };
    default:
      return { energy, saturation: 0.35, border_width: 1, opacity: 0.85 };
  }
}

export const heightFor = (minutes: number): number => Math.max(2, (minutes * PX_PER_HOUR) / 60);

const angleOf = (t: number): number => (minutesOfDay(t) / 1440) * 360;

export function radialFor(start: number, durationMin: number): RadialPosition {
  const a = angleOf(start);
  return { start_angle: a, end_angle: Math.min(360, a + (durationMin / 1440) * 360) };
}

// ---------------------------------------------------------------- Plan

interface Draft {
  key: string;
  id: string;
  kind: OccurrenceKind;
  title: string;
  color: string | null;
  done: boolean;
  priority: number;
  energy: Energy;
  fixed: boolean;
  guessed: boolean;
  start: number | null;
  durationMin: number;
}

const ceilTo = (t: number, step: number) => Math.ceil(t / step) * step;

/**
 * Builds the plan of one day.
 * - Events, time blocks and phone events keep their time; tasks due that day without a block get
 *   their estimate (or a guess) and are placed tentatively into the first free waking time.
 * - All-day events don't count (they are informational).
 * - Capacity counts work only; breaks are free.
 */
export function buildDayPlan(occurrences: Occurrence[], day: number, settings: PlanSettings, now = Date.now()): DayPlan {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const scheduled: Draft[] = [];
  const flexible: Draft[] = [];

  for (const o of occurrences) {
    const energy: Energy = o.energy ?? 'routine';
    const base = { key: o.key, id: o.id, kind: o.kind, title: o.title, color: o.color, done: o.done, priority: o.priority ?? 0, energy };
    if (o.kind === 'due') {
      if (o.start < dayStart || o.start >= dayEnd || o.done) continue;
      flexible.push({ ...base, fixed: false, guessed: !o.estimate, start: null, durationMin: o.estimate ?? DEFAULT_ESTIMATE_MIN });
      continue;
    }
    if (o.allDay) continue;
    const s = Math.max(o.start, dayStart);
    const e = Math.min(o.end, dayEnd);
    const startsToday = o.start >= dayStart && o.start < dayEnd;
    if (e <= s && !startsToday) continue;
    scheduled.push({ ...base, fixed: o.kind !== 'block', guessed: false, start: s, durationMin: Math.max(0, (e - s) / MINUTE) });
  }
  scheduled.sort((a, b) => a.start! - b.start! || a.title.localeCompare(b.title));
  flexible.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));

  // Free waking time: the day minus sleep, minus scheduled blocks, minus the past (today) or all of it (past days).
  const isPast = dayEnd <= now;
  const floor = isPast ? dayEnd : now > dayStart ? ceilTo(now, 5 * MINUTE) : dayStart;
  const busy: Interval[] = scheduled.filter((d) => d.durationMin > 0).map((d) => [d.start!, d.start! + d.durationMin * MINUTE]);
  let free = subtractIntervals([[dayStart, dayEnd]], [...sleepIntervals(dayStart, settings), [dayStart, floor], ...busy]);

  // Tentative placement (first fit, no splitting).
  const tentative = new Set<string>();
  for (const d of flexible) {
    const need = d.durationMin * MINUTE;
    const i = free.findIndex(([a, b]) => b - a >= need);
    if (i < 0) continue;
    d.start = free[i][0];
    tentative.add(d.key);
    free = subtractIntervals(free, [[d.start, d.start + need]]);
  }

  const drafts = [...scheduled, ...flexible].sort(
    (a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || b.priority - a.priority || a.key.localeCompare(b.key),
  );

  // Capacity, stacking and the capacity line.
  const cap = settings.capacityMinutes;
  let load = 0;
  let y = 0;
  let line: number | null = null;
  const entries: PlanEntry[] = drafts.map((d) => {
    const height = heightFor(d.durationMin);
    const counts = d.energy !== 'rest';
    if (line === null && counts && load + d.durationMin >= cap) line = y + ((cap - load) * PX_PER_HOUR) / 60;
    const overflow = counts && load + d.durationMin > cap;
    if (counts) load += d.durationMin;
    const entry: PlanEntry = {
      ...d,
      tentative: tentative.has(d.key),
      overflow,
      dimensions: { height, top: y, compact: d.durationMin <= COMPACT_MAX_MIN },
      visual_intensity: visualIntensity(d.energy),
      radial_position: d.start != null ? radialFor(d.start, d.durationMin) : null,
    };
    y += height;
    return entry;
  });
  if (line === null) line = y + (Math.max(0, cap - load) * PX_PER_HOUR) / 60;

  const freeMinutes = totalMs(free) / MINUTE;
  return {
    day: dayStart,
    entries,
    capacityMinutes: cap,
    plannedMinutes: load,
    remainingMinutes: Math.max(0, cap - load),
    overflowMinutes: Math.max(0, load - cap),
    freeMinutes,
    full: load >= cap || freeMinutes <= 0,
    capacity_line_px: line,
    content_height_px: y,
    sleep: sleepAngles(settings),
    burnout: auditBurnout(entries),
  };
}

// ---------------------------------------------------------------- Burnout audit

/**
 * Finds runs of more than MAX_DEEP_IN_ROW deep-work blocks without a break. A break is a rest block
 * or a gap of at least BREAK_GAP_MIN minutes; routine blocks don't break the run.
 */
export function auditBurnout(entries: PlanEntry[]): BurnoutAudit {
  const placed = entries.filter((e) => e.start != null && e.durationMin > 0).sort((a, b) => a.start! - b.start!);
  const chains: BurnoutChain[] = [];
  let run: PlanEntry[] = [];
  let lastEnd: number | null = null;

  const flush = () => {
    const first = run.findIndex((e) => e.energy === 'deep');
    let last = -1;
    run.forEach((e, i) => e.energy === 'deep' && (last = i));
    const span = first >= 0 ? run.slice(first, last + 1) : [];
    const deepCount = span.filter((e) => e.energy === 'deep').length;
    if (deepCount > MAX_DEEP_IN_ROW) {
      const end = Math.max(...span.map((e) => e.start! + e.durationMin * MINUTE));
      chains.push({
        keys: span.map((e) => e.key),
        deepCount,
        totalMinutes: span.reduce((a, e) => a + e.durationMin, 0),
        start: span[0].start!,
        end,
      });
    }
    run = [];
  };

  for (const e of placed) {
    if (e.energy === 'rest') {
      flush();
      lastEnd = e.start! + e.durationMin * MINUTE;
      continue;
    }
    if (lastEnd != null && e.start! - lastEnd >= BREAK_GAP_MIN * MINUTE) flush();
    run.push(e);
    lastEnd = Math.max(lastEnd ?? 0, e.start! + e.durationMin * MINUTE);
  }
  flush();
  return { chains, risk: chains.length > 0 };
}

// ---------------------------------------------------------------- Adding to a day

export interface FitResult {
  ok: boolean;
  reason: 'capacity' | 'time' | null;
  /** Minutes missing to fit the new entry. */
  missingMinutes: number;
}

/** Whether an entry of `minutes` still fits into the day (breaks always fit). */
export function canAdd(plan: DayPlan, minutes: number, energy: Energy | null = null): FitResult {
  if (energy === 'rest' || minutes <= 0) return { ok: true, reason: null, missingMinutes: 0 };
  if (minutes > plan.remainingMinutes) return { ok: false, reason: 'capacity', missingMinutes: minutes - plan.remainingMinutes };
  if (minutes > plan.freeMinutes) return { ok: false, reason: 'time', missingMinutes: minutes - plan.freeMinutes };
  return { ok: true, reason: null, missingMinutes: 0 };
}

export interface ShortenOption {
  key: string;
  id: string;
  title: string;
  durationMin: number;
  /** Duration after shortening by one step (never below COMPACT_MAX_MIN). */
  newMinutes: number;
}

export const SHORTEN_STEP_MIN = 15;

/** Tasks of the day whose estimate can still be cut. */
export function shortenOptions(plan: DayPlan): ShortenOption[] {
  return plan.entries
    .filter((e) => !e.fixed && !e.done && e.energy !== 'rest' && e.durationMin > COMPACT_MAX_MIN)
    .map((e) => ({
      key: e.key,
      id: e.id,
      title: e.title,
      durationMin: e.durationMin,
      newMinutes: Math.max(COMPACT_MAX_MIN, e.durationMin - SHORTEN_STEP_MIN),
    }));
}

/** The first of the next `maxDays` days (after `from`) that can hold the entry. */
export async function findFreeDay(opts: {
  from: number;
  minutes: number;
  energy?: Energy | null;
  settings: PlanSettings;
  loadOccurrences: (day: number) => Promise<Occurrence[]>;
  now?: number;
  maxDays?: number;
}): Promise<number | null> {
  const { from, minutes, energy = null, settings, loadOccurrences, now = Date.now(), maxDays = 14 } = opts;
  for (let i = 1; i <= maxDays; i++) {
    const day = addDays(startOfDay(from), i);
    if (canAdd(buildDayPlan(await loadOccurrences(day), day, settings, now), minutes, energy).ok) return day;
  }
  return null;
}

// ---------------------------------------------------------------- Real work (focus sessions)

/** Ring arcs of actually worked time: focus sessions clipped to the day (a running one up to `now`). */
export function sessionArcs(sessions: { startedAt: number; endedAt: number | null }[], day: number, now = Date.now()): RadialPosition[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const out: RadialPosition[] = [];
  for (const s of sessions) {
    const a = Math.max(s.startedAt, dayStart);
    const b = Math.min(s.endedAt ?? now, dayEnd);
    if (b <= a) continue;
    const start = angleOf(a);
    out.push({ start_angle: start, end_angle: Math.min(360, start + ((b - a) / MINUTE / 1440) * 360) });
  }
  return out;
}

/** Minutes of the day already behind us, as a ring angle (for the "now" marker). */
export function nowAngle(day: number, now: number): number | null {
  const s = startOfDay(day);
  return now >= s && now < addDays(s, 1) ? angleOf(now) : null;
}
