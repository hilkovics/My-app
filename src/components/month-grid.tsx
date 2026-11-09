import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { WEEKDAYS_SHORT, isSameDay, monthGrid, startOfDay } from '@/lib/dates';

import { ThemedText } from './themed-text';

/**
 * Month grid (Monday first), only the weeks that touch the month. Cells are 52 px tall with a 38 px
 * circle: today = 2 px accent ring, selected = accent fill, overloaded day = 2 px danger ring + "⚠",
 * up to three 5 px dots (`dots` maps a day start → colours), outside the month at 35 %.
 */
export function MonthGrid({
  month,
  selected,
  onSelect,
  dots,
  warnDays,
  compact,
}: {
  month: number;
  selected: number | null;
  onSelect: (day: number) => void;
  dots?: Map<number, string[]>;
  /** Days that are overloaded. */
  warnDays?: Set<number>;
  compact?: boolean;
}) {
  const theme = useTheme();
  const days = monthGrid(month);
  const m = new Date(month).getMonth();
  const today = startOfDay(useNow());
  const weeks = [0, 1, 2, 3, 4, 5].filter((w) => days.slice(w * 7, w * 7 + 7).some((d) => new Date(d).getMonth() === m));
  const circle = compact ? 32 : 38;
  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS_SHORT.map((d) => (
          <ThemedText key={d} type="axis" themeColor="text2" style={styles.weekday}>
            {d}
          </ThemedText>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w} style={styles.week}>
          {days.slice(w * 7, w * 7 + 7).map((day) => {
            const inMonth = new Date(day).getMonth() === m;
            const isSel = selected != null && isSameDay(day, selected);
            const isToday = day === today;
            const warn = !!warnDays?.has(day);
            const colors = dots?.get(day) ?? [];
            const d = new Date(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}${isToday ? ', dnes' : ''}${warn ? ', preplnený deň' : ''}`}
                accessibilityState={{ selected: isSel }}
                onPress={() => onSelect(day)}
                style={[styles.cell, compact ? styles.cellCompact : null, !inMonth && { opacity: 0.35 }]}>
                <View
                  style={[
                    styles.num,
                    { width: circle, height: circle, borderRadius: circle / 2 },
                    isSel && { backgroundColor: theme.accent },
                    !isSel && isToday && { borderColor: theme.accent, borderWidth: 2 },
                    !isSel && !isToday && warn && { borderColor: theme.danger, borderWidth: 2 },
                    isSel && warn && { borderColor: theme.danger, borderWidth: 2 },
                  ]}>
                  <ThemedText
                    type="body"
                    tabular
                    style={{ color: isSel ? theme.onAccent : theme.text, fontFamily: isToday || isSel ? FontFamily[800] : FontFamily[600], fontSize: 15 }}>
                    {d.getDate()}
                  </ThemedText>
                  {warn ? (
                    <ThemedText style={[styles.warn, { color: theme.dangerText }]} accessibilityElementsHidden>
                      ⚠
                    </ThemedText>
                  ) : null}
                </View>
                <View style={styles.dots}>
                  {colors.slice(0, 3).map((c, i) => (
                    <View key={i} style={[styles.dotSmall, { backgroundColor: c }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}


const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingBottom: 6, fontFamily: FontFamily[800] },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
  cellCompact: { minHeight: 44 },
  num: { alignItems: 'center', justifyContent: 'center' },
  warn: { position: 'absolute', top: -6, right: -4, fontSize: 10, lineHeight: 12 },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dotSmall: { width: 5, height: 5, borderRadius: 2.5 },
});
