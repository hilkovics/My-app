import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { Spacing } from '@/constants/theme';
import { layoutDay, occurrencesOnDay, type Occurrence } from '@/features/calendar/agenda';
import { shade, withAlpha } from '@/lib/color';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { WEEKDAYS_SHORT, addDays, fmtTime, minutesOfDay, startOfDay, weekdayIndex, withTime } from '@/lib/dates';

import { ThemedText } from './themed-text';

const HOUR_HEIGHT = 52;
const LABEL_WIDTH = 44;

/**
 * Day / week timeline. Tapping an empty half-hour slot calls onSlotPress (used for creating
 * events and for time-blocking a selected task).
 */
export function TimeGrid({
  days,
  occurrences,
  startHour = 7,
  onSlotPress,
  onOccurrencePress,
  onOccurrenceLongPress,
  highlightSlots,
}: {
  days: number[];
  occurrences: Occurrence[];
  startHour?: number;
  onSlotPress?: (time: number) => void;
  onOccurrencePress: (occ: Occurrence) => void;
  onOccurrenceLongPress?: (occ: Occurrence) => void;
  highlightSlots?: boolean;
}) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const now = useNow();
  const today = startOfDay(now);
  const firstDay = days[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: startHour * HOUR_HEIGHT, animated: false });
  }, [startHour, firstDay]);

  const allDayByDay = days.map((d) => occurrencesOnDay(occurrences, d).filter((o) => o.allDay));
  const hasAllDay = allDayByDay.some((l) => l.length);

  return (
    <View style={styles.flex}>
      {days.length > 1 ? (
        <View style={[styles.headerRow, { borderColor: theme.border }]}>
          <View style={{ width: LABEL_WIDTH }} />
          {days.map((d) => (
            <View key={d} style={styles.dayHeader}>
              <ThemedText type="small" themeColor="textSecondary">
                {WEEKDAYS_SHORT[weekdayIndex(d)]}
              </ThemedText>
              <View style={[styles.dayNum, d === today && { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={d === today ? { color: theme.accentText } : undefined}>
                  {new Date(d).getDate()}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {hasAllDay ? (
        <View style={[styles.headerRow, { borderColor: theme.border }]}>
          <View style={{ width: LABEL_WIDTH }} />
          {allDayByDay.map((list, i) => (
            <View key={days[i]} style={[styles.flex, styles.allDayCol]}>
              {list.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => onOccurrencePress(o)}
                  onLongPress={onOccurrenceLongPress ? () => onOccurrenceLongPress(o) : undefined}
                  style={[styles.allDayChip, { backgroundColor: o.color ?? theme.accent }]}>
                  <ThemedText type="small" numberOfLines={1} style={styles.eventText}>
                    {o.hasNote ? '📝 ' : ''}
                    {o.title}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.gridRow}>
          <View style={{ width: LABEL_WIDTH }}>
            {Array.from({ length: 24 }, (_, h) => (
              <View key={h} style={{ height: HOUR_HEIGHT }}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.hourLabel}>
                  {h ? `${h}:00` : ''}
                </ThemedText>
              </View>
            ))}
          </View>
          {days.map((day) => {
            const laid = layoutDay(occurrencesOnDay(occurrences, day).filter((o) => !o.allDay));
            return (
              <View key={day} style={[styles.dayCol, { borderColor: theme.border }]}>
                {Array.from({ length: 48 }, (_, i) => (
                  <Pressable
                    key={i}
                    disabled={!onSlotPress}
                    accessibilityLabel={`${fmtTime(withTime(day, 0, i * 30))}`}
                    onPress={() => onSlotPress?.(withTime(day, 0, i * 30))}
                    style={({ pressed }) => [
                      styles.slot,
                      i % 2 === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                      highlightSlots && { backgroundColor: theme.backgroundElement },
                      pressed && { backgroundColor: theme.backgroundSelected },
                    ]}
                  />
                ))}
                {laid.map(({ occ, column, columns }) => {
                  const dayStart = startOfDay(day);
                  const s = Math.max(occ.start, dayStart);
                  const e = Math.min(Math.max(occ.end, occ.start + 20 * 60_000), addDays(dayStart, 1));
                  const top = (s === dayStart && occ.start < dayStart ? 0 : minutesOfDay(s)) * (HOUR_HEIGHT / 60);
                  const height = Math.max(20, ((e - s) / 60_000) * (HOUR_HEIGHT / 60) - 2);
                  const color = occ.color ?? theme.accent;
                  const isTask = occ.kind === 'block' || occ.kind === 'due';
                  // Only an explicit "deep work" / "break" changes the look here; routine stays as it was.
                  const deepWork = occ.energy === 'deep';
                  const restBreak = occ.energy === 'rest';
                  return (
                    <Pressable
                      key={occ.key}
                      onPress={() => onOccurrencePress(occ)}
                      onLongPress={onOccurrenceLongPress ? () => onOccurrenceLongPress(occ) : undefined}
                      style={[
                        styles.event,
                        {
                          top,
                          height,
                          left: `${(column / columns) * 100}%`,
                          width: `${100 / columns}%`,
                          backgroundColor: restBreak ? withAlpha(theme.success, 0.22) : isTask ? theme.background : color,
                          borderColor: restBreak ? theme.success : deepWork ? shade(color, -0.4) : color,
                          borderWidth: deepWork ? 3 : 1.5,
                          borderStyle: occ.kind === 'due' || restBreak ? 'dashed' : 'solid',
                          opacity: occ.done ? 0.5 : 1,
                        },
                      ]}>
                      <ThemedText
                        type="small"
                        numberOfLines={height > 40 ? 2 : 1}
                        style={[styles.eventText, (isTask || restBreak) && { color: theme.text }]}>
                        {deepWork ? '🔥 ' : restBreak ? '☕ ' : ''}
                        {isTask ? '☐ ' : ''}
                        {occ.hasNote ? '📝 ' : ''}
                        {occ.title}
                      </ThemedText>
                      {height > 40 && occ.kind !== 'due' ? (
                        <ThemedText type="small" style={[styles.eventTime, isTask && { color: theme.textSecondary }]}>
                          {fmtTime(occ.start)}–{fmtTime(occ.end)}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
                {startOfDay(day) === today ? (
                  <View
                    pointerEvents="none"
                    style={[styles.nowLine, { top: minutesOfDay(now) * (HOUR_HEIGHT / 60), backgroundColor: theme.danger }]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  dayHeader: { flex: 1, alignItems: 'center', gap: 2 },
  dayNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  allDayCol: { gap: 2, paddingHorizontal: 1 },
  allDayChip: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  gridRow: { flexDirection: 'row' },
  hourLabel: { fontSize: 11, marginTop: -8, textAlign: 'right', paddingRight: 6 },
  dayCol: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, position: 'relative' },
  slot: { height: HOUR_HEIGHT / 2 },
  event: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
    marginLeft: 1,
  },
  eventText: { color: '#fff', fontWeight: 600, fontSize: 12, lineHeight: 15 },
  eventTime: { color: '#ffffffcc', fontSize: 11, lineHeight: 14 },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  spacer: { height: Spacing.two },
});
