import type { ViewStyle } from 'react-native';

import type { Colors } from '@/constants/theme';
import type { Energy } from '@/db/types';
import type { PlanEntry } from '@/features/plan/layout';
import { onColor, shade, hexA } from '@/lib/color';

type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

export const ENERGY_ICON: Record<Energy, string> = { deep: '🔥', routine: '', rest: '☕' };
export const ENERGY_LABEL: Record<Energy, string> = { deep: 'Hlboká práca', routine: 'Rutina', rest: 'Pauza' };

export interface EntryStyle {
  box: ViewStyle;
  text: string;
  muted: string;
}

/**
 * Look of a plan card from its `visual_intensity`:
 * - deep: strong, contrasting fill with a thick darker border
 * - routine: muted, semi-transparent fill
 * - rest: neutral grey-green
 * An overflowing entry gets a warning border. Colour is never the only cue (icon + label as well).
 */
export function entryStyle(e: Pick<PlanEntry, 'visual_intensity' | 'color' | 'overflow' | 'tentative'>, theme: Theme): EntryStyle {
  const hue = e.color ?? theme.accent;
  const v = e.visual_intensity;
  let backgroundColor: string;
  let borderColor: string;
  let text: string = theme.text;
  if (v.energy === 'deep') {
    backgroundColor = hue;
    borderColor = shade(hue, -0.4);
    text = onColor(hue);
  } else if (v.energy === 'rest') {
    backgroundColor = hexA(theme.success, 0.18);
    borderColor = hexA(theme.success, 0.7);
  } else {
    backgroundColor = hexA(hue, v.saturation * 0.5);
    borderColor = hexA(hue, 0.55);
  }
  return {
    box: {
      backgroundColor,
      borderColor: e.overflow ? theme.danger : borderColor,
      borderWidth: e.overflow ? Math.max(2, v.border_width) : v.border_width,
      borderStyle: e.tentative ? 'dashed' : 'solid',
      opacity: v.opacity,
    },
    text,
    muted: v.energy === 'deep' ? text : theme.text2,
  };
}
