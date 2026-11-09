import type { Energy, Item } from '../../db/types';
import { DAY, startOfDay } from '../../lib/dates';
import { occurrencesBetween, parseRule } from '../../lib/recurrence';

export type OccurrenceKind = 'event' | 'block' | 'due' | 'external';

/** Something shown on a calendar at a concrete time. */
export interface Occurrence {
  key: string;
  kind: OccurrenceKind;
  /** Local item id, or device event id for kind 'external'. */
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  color: string | null;
  done: boolean;
  recurring: boolean;
  calendarId?: string;
  calendarTitle?: string;
  location?: string | null;
  notes?: string | null;
  /** A note is attached to this occurrence (see event-notes). */
  hasNote?: boolean;
  /** Estimated duration of a task, in minutes. */
  estimate?: number | null;
  /** How demanding it is (null/undefined = routine). */
  energy?: Energy | null;
  priority?: number;
}

/** Expands events, time-blocked tasks and due tasks (incl. recurring) into occurrences in [from, to). */
export function expandItems(items: Item[], from: number, to: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const item of items) {
    if (item.archived || item.type === 'note') continue;
    const rule = parseRule(item.rrule);
    if (item.startAt != null) {
      const duration = Math.max(0, (item.endAt ?? item.startAt) - item.startAt);
      for (const start of occurrencesBetween(item.startAt, rule, from, to, duration)) {
        out.push({
          key: `${item.id}@${start}`,
          kind: item.type === 'event' ? 'event' : 'block',
          id: item.id,
          title: item.title,
          start,
          end: start + duration,
          allDay: item.allDay,
          color: item.color,
          done: item.completedAt != null,
          recurring: !!rule,
          estimate: item.estimateMinutes,
          energy: item.energy,
          priority: item.priority,
        });
      }
    } else if (item.type === 'task' && item.dueAt != null) {
      // Recurring open tasks only show their current occurrence (the next one appears once done).
      if (item.dueAt >= from && item.dueAt < to) {
        out.push({
          key: `${item.id}@${item.dueAt}`,
          kind: 'due',
          id: item.id,
          title: item.title,
          start: item.dueAt,
          end: item.dueAt,
          allDay: isMidnight(item.dueAt),
          color: item.color,
          done: item.completedAt != null,
          recurring: !!rule,
          estimate: item.estimateMinutes,
          energy: item.energy,
          priority: item.priority,
        });
      }
    }
  }
  return sortOccurrences(out);
}

export function sortOccurrences(list: Occurrence[]): Occurrence[] {
  return list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start || a.title.localeCompare(b.title));
}

export function isMidnight(t: number): boolean {
  return startOfDay(t) === t;
}

/** Occurrences touching the given day. All-day items count for each day they span. */
export function occurrencesOnDay(list: Occurrence[], day: number): Occurrence[] {
  const s = startOfDay(day);
  const e = s + DAY;
  return list.filter((o) => (o.start < e && o.end > s) || (o.start >= s && o.start < e));
}

export interface LaidOut {
  occ: Occurrence;
  /** Column index and number of columns in its overlap group. */
  column: number;
  columns: number;
}

/** Side-by-side layout for overlapping timed occurrences in one day column. */
export function layoutDay(list: Occurrence[]): LaidOut[] {
  const timed = list.filter((o) => !o.allDay).sort((a, b) => a.start - b.start || b.end - a.end);
  const result: LaidOut[] = [];
  let group: LaidOut[] = [];
  let groupEnd = -Infinity;
  const colEnds: number[] = [];
  const flush = () => {
    const n = Math.max(1, ...group.map((g) => g.column + 1));
    for (const g of group) g.columns = n;
    result.push(...group);
    group = [];
    colEnds.length = 0;
  };
  for (const occ of timed) {
    const end = Math.max(occ.end, occ.start + 15 * 60_000);
    if (occ.start >= groupEnd && group.length) flush();
    let col = colEnds.findIndex((e) => e <= occ.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else colEnds[col] = end;
    group.push({ occ, column: col, columns: 1 });
    groupEnd = Math.max(groupEnd === -Infinity ? end : groupEnd, end);
  }
  if (group.length) flush();
  return result;
}
