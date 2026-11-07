// Phone calendars (Google, Outlook, iCloud … whatever accounts the OS syncs) via expo-calendar.
// Uses the legacy API because the "next" API is not available in Expo Go.
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import type { Item } from '../../db/types';
import { parseRule } from '../../lib/recurrence';
import type { Occurrence } from './agenda';

export const deviceCalendarSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export interface DeviceCalendar {
  id: string;
  title: string;
  color: string | null;
  source: string;
  writable: boolean;
}

export async function hasCalendarPermission(): Promise<boolean> {
  if (!deviceCalendarSupported) return false;
  return (await Calendar.getCalendarPermissionsAsync()).granted;
}

export async function requestCalendarPermission(): Promise<boolean> {
  if (!deviceCalendarSupported) return false;
  return (await Calendar.requestCalendarPermissionsAsync()).granted;
}

export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  if (!(await hasCalendarPermission())) return [];
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals
    .map((c) => ({
      id: c.id,
      title: c.title,
      color: c.color ?? null,
      source: c.source?.name ?? '',
      writable: !!c.allowsModifications,
    }))
    .sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title));
}

function toMs(d: string | Date): number {
  return typeof d === 'string' ? Date.parse(d) : d.getTime();
}

export async function fetchDeviceOccurrences(
  calendarIds: string[],
  from: number,
  to: number,
): Promise<Occurrence[]> {
  if (!deviceCalendarSupported || !calendarIds.length) return [];
  if (!(await hasCalendarPermission())) return [];
  const [events, cals] = await Promise.all([
    Calendar.getEventsAsync(calendarIds, new Date(from), new Date(to)),
    Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT),
  ]);
  const calById = new Map(cals.map((c) => [c.id, c]));
  return events.map((e) => {
    const start = toMs(e.startDate);
    const end = toMs(e.endDate);
    const cal = calById.get(e.calendarId);
    return {
      key: `ext:${e.id}@${start}`,
      kind: 'external' as const,
      id: e.id,
      title: e.title || '(bez názvu)',
      start,
      end: e.allDay ? end - 1 : end,
      allDay: !!e.allDay,
      color: cal?.color ?? null,
      done: false,
      recurring: !!e.recurrenceRule,
      calendarId: e.calendarId,
      calendarTitle: cal?.title,
      location: e.location ?? null,
      notes: e.notes ?? null,
    };
  });
}

/** Copies a local event into a phone calendar; returns the new device event id. */
export async function copyEventToDevice(calendarId: string, item: Item): Promise<string> {
  if (item.startAt == null) throw new Error('Udalosť nemá čas');
  const rule = parseRule(item.rrule);
  const freq = rule ? Calendar.Frequency[rule.freq] : undefined;
  return Calendar.createEventAsync(calendarId, {
    title: item.title,
    notes: item.body,
    startDate: new Date(item.startAt),
    endDate: new Date(item.endAt ?? item.startAt),
    allDay: item.allDay,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrenceRule: rule && freq ? { frequency: freq, interval: rule.interval, occurrence: rule.count } : undefined,
  });
}
