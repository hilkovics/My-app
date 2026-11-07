import type { Habit } from '../../db/types';
import { addDays, startOfDay, weekdayIndex, ymd } from '../../lib/dates';

export function isScheduled(habit: Pick<Habit, 'days'>, day: number): boolean {
  return habit.days[weekdayIndex(day)] === '1';
}

/**
 * Consecutive scheduled days meeting the target, ending today.
 * If today is scheduled but not done yet, the streak counts from yesterday (it isn't broken yet).
 * Unscheduled days are skipped.
 */
export function computeStreak(
  habit: Pick<Habit, 'days' | 'targetPerDay' | 'createdAt'>,
  logs: Map<string, number> | undefined,
  today = Date.now(),
): number {
  if (!habit.days.includes('1')) return 0;
  const created = startOfDay(habit.createdAt);
  let day = startOfDay(today);
  let streak = 0;
  let first = true;
  for (let i = 0; i < 3660 && day >= created; i++, day = addDays(day, -1)) {
    if (!isScheduled(habit, day)) continue;
    const done = (logs?.get(ymd(day)) ?? 0) >= habit.targetPerDay;
    if (done) streak++;
    else if (!first) break;
    first = false;
  }
  return streak;
}

/** Share of scheduled days in the last `days` days (including today) that met the target. */
export function completionRate(
  habit: Pick<Habit, 'days' | 'targetPerDay' | 'createdAt'>,
  logs: Map<string, number> | undefined,
  days = 30,
  today = Date.now(),
): number {
  let scheduled = 0;
  let done = 0;
  const created = startOfDay(habit.createdAt);
  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(today), -i);
    if (day < created) break;
    if (!isScheduled(habit, day)) continue;
    scheduled++;
    if ((logs?.get(ymd(day)) ?? 0) >= habit.targetPerDay) done++;
  }
  return scheduled ? done / scheduled : 0;
}
