import { useLiveQuery } from '@/db/hooks';
import { useOccurrences } from '@/features/calendar/use-occurrences';
import { getSettings } from '@/features/settings/repository';
import { useNow } from '@/hooks/use-now';
import { addDays, startOfDay } from '@/lib/dates';

import { planSettingsOf } from './data';
import { buildDayPlan, type DayPlan } from './layout';

/** The plan of a day, kept up to date (local items + phone calendar). null until settings are loaded. */
export function useDayPlan(day: number): DayPlan | null {
  const now = useNow();
  const from = startOfDay(day);
  const occurrences = useOccurrences(from, addDays(from, 1));
  const settings = useLiveQuery((d) => getSettings(d), []);
  if (!settings) return null;
  return buildDayPlan(occurrences, from, planSettingsOf(settings), now);
}
