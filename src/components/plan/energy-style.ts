import type { ViewStyle } from 'react-native';

import { ACTIVITY_COLORS, type Theme } from '@/constants/theme';
import type { Energy } from '@/db/types';
import { entityColor } from '@/features/plan/entity-color';
import type { PlanEntry } from '@/features/plan/layout';
import { onColor } from '@/lib/color';

export const ENERGY_ICON: Record<Energy, string> = { deep: '🔥', routine: '', rest: '☕' };
export const ENERGY_LABEL: Record<Energy, string> = { deep: 'Hlboká práca', routine: 'Rutina', rest: 'Pauza' };

export interface EntryStyle {
  box: ViewStyle;
  text: string;
  muted: string;
}

/**
 * Look of a plan card (Rozvrh podľa dĺžky):
 * - deep task: `mark` fill with `onMark` text
 * - routine task: `mark` 16 % fill + 1 px `mark` 55 % border
 * - pause: `success` 18 % fill + 1 px dashed `success` border
 * - event: its categorical colour with automatic text colour
 * An overflowing entry gets a 2 px `danger` border (and a "⚠ " prefix in the title).
 * Colour is never the only cue: the icon prefix and the labels carry the same information.
 */
export function entryStyle(e: Pick<PlanEntry, 'id' | 'kind' | 'visual_intensity' | 'color' | 'overflow' | 'tentative'>, theme: Theme): EntryStyle {
  const isEvent = e.kind === 'event' || e.kind === 'external';
  const energy = e.visual_intensity.energy;
  let backgroundColor: string;
  let borderColor: string;
  let borderStyle: 'solid' | 'dashed' = 'solid';
  let text: string = theme.text;
  if (isEvent) {
    const hue = entityColor(e.id, e.color, ACTIVITY_COLORS[theme.mode]);
    backgroundColor = hue;
    borderColor = hue;
    text = onColor(hue);
  } else if (energy === 'deep') {
    backgroundColor = theme.mark;
    borderColor = theme.mark;
    text = theme.onMark;
  } else if (energy === 'rest') {
    backgroundColor = theme.pauseFill;
    borderColor = theme.success;
    borderStyle = 'dashed';
  } else {
    backgroundColor = theme.routineFill;
    borderColor = theme.routineBorder;
  }
  return {
    box: {
      backgroundColor,
      borderColor: e.overflow ? theme.danger : borderColor,
      borderWidth: e.overflow ? 2 : 1,
      borderStyle: e.tentative ? 'dashed' : borderStyle,
    },
    text,
    muted: text,
  };
}
