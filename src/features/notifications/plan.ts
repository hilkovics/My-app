import type { Item } from '../../db/types';
import { MINUTE, startOfDay, withTime } from '../../lib/dates';
import { nextOccurrence, parseRule } from '../../lib/recurrence';

/** Hour used as the reference time for all-day events and date-only tasks. */
export const ALL_DAY_ALERT_HOUR = 9;

/** The time an alert offset refers to: start for events/time blocks, due for tasks. */
export function alertAnchor(item: Item): number | null {
  if (item.type === 'note' || item.completedAt != null || item.archived) return null;
  const t = item.startAt ?? item.dueAt;
  if (t == null) return null;
  const dateOnly = item.allDay || (item.startAt == null && startOfDay(t) === t);
  return dateOnly ? withTime(t, ALL_DAY_ALERT_HOUR, 0) : t;
}

export interface PlannedAlert {
  offsetMinutes: number;
  /** When the notification fires. */
  fireAt: number;
  /** The occurrence it refers to. */
  occurrence: number;
}

/** Next fire time for each offset (only one per offset; recurring items are re-planned later). */
export function planAlerts(item: Item, offsets: number[], now = Date.now()): PlannedAlert[] {
  const anchor = alertAnchor(item);
  if (anchor == null) return [];
  const rule = parseRule(item.rrule);
  const out: PlannedAlert[] = [];
  for (const offset of offsets) {
    const lead = offset * MINUTE;
    // First occurrence whose alert time is still in the future.
    const occurrence = rule
      ? anchor - lead > now
        ? anchor
        : nextOccurrence(anchor, rule, now + lead)
      : anchor - lead > now
        ? anchor
        : null;
    if (occurrence != null) out.push({ offsetMinutes: offset, fireAt: occurrence - lead, occurrence });
  }
  return out;
}

export function describeOffset(min: number): string {
  if (min === 0) return 'V čase udalosti';
  if (min < 60) return `${min} min vopred`;
  if (min < 1440) return min % 60 === 0 ? `${min / 60} h vopred` : `${Math.floor(min / 60)} h ${min % 60} min vopred`;
  if (min % 10080 === 0) return min === 10080 ? 'Týždeň vopred' : `${min / 10080} týždne vopred`;
  return min === 1440 ? 'Deň vopred' : `${Math.round(min / 1440)} dni vopred`;
}

export const ALERT_PRESETS = [0, 5, 15, 30, 60, 120, 1440, 10080];
