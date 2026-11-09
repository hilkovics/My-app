// App-side loading for the day plan (database + phone calendar). The planning itself is in layout.ts.
import type { Db } from '../../db/types';
import { addDays, startOfDay } from '../../lib/dates';
import { expandItems, type Occurrence } from '../calendar/agenda';
import { fetchDeviceOccurrences } from '../calendar/device';
import { listTimedItems } from '../items/repository';
import { getSettings, type Settings } from '../settings/repository';
import { buildDayPlan, type DayPlan, type PlanSettings } from './layout';

export function planSettingsOf(s: Settings): PlanSettings {
  return { capacityMinutes: s.dayCapacityMinutes, sleepStartHour: s.sleepStartHour, sleepEndHour: s.sleepEndHour };
}

/** Local items and phone-calendar events of one day. A failing phone calendar just counts as empty. */
export async function loadDayOccurrences(db: Db, day: number, deviceCalendarIds: string[]): Promise<Occurrence[]> {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  const local = expandItems(await listTimedItems(db, from, to), from, to);
  const device = await fetchDeviceOccurrences(deviceCalendarIds, from, to).catch(() => [] as Occurrence[]);
  return [...local, ...device];
}

export async function loadDayPlan(db: Db, day: number, now = Date.now()): Promise<DayPlan> {
  const settings = await getSettings(db);
  return buildDayPlan(await loadDayOccurrences(db, day, settings.deviceCalendarIds), day, planSettingsOf(settings), now);
}
