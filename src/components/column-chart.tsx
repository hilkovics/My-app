import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

const LABEL_WIDTH = 40;

export interface Column {
  key: string;
  /** Axis label under the column ('' = none, to avoid crowding). */
  label: string;
  value: number;
  /** Full description for the tooltip / screen readers, e.g. "po 9. 11." */
  title: string;
}

/**
 * Single-series column chart: one hue, ≤24px columns with a 4px rounded top and square base,
 * a hairline baseline and an optional solid reference line (goal). Tapping a column shows its
 * value above the chart (the touch equivalent of a hover tooltip).
 */
export function ColumnChart({
  data,
  goal,
  goalLabel,
  formatValue,
  height = 140,
  initialSelected,
}: {
  data: Column[];
  goal?: number;
  goalLabel?: string;
  formatValue: (v: number) => string;
  height?: number;
  initialSelected?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(initialSelected ?? null);
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.value)) * 1.1;
  const slot = data.length ? width / data.length : 0;
  const barWidth = Math.max(2, Math.min(24, slot - 2));
  const sel = selected != null && selected < data.length ? data[selected] : null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tooltip} numberOfLines={1}>
        {sel ? `${sel.title}: ${formatValue(sel.value)}` : ' '}
      </ThemedText>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {goal ? (
          <View pointerEvents="none" style={[styles.goal, { bottom: (goal / max) * height, borderColor: theme.textSecondary }]}>
            {goalLabel ? (
              <ThemedText type="small" themeColor="textSecondary" style={[styles.goalLabel, { backgroundColor: theme.backgroundElement }]}>
                {goalLabel}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.row, { borderColor: theme.border }]}>
          {data.map((d, i) => (
            <Pressable
              key={d.key}
              accessibilityRole="button"
              accessibilityLabel={`${d.title}: ${formatValue(d.value)}`}
              onPress={() => setSelected(i === selected ? null : i)}
              style={styles.slot}>
              <View
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: d.value > 0 ? Math.max(2, (d.value / max) * height) : 0,
                    backgroundColor: theme.accent,
                    opacity: sel && i !== selected ? 0.45 : 1,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>
      {/* Labels are centred under their column and may be wider than it (never clipped). */}
      <View style={styles.labels}>
        {data.map((d, i) =>
          d.label ? (
            <ThemedText
              key={d.key}
              type="small"
              themeColor="textSecondary"
              style={[styles.label, { left: (i + 0.5) * slot - LABEL_WIDTH / 2 }]}>
              {d.label}
            </ThemedText>
          ) : null,
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  tooltip: { minHeight: 20 },
  row: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  goal: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, zIndex: 1 },
  goalLabel: { position: 'absolute', right: 0, top: -10, fontSize: 11, lineHeight: 14, paddingHorizontal: 4 },
  labels: { height: 16 },
  label: { position: 'absolute', width: LABEL_WIDTH, textAlign: 'center', fontSize: 11, lineHeight: 14 },
});
