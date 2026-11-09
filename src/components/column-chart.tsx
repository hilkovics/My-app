import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { FontFamily, Spacing, Viz } from '@/constants/theme';
import { hexA } from '@/lib/color';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Chip } from './ui';

const LABEL_WIDTH = 40;
const GUTTER = 30;

export interface Column {
  key: string;
  /** Axis label under the column ('' = none, to avoid crowding). */
  label: string;
  value: number;
  /** Full description for the tooltip / screen readers, e.g. "po 9. 11." */
  title: string;
}

/**
 * Single-series column chart: one hue (`mark`), bars up to 24 px (narrower when crowded) with a 4 px
 * rounded top and square base, a hairline baseline, optional horizontal grid with labels (`yTicks`),
 * and an optional 2 px dashed reference line (goal). Highlighted bars (and the selected one) are solid
 * `mark`, the rest `mark` at 50 %. Tapping a column shows its value above the chart; `valuesToggle`
 * adds a "Zobraziť hodnoty" switch with the same data as text (the accessible alternative).
 */
export function ColumnChart({
  data,
  goal,
  goalLabel,
  formatValue,
  height = Viz.barChart.height,
  initialSelected,
  yTicks,
  highlight,
  valuesToggle,
  idleText = ' ',
}: {
  data: Column[];
  goal?: number;
  goalLabel?: string;
  formatValue: (v: number) => string;
  height?: number;
  initialSelected?: number;
  /** Values (in data units) that get a gridline and a label on the left gutter. */
  yTicks?: number[];
  /** Bars drawn solid even when not selected (e.g. today). */
  highlight?: (index: number) => boolean;
  valuesToggle?: boolean;
  /** Line shown above the chart while nothing is selected. */
  idleText?: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(initialSelected ?? null);
  const [showValues, setShowValues] = useState(false);
  const gutter = yTicks?.length ? GUTTER : 0;
  const max = Math.max(1, goal ?? 0, ...(yTicks ?? []), ...data.map((d) => d.value)) * 1.1;
  const plotWidth = Math.max(0, width - gutter);
  const slot = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.max(2, Math.min(Viz.barChart.maxBarWidth, slot - 3));
  const sel = selected != null && selected < data.length ? data[selected] : null;
  const solid = (i: number) => (highlight ? highlight(i) || i === selected : sel ? i === selected : true);

  return (
    <View style={styles.wrap}>
      <ThemedText type="meta" themeColor="text2" style={styles.tooltip} numberOfLines={1} tabular>
        {sel ? `${sel.title} · ${formatValue(sel.value)}` : idleText}
      </ThemedText>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {yTicks?.map((v) =>
          v < max ? (
            <View key={v} pointerEvents="none" style={[styles.grid, { bottom: (v / max) * height, borderColor: theme.border }]}>
              <ThemedText type="axis" themeColor="text2" style={styles.gridLabel}>
                {formatValue(v)}
              </ThemedText>
            </View>
          ) : null,
        )}
        {goal ? (
          <View pointerEvents="none" style={[styles.goal, { bottom: (goal / max) * height, left: gutter }]}>
            <Svg width="100%" height={2}>
              <Line x1="0" y1="1" x2="100%" y2="1" stroke={theme.text} strokeWidth={2} strokeDasharray="6 4" />
            </Svg>
            {goalLabel ? (
              <ThemedText type="axis" style={[styles.goalLabel, { backgroundColor: theme.surface, fontFamily: FontFamily[800] }]}>
                {goalLabel}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.row, { left: gutter, borderColor: theme.text2 }]}>
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
                    backgroundColor: highlight ? (solid(i) ? theme.mark : hexA(theme.mark, 0.5)) : theme.mark,
                    opacity: !highlight && sel && i !== selected ? 0.4 : 1,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>
      {/* Labels are centred under their column and may be wider than it (never clipped). */}
      <View style={[styles.labels, { marginLeft: gutter }]}>
        {data.map((d, i) =>
          d.label ? (
            <ThemedText key={d.key} type="axis" themeColor="text2" style={[styles.label, { left: (i + 0.5) * slot - LABEL_WIDTH / 2 }]}>
              {d.label}
            </ThemedText>
          ) : null,
        )}
      </View>
      {valuesToggle ? (
        <>
          <View style={styles.toggle}>
            <Chip label={showValues ? 'Skryť hodnoty' : 'Zobraziť hodnoty'} selected={showValues} onPress={() => setShowValues((v) => !v)} />
          </View>
          {showValues ? (
            <View accessibilityLabel="Hodnoty grafu">
              {data.map((d) => (
                <ThemedText key={d.key} type="meta" tabular>
                  {d.title}: {formatValue(d.value)}
                </ThemedText>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  tooltip: { minHeight: 20, fontFamily: FontFamily[700] },
  row: { position: 'absolute', top: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: Viz.barChart.topRadius, borderTopRightRadius: Viz.barChart.topRadius },
  grid: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  gridLabel: { position: 'absolute', left: 0, top: -8, fontSize: 10, lineHeight: 12 },
  goal: { position: 'absolute', right: 0, zIndex: 1 },
  goalLabel: { position: 'absolute', right: 0, top: -16, fontSize: 11, lineHeight: 14, paddingHorizontal: 4 },
  labels: { height: 16 },
  label: { position: 'absolute', width: LABEL_WIDTH, textAlign: 'center', fontSize: 11, lineHeight: 14 },
  toggle: { flexDirection: 'row', marginTop: Spacing.one },
});
