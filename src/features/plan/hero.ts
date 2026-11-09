// Pure helpers for the Dnes hero zone: motivational headline, day strip geometry, "Teraz" card.
import type { PlanEntry, DayPlan } from './layout';
import { fmtMinutes } from '../focus/stats';
import { MINUTE } from '../../lib/dates';

export const STRIP_FROM = 7;
export const STRIP_TO = 23;

export type HeroState = 'free' | 'full' | 'over';

export interface HeroCopy {
  state: HeroState;
  /** Full headline; durations use non-breaking spaces. */
  headline: string;
}

/** Headline of the hero zone by capacity: free time left / exactly full / over capacity. */
export function heroCopy(plan: Pick<DayPlan, 'overflowMinutes' | 'remainingMinutes' | 'full'>): HeroCopy {
  if (plan.overflowMinutes > 0) {
    return { state: 'over', headline: `Dnes je toho veľa. Skús presunúť ${fmtMinutes(plan.overflowMinutes)}.` };
  }
  if (plan.full || plan.remainingMinutes <= 0) {
    return { state: 'full', headline: 'Deň je plný. Zvládneš to, krok po kroku.' };
  }
  return { state: 'free', headline: `Dobré tempo. Ešte ${fmtMinutes(plan.remainingMinutes)} a deň je plný.` };
}

export type StripKind = 'deep' | 'routine' | 'pause' | 'event';

export interface StripBlock {
  key: string;
  /** Fractions (0–1) of the strip width. */
  left: number;
  width: number;
  kind: StripKind;
  past: boolean;
}

export function stripKind(e: Pick<PlanEntry, 'kind' | 'visual_intensity'>): StripKind {
  if (e.kind === 'event' || e.kind === 'external') return 'event';
  const energy = e.visual_intensity.energy;
  return energy === 'deep' ? 'deep' : energy === 'rest' ? 'pause' : 'routine';
}

/** Blocks of the day strip (7:00 → 23:00). Entries outside the window are clipped or dropped. */
export function stripBlocks(entries: PlanEntry[], now: number | null): StripBlock[] {
  const span = STRIP_TO - STRIP_FROM;
  const out: StripBlock[] = [];
  for (const e of entries) {
    if (e.start == null || e.durationMin <= 0) continue;
    const d = new Date(e.start);
    const startH = d.getHours() + d.getMinutes() / 60;
    const endH = startH + e.durationMin / 60;
    const s = Math.max(STRIP_FROM, startH);
    const en = Math.min(STRIP_TO, endH);
    if (en <= s) continue;
    out.push({
      key: e.key,
      left: (s - STRIP_FROM) / span,
      width: (en - s) / span,
      kind: stripKind(e),
      past: now != null && e.start + e.durationMin * MINUTE <= now,
    });
  }
  return out;
}

/** Position of the "now" marker as a fraction of the strip, or null outside 7:00–23:00. */
export function nowFraction(now: number): number | null {
  const d = new Date(now);
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < STRIP_FROM || h > STRIP_TO) return null;
  return (h - STRIP_FROM) / (STRIP_TO - STRIP_FROM);
}

/** The entry that contains `now` (today only), skipping finished ones. Earliest start wins. */
export function currentEntry(entries: PlanEntry[], now: number): PlanEntry | null {
  const live = entries
    .filter((e) => e.start != null && !e.done && e.start <= now && now < e.start + e.durationMin * MINUTE)
    .sort((a, b) => a.start! - b.start!);
  return live[0] ?? null;
}

/** "Riziko vyčerpania – po 13:30 si daj pauzu." or null when there is no risk. `fmtTime` formats the chain end. */
export function burnoutNote(plan: Pick<DayPlan, 'burnout'>, fmtTime: (t: number) => string): string | null {
  if (!plan.burnout.risk || !plan.burnout.chains.length) return null;
  return `Riziko vyčerpania – po ${fmtTime(plan.burnout.chains[0].end)} si daj pauzu.`;
}
