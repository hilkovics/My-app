// Pure geometry and encoding of calendar blocks (Deň / Týždeň views).
import { HOUR, MINUTE, startOfDay } from '../../lib/dates';
import type { Occurrence } from './agenda';

export const DAY_VIEW = { pxPerHour: 56, gutter: 52, lastHour: 22, minHeight: 20 } as const;
export const WEEK_VIEW = { pxPerHour: 36, gutter: 34, lastHour: 20, minHeight: 14 } as const;

/**
 * Where a block sits in a day column that shows `firstHour`–`lastHour`. Blocks outside the window are
 * dropped (null); partly visible ones are clipped. The height is 2 px short of the duration so that
 * stacked blocks keep a gap.
 */
export function blockGeometry(
  occ: Pick<Occurrence, 'start' | 'end'>,
  day: number,
  view: { firstHour: number; lastHour: number; pxPerHour: number; minHeight: number },
): { top: number; height: number } | null {
  const dayStart = startOfDay(day);
  const winStart = dayStart + view.firstHour * HOUR;
  const winEnd = dayStart + view.lastHour * HOUR;
  const start = Math.max(occ.start, winStart);
  const end = Math.min(Math.max(occ.end, occ.start + 20 * MINUTE), winEnd);
  if (end <= start) return null;
  const pxPerMin = view.pxPerHour / 60;
  return {
    top: ((start - winStart) / MINUTE) * pxPerMin,
    height: Math.max(view.minHeight, ((end - start) / MINUTE) * pxPerMin - 2),
  };
}

export type BlockStyle = 'event' | 'task' | 'deep' | 'pause';

export function blockStyleOf(occ: Pick<Occurrence, 'kind' | 'energy'>): BlockStyle {
  if (occ.kind === 'event' || occ.kind === 'external') return 'event';
  if (occ.energy === 'rest') return 'pause';
  if (occ.energy === 'deep') return 'deep';
  return 'task';
}

/** Title prefix and suffix of a block: "☐ ", "☐ 🔥 ", "☕ ", "☑ …" when done, " 📝" when it has a note. */
export function blockTitle(occ: Pick<Occurrence, 'kind' | 'energy' | 'done' | 'title' | 'hasNote'>, untitled = '(bez názvu)', overflow = false): string {
  const style = blockStyleOf(occ);
  const box = occ.done ? '☑' : '☐';
  const prefix = style === 'event' ? '' : style === 'pause' ? '☕ ' : style === 'deep' ? `${box} 🔥 ` : `${box} `;
  return `${overflow ? '⚠ ' : ''}${prefix}${occ.title || untitled}${occ.hasNote ? ' 📝' : ''}`;
}
