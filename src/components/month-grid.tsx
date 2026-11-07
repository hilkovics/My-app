import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { WEEKDAYS_SHORT, isSameDay, monthGrid, startOfDay } from '@/lib/dates';

import { ThemedText } from './themed-text';

/** Month grid (Monday first). `dots` maps a day start → up to 3 colours. */
export function MonthGrid({
  month,
  selected,
  onSelect,
  dots,
  compact,
}: {
  month: number;
  selected: number | null;
  onSelect: (day: number) => void;
  dots?: Map<number, string[]>;
  compact?: boolean;
}) {
  const theme = useTheme();
  const days = monthGrid(month);
  const m = new Date(month).getMonth();
  const today = startOfDay(useNow());
  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS_SHORT.map((d) => (
          <ThemedText key={d} type="small" themeColor="textSecondary" style={styles.weekday}>
            {d}
          </ThemedText>
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5].map((w) => (
        <View key={w} style={styles.week}>
          {days.slice(w * 7, w * 7 + 7).map((day) => {
            const inMonth = new Date(day).getMonth() === m;
            const isSel = selected != null && isSameDay(day, selected);
            const isToday = day === today;
            const colors = dots?.get(day) ?? [];
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={new Date(day).toLocaleDateString('sk-SK')}
                onPress={() => onSelect(day)}
                style={[styles.cell, compact && styles.cellCompact]}>
                <View
                  style={[
                    styles.num,
                    isSel && { backgroundColor: theme.accent },
                    !isSel && isToday && { borderColor: theme.accent, borderWidth: 1.5 },
                  ]}>
                  <ThemedText
                    type="small"
                    style={{
                      color: isSel ? theme.accentText : inMonth ? theme.text : theme.textSecondary,
                      opacity: inMonth ? 1 : 0.5,
                      fontWeight: isToday || isSel ? 700 : 500,
                    }}>
                    {new Date(day).getDate()}
                  </ThemedText>
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
  weekday: { flex: 1, textAlign: 'center', paddingBottom: Spacing.one },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 46 },
  cellCompact: { minHeight: 38, paddingVertical: 2 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 2 },
  dotSmall: { width: 5, height: 5, borderRadius: 2.5 },
});
