import { notifyChange } from '../../db/changes';
import type { Db } from '../../db/types';

export interface Settings {
  /** Device calendar ids shown in the app. */
  deviceCalendarIds: string[];
  /** Device calendar to which events can be copied (null = none). */
  writeCalendarId: string | null;
  /** Default alert offsets (minutes before) for new events and timed tasks. */
  defaultAlerts: number[];
  /** First visible hour in day/week views. */
  dayStartHour: number;
  /** Daily deep-work goal in minutes. */
  focusGoalMinutes: number;
  /** Default Pomodoro length and break length (minutes). */
  pomodoroMinutes: number;
  breakMinutes: number;
  /** End of the current break (epoch ms) or null. */
  breakUntil: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  deviceCalendarIds: [],
  writeCalendarId: null,
  defaultAlerts: [15],
  dayStartHour: 7,
  focusGoalMinutes: 180,
  pomodoroMinutes: 25,
  breakMinutes: 5,
  breakUntil: null,
};

export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (key in out) {
      try {
        (out as unknown as Record<string, unknown>)[key] = JSON.parse(value);
      } catch {
        // ignore corrupt value, keep default
      }
    }
  }
  return out;
}

export async function setSetting<K extends keyof Settings>(db: Db, key: K, value: Settings[K]): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
  notifyChange();
}
