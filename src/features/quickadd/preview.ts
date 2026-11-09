// Live preview of what the quick-add parser recognised, and where the new task will land.
import { startOfDay } from '../../lib/dates';
import { describeRule } from '../../lib/recurrence';
import type { Parsed } from './parse';

export type TaskListView = 'inbox' | 'today' | 'upcoming' | 'done';

export const QUICK_ADD_HINT = 'dnes/zajtra/v piatok/12.11. · 15:00 · !1–!3 · #štítok · pripomeň · každý pondelok';

const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * "Rozpoznané:" chips, in the design's order: date/time, priority, tags, reminder, repeat; "📥 Inbox"
 * when nothing was recognised. `relDay` formats the day ("dnes", "zajtra", "so 7. 11.").
 */
export function quickPreview(p: Parsed, relDay: (day: number) => string): string[] {
  const chips: string[] = [];
  if (p.day != null) chips.push(`📅 ${relDay(p.day)}${p.minutes != null ? ` ${clock(p.minutes)}` : ''}`);
  else if (p.minutes != null) chips.push(`⏰ ${clock(p.minutes)}`);
  if (p.priority) chips.push('!'.repeat(p.priority));
  p.tags.forEach((x) => chips.push(`#${x}`));
  if (p.alerts.length) chips.push('🔔 pripomenúť');
  if (p.rule) chips.push(`🔁 ${describeRule(p.rule).toLowerCase()}`);
  if (!chips.length) chips.push('📥 Inbox');
  return chips;
}

/** The list filter the task will show up in: no date → Inbox, today or overdue → Dnes, later → Naplánované. */
export function landingView(p: Pick<Parsed, 'day'>, now: number): TaskListView {
  if (p.day == null) return 'inbox';
  return p.day <= startOfDay(now) ? 'today' : 'upcoming';
}
