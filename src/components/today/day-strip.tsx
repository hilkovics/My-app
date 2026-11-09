import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { nowFraction, stripBlocks, type StripBlock } from '@/features/plan/hero';
import type { PlanEntry } from '@/features/plan/layout';
import { useTheme } from '@/hooks/use-theme';

const AXIS = ['7:00', '11:00', '15:00', '19:00', '23:00'];
const HEIGHT = 34;

/**
 * Day strip of the hero zone: 34 px, radius 10, 7:00 → 23:00. Blocks are coloured by kind
 * (deep = solid, routine 45 %, pause = dashed outline, event 70 %), past blocks 40 %, "now" is a 3 px bar.
 * Decorative; the headline above carries the information, so it is hidden from screen readers.
 */
export function DayStrip({ entries, now }: { entries: PlanEntry[]; now: number | null }) {
  const theme = useTheme();
  const blocks = stripBlocks(entries, now);
  const nowAt = now != null ? nowFraction(now) : null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.strip, { backgroundColor: theme.heroChip }]}>
        {blocks.map((b) => (
          <View key={b.key} style={[styles.block, blockStyle(b, theme.onAccent), { left: `${b.left * 100}%`, width: `${Math.max(0, b.width * 100 - 0.5)}%` }]} />
        ))}
        {nowAt != null ? <View style={[styles.now, { left: `${nowAt * 100}%`, backgroundColor: theme.onAccent }]} /> : null}
      </View>
      <View style={styles.axis}>
        {AXIS.map((l) => (
          <ThemedText key={l} type="axis" tabular style={{ color: theme.onAccent, opacity: 0.8 }}>
            {l}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

function blockStyle(b: StripBlock, onAccent: string) {
  const opacity = b.past ? 0.4 : 1;
  switch (b.kind) {
    case 'deep':
      return { backgroundColor: onAccent, opacity };
    case 'routine':
      return { backgroundColor: onAccent, opacity: 0.45 * opacity };
    case 'event':
      return { backgroundColor: onAccent, opacity: 0.7 * opacity };
    case 'pause':
      return { borderColor: onAccent, borderWidth: 1.5, borderStyle: 'dashed' as const, opacity };
  }
}

const styles = StyleSheet.create({
  strip: { height: HEIGHT, borderRadius: Radius.calBlockDay },
  block: { position: 'absolute', top: 5, bottom: 5, borderRadius: 5 },
  now: { position: 'absolute', top: -5, bottom: -5, width: 3, marginLeft: -1.5, borderRadius: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
