import { ACTIVITY_COLORS, HEAT_STEPS, OTHER_COLOR } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Chart colours for the current colour scheme (each mode has its own validated steps). */
export function useChartColors() {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    activity: (slot: number | null) => (slot == null ? OTHER_COLOR[mode] : ACTIVITY_COLORS[mode][slot % 8]),
    heat: HEAT_STEPS[mode],
    slots: ACTIVITY_COLORS[mode],
  };
}
