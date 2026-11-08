import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { MONTHS, fmtDateShort, startOfDay } from '@/lib/dates';

import { ThemedText } from './themed-text';

const CELL = 12;
const GAP = 2;
const DAY_LABELS = ['po', '', 'st', '', 'pi', '', ''];

/**
 * Year map (GitHub-style): one square per day, weeks as columns (Monday on top), a sequential
 * one-hue ramp from "nothing" to "a lot". Tapping a day shows its value above the grid.
 */
export function Heatmap({
  weeks,
  levelOf,
  describe,
}: {
  /** Columns of 7 day starts (see yearGrid). */
  weeks: number[][];
  /** 0–4 */
  levelOf: (day: number) => number;
  /** Text for the tapped day, e.g. "45 min". */
  describe: (day: number) => string;
}) {
  const theme = useTheme();
  const { heat } = useChartColors();
  const today = startOfDay(useNow());
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const colorFor = (lvl: number) => (lvl === 0 ? theme.backgroundSelected : heat[lvl - 1]);

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {selected != null ? `${fmtDateShort(selected)}: ${describe(selected)}` : ' '}
      </ThemedText>
      <View style={styles.row}>
        <View style={styles.dayLabels}>
          {DAY_LABELS.map((l, i) => (
            <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.dayLabel}>
              {l}
            </ThemedText>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <View>
            <View style={styles.months}>
              {weeks.map((w, i) => {
                const m = new Date(w[0]).getMonth();
                if (i === 0 || new Date(weeks[i - 1][0]).getMonth() === m) return null;
                return (
                  <ThemedText
                    key={w[0]}
                    type="small"
                    themeColor="textSecondary"
                    style={[styles.monthLabel, { left: i * (CELL + GAP) }]}>
                    {MONTHS[m].slice(0, 3)}
                  </ThemedText>
                );
              })}
            </View>
            <View style={styles.grid}>
              {weeks.map((w) => (
                <View key={w[0]} style={styles.week}>
                  {w.map((day) => {
                    const future = day > today;
                    const lvl = future ? 0 : levelOf(day);
                    return (
                      <Pressable
                        key={day}
                        disabled={future}
                        accessibilityLabel={`${fmtDateShort(day)}: ${describe(day)}`}
                        onPress={() => setSelected(day === selected ? null : day)}
                        hitSlop={1}
                        style={[
                          styles.cell,
                          {
                            backgroundColor: future ? 'transparent' : colorFor(lvl),
                            borderColor: day === selected || day === today ? theme.text : 'transparent',
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <View style={styles.legend}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
          menej
        </ThemedText>
        {[0, 1, 2, 3, 4].map((l) => (
          <View key={l} style={[styles.cell, styles.legendCell, { backgroundColor: colorFor(l) }]} />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>
          viac
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: { flexDirection: 'row' },
  dayLabels: { paddingTop: 16, marginRight: 4 },
  dayLabel: { height: CELL + GAP, fontSize: 10, lineHeight: CELL + GAP },
  months: { height: 16 },
  monthLabel: { position: 'absolute', fontSize: 10, lineHeight: 14 },
  grid: { flexDirection: 'row', paddingRight: 16 },
  week: { marginRight: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3, marginBottom: GAP, borderWidth: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end' },
  legendText: { fontSize: 11, marginHorizontal: 2 },
  legendCell: { marginBottom: 0 },
});
