import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Progress meter (0–1): accent fill on a lighter track of the same hue. */
export function Meter({ value, label }: { value: number; label?: string }) {
  const theme = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={[styles.track, { backgroundColor: `${theme.accent}33` }]}>
      <View style={[styles.fill, { width: `${v * 100}%`, backgroundColor: theme.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: Radius.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.sm },
});
