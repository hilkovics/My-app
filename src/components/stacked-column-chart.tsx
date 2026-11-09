import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export interface StackSeries {
  key: string;
  name: string;
  color: string;
}

const LABEL_WIDTH = 40;

/**
 * Stacked columns (one per period) split by series. ≤24px columns, 4px rounded top, square base,
 * 2px surface gap between segments, one axis. Legend always shown (≥2 series); text uses text
 * colours, the swatch carries identity. Tapping a column shows its breakdown above the chart.
 */
export function StackedColumnChart({
  series,
  values,
  labels,
  titles,
  formatValue,
  height = 150,
}: {
  series: StackSeries[];
  /** values[column][series] */
  values: number[][];
  /** Axis label per column ('' = none). */
  labels: string[];
  /** Tooltip title per column. */
  titles: string[];
  formatValue: (v: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const totals = values.map((row) => row.reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals) * 1.1;
  const slot = values.length ? width / values.length : 0;
  const barWidth = Math.max(2, Math.min(24, slot - 4));
  const sel = selected != null ? selected : null;

  const tooltip =
    sel != null
      ? `${titles[sel]}: ${formatValue(totals[sel])}${series
          .map((s, i) => (values[sel][i] > 0 ? ` · ${s.name} ${formatValue(values[sel][i])}` : ''))
          .join('')}`
      : ' ';

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="text2" style={styles.tooltip}>
        {tooltip}
      </ThemedText>
      <View style={[styles.plot, { height, borderColor: theme.border }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {values.map((row, c) => {
          const visible = row.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`${titles[c]}: ${formatValue(totals[c])}`}
              onPress={() => setSelected(c === selected ? null : c)}
              style={styles.slot}>
              <View style={{ width: barWidth, opacity: sel != null && sel !== c ? 0.45 : 1 }}>
                {/* Render top → bottom so the first series sits on the baseline. */}
                {visible
                  .slice()
                  .reverse()
                  .map(({ v, i }, k) => (
                    <View
                      key={series[i].key}
                      style={{
                        height: Math.max(2, (v / max) * height - (k < visible.length - 1 ? 2 : 0)),
                        marginBottom: k < visible.length - 1 ? 2 : 0,
                        backgroundColor: series[i].color,
                        borderTopLeftRadius: k === 0 ? 4 : 0,
                        borderTopRightRadius: k === 0 ? 4 : 0,
                      }}
                    />
                  ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {labels.map((l, i) =>
          l ? (
            <ThemedText
              key={i}
              type="small"
              themeColor="text2"
              style={[styles.label, { left: (i + 0.5) * slot - LABEL_WIDTH / 2 }]}>
              {l}
            </ThemedText>
          ) : null,
        )}
      </View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <ThemedText type="small">{s.name}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  tooltip: { minHeight: 20 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  labels: { height: 16 },
  label: { position: 'absolute', width: LABEL_WIDTH, textAlign: 'center', fontSize: 11, lineHeight: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
