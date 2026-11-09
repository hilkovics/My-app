import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

import { useTheme } from '@/hooks/use-theme';

/**
 * Status bar content colour for the zone under it. `accent`: the hero zone extends under the status bar
 * (light content on the light theme's accent, dark content on the dark theme's light accent);
 * `bg`: the screen background. Applied while the screen is focused.
 */
export function useStatusBarZone(zone: 'bg' | 'accent'): void {
  const theme = useTheme();
  const dark = zone === 'accent' ? theme.onAccent !== '#FFFFFF' : theme.mode !== 'dark';
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(dark ? 'dark' : 'light');
    }, [dark]),
  );
}
