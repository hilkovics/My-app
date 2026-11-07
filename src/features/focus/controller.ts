// Timer actions = repository changes + the matching OS notifications (Pomodoro end, break end).
import type { Db } from '../../db/types';
import { MINUTE } from '../../lib/dates';
import { cancelFixedNotification, scheduleFixedNotification } from '../notifications/scheduler';
import { getSettings, setSetting } from '../settings/repository';
import {
  finishDuePomodoro,
  getRunningSession,
  pauseSession,
  pomodoroEndsAt,
  resumeSession,
  startSession,
  stopSession,
  type FocusSession,
  type StartInput,
} from './repository';

const FOCUS_END = 'focus-end';
const BREAK_END = 'break-end';

async function syncFocusNotification(db: Db): Promise<void> {
  const s = await getRunningSession(db);
  const end = s && pomodoroEndsAt(s);
  if (end != null) await scheduleFixedNotification(FOCUS_END, end, 'Pomodoro hotové 🎉', 'Daj si prestávku.');
  else await cancelFixedNotification(FOCUS_END);
}

export async function startFocus(db: Db, input: StartInput): Promise<FocusSession> {
  await endBreak(db);
  const s = await startSession(db, input);
  await syncFocusNotification(db);
  return s;
}

export async function pauseFocus(db: Db): Promise<void> {
  await pauseSession(db);
  await syncFocusNotification(db);
}

export async function resumeFocus(db: Db): Promise<void> {
  await resumeSession(db);
  await syncFocusNotification(db);
}

export async function stopFocus(db: Db): Promise<FocusSession | null> {
  const s = await stopSession(db);
  await cancelFixedNotification(FOCUS_END);
  return s;
}

/** Called on app start/foreground and by the timer when time is up. */
export async function finishDueFocus(db: Db): Promise<FocusSession | null> {
  const s = await finishDuePomodoro(db);
  if (s) await cancelFixedNotification(FOCUS_END);
  return s;
}

export async function startBreak(db: Db, minutes?: number): Promise<void> {
  const len = minutes ?? (await getSettings(db)).breakMinutes;
  const until = Date.now() + len * MINUTE;
  await setSetting(db, 'breakUntil', until);
  await scheduleFixedNotification(BREAK_END, until, 'Prestávka skončila', 'Späť do práce 💪');
}

export async function endBreak(db: Db): Promise<void> {
  if ((await getSettings(db)).breakUntil != null) await setSetting(db, 'breakUntil', null);
  await cancelFixedNotification(BREAK_END);
}
