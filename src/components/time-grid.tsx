import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { ACTIVITY_COLORS, FontFamily, Radius } from '@/constants/theme';
import { layoutDay, occurrencesOnDay, type Occurrence } from '@/features/calendar/agenda';
import { DAY_VIEW, WEEK_VIEW, blockGeometry, blockStyleOf, blockTitle } from '@/features/calendar/blocks';
import { entityColor } from '@/features/plan/entity-color';
import { hexA, onColor } from '@/lib/color';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { WEEKDAYS_SHORT, fmtTime, minutesOfDay, startOfDay, weekdayIndex, withTime } from '@/lib/dates';

import { ThemedText } from './themed-text';

/**
 * Day / week timeline. Day (1 column): 56 px per hour, 52 px gutter, up to 22:00. Week (7 columns):
 * 36 px per hour, 34 px gutter, up to 20:00. The first hour comes from the settings. Block encoding:
 * event = solid colour, task = outline "☐", deep task = tint + 3 px border "☐ 🔥", pause = dashed "☕".
 * Tapping an empty half-hour slot calls onSlotPress (create an event / time-block the picked task).
 */
export function TimeGrid({
  days,
  occurrences,
  startHour = 7,
  selectedDay,
  overflowKeys,
  onSlotPress,
  onOccurrencePress,
  onOccurrenceLongPress,
  onDayPress,
  scheduling,
}: {
  days: number[];
  occurrences: Occurrence[];
  startHour?: number;
  /** Week view: the column that gets a tint and an outlined number. */
  selectedDay?: number;
  /** Keys of blocks beyond the day's capacity ("⚠" prefix, danger border). */
  overflowKeys?: Set<string>;
  onSlotPress?: (time: number) => void;
  onOccurrencePress: (occ: Occurrence) => void;
  onOccurrenceLongPress?: (occ: Occurrence) => void;
  /** Week view: tapping a day header opens that day. */
  onDayPress?: (day: number) => void;
  /** A task is picked for time-blocking: dashed slots, blocks don't react. */
  scheduling?: boolean;
}) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const now = useNow();
  const today = startOfDay(now);
  const week = days.length > 1;
  const spec = week ? WEEK_VIEW : DAY_VIEW;
  const firstHour = Math.min(startHour, spec.lastHour - 2);
  const hours = spec.lastHour - firstHour;
  const gutter = spec.gutter;
  const gridHeight = hours * spec.pxPerHour;
  const view = { firstHour, lastHour: spec.lastHour, pxPerHour: spec.pxPerHour, minHeight: spec.minHeight };
  const px = spec.pxPerHour / 60;
  const firstDay = days[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [firstDay, firstHour]);

  const allDayByDay = days.map((d) => occurrencesOnDay(occurrences, d).filter((o) => o.allDay));
  const hasAllDay = allDayByDay.some((l) => l.length);
  const colorOf = (o: Occurrence) => entityColor(o.id, o.color, ACTIVITY_COLORS[theme.mode]);

  return (
    <View style={styles.flex}>
      {week ? (
        <View style={[styles.headerRow, { borderColor: theme.border }]}>
          <View style={{ width: gutter }} />
          {days.map((d) => {
            const isToday = d === today;
            const isSel = d === selectedDay;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAYS_SHORT[weekdayIndex(d)]} ${new Date(d).getDate()}. ${new Date(d).getMonth() + 1}.${isToday ? ', dnes' : ''}`}
                onPress={() => onDayPress?.(d)}
                style={[styles.dayHeader, isSel && { backgroundColor: theme.markSoft }]}>
                <ThemedText type="axis" themeColor="text2" style={{ fontFamily: FontFamily[800] }}>
                  {WEEKDAYS_SHORT[weekdayIndex(d)]}
                </ThemedText>
                <View
                  style={[
                    styles.dayNum,
                    isToday && { backgroundColor: theme.accent },
                    !isToday && isSel && { borderColor: theme.text, borderWidth: 2 },
                  ]}>
                  <ThemedText type="bodySmall" tabular style={{ fontFamily: FontFamily[800], color: isToday ? theme.onAccent : theme.text }}>
                    {new Date(d).getDate()}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {hasAllDay ? (
        <View style={[styles.headerRow, { borderColor: theme.border }]}>
          <View style={{ width: gutter }} />
          {allDayByDay.map((list, i) => (
            <View key={days[i]} style={[styles.flex, styles.allDayCol]}>
              {list.map((o) => {
                const c = colorOf(o);
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => onOccurrencePress(o)}
                    onLongPress={onOccurrenceLongPress ? () => onOccurrenceLongPress(o) : undefined}
                    style={[styles.allDayChip, week ? styles.allDayWeek : styles.allDayDay, { backgroundColor: c }]}>
                    <ThemedText type="axis" numberOfLines={1} style={{ color: onColor(c), fontSize: week ? 9 : 12, lineHeight: week ? 14 : 16, fontFamily: FontFamily[700] }}>
                      {o.title}
                      {o.hasNote ? ' 📝' : ''}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={[styles.gridRow, { height: gridHeight }]}>
          <View style={{ width: gutter }}>
            {Array.from({ length: hours }, (_, i) => (
              <View key={i} style={{ height: spec.pxPerHour }}>
                <ThemedText type="axis" themeColor="text2" tabular style={[styles.hourLabel, { fontFamily: FontFamily[700] }]}>
                  {i === 0 ? '' : week ? String(firstHour + i) : `${firstHour + i}:00`}
                </ThemedText>
              </View>
            ))}
          </View>
          {days.map((day) => {
            const laid = layoutDay(occurrencesOnDay(occurrences, day).filter((o) => !o.allDay));
            const isTodayCol = day === today;
            return (
              <View
                key={day}
                style={[
                  styles.dayCol,
                  { borderColor: theme.border },
                  week && day === selectedDay && { backgroundColor: theme.markSoft },
                ]}>
                {Array.from({ length: hours * 2 }, (_, i) => (
                  <Pressable
                    key={i}
                    disabled={!onSlotPress}
                    accessibilityLabel={`${fmtTime(withTime(day, 0, firstHour * 60 + i * 30))}`}
                    onPress={() => onSlotPress?.(withTime(day, 0, firstHour * 60 + i * 30))}
                    style={({ pressed }) => [
                      styles.slot,
                      { height: spec.pxPerHour / 2 },
                      i % 2 === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                      scheduling && {
                        backgroundColor: hexA(theme.mark, 0.05),
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: hexA(theme.mark, 0.4),
                        height: spec.pxPerHour / 2 - 1,
                        marginBottom: 1,
                      },
                      pressed && { backgroundColor: scheduling ? hexA(theme.mark, 0.22) : theme.surface2 },
                    ]}
                  />
                ))}
                {laid.map(({ occ, column, columns }) => {
                  const geo = blockGeometry(occ, day, view);
                  if (!geo) return null;
                  const style = blockStyleOf(occ);
                  const over = overflowKeys?.has(occ.key) ?? false;
                  const c = colorOf(occ);
                  const past = (day === today && occ.end <= now) || day < today;
                  const box =
                    style === 'event'
                      ? { backgroundColor: c, borderColor: c, borderWidth: 0, fg: onColor(c) }
                      : style === 'deep'
                        ? { backgroundColor: hexA(theme.mark, 0.12), borderColor: theme.mark, borderWidth: 3, fg: theme.text }
                        : style === 'pause'
                          ? { backgroundColor: hexA(theme.success, 0.18), borderColor: theme.success, borderWidth: 1.5, fg: theme.text }
                          : { backgroundColor: theme.bg, borderColor: theme.mark, borderWidth: 1.5, fg: theme.text };
                  const tall = geo.height >= 40;
                  const small = geo.height < 26;
                  return (
                    <Pressable
                      key={occ.key}
                      disabled={scheduling}
                      accessibilityRole="button"
                      accessibilityLabel={`${blockTitle(occ, undefined, over)}, ${fmtTime(occ.start)}–${fmtTime(occ.end)}`}
                      onPress={() => onOccurrencePress(occ)}
                      onLongPress={onOccurrenceLongPress ? () => onOccurrenceLongPress(occ) : undefined}
                      style={[
                        styles.event,
                        {
                          top: geo.top,
                          height: geo.height,
                          left: `${(column / columns) * 100}%`,
                          width: `${100 / columns}%`,
                          borderRadius: week ? 5 : Radius.calBlockDay,
                          backgroundColor: box.backgroundColor,
                          borderColor: over ? theme.danger : box.borderColor,
                          borderWidth: over ? 2 : box.borderWidth,
                          borderStyle: style === 'pause' ? 'dashed' : 'solid',
                          paddingHorizontal: week ? 3 : small ? 8 : 10,
                          paddingVertical: week ? 1 : small ? 0 : 6,
                          opacity: past ? 0.55 : 1,
                        },
                      ]}>
                      <ThemedText
                        type="bodySmall"
                        numberOfLines={tall && !week ? 2 : 1}
                        style={{
                          color: box.fg,
                          fontFamily: FontFamily[700],
                          fontSize: week ? 9 : small ? 11 : 14,
                          lineHeight: week ? 12 : small ? 14 : 18,
                          textDecorationLine: occ.done ? 'line-through' : 'none',
                        }}>
                        {blockTitle(occ, undefined, over)}
                      </ThemedText>
                      {tall && !week && occ.kind !== 'due' ? (
                        <ThemedText type="axis" tabular style={{ color: box.fg, opacity: 0.85, fontSize: 12, lineHeight: 15 }}>
                          {fmtTime(occ.start)}–{fmtTime(occ.end)}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
                {isTodayCol && minutesOfDay(now) >= firstHour * 60 && minutesOfDay(now) <= spec.lastHour * 60 ? (
                  <View
                    pointerEvents="none"
                    style={[styles.nowLine, { top: (minutesOfDay(now) - firstHour * 60) * px - 1, backgroundColor: theme.danger }]}>
                    {!week ? <View style={[styles.nowDot, { backgroundColor: theme.danger }]} /> : null}
                  </View>
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
  dayHeader: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4, borderRadius: Radius.buttonSquare },
  dayNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  allDayCol: { gap: 2, paddingHorizontal: 1 },
  allDayChip: { borderRadius: 5, paddingHorizontal: 5 },
  allDayWeek: { minHeight: 18, justifyContent: 'center' },
  allDayDay: { minHeight: 28, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 10 },
  gridRow: { flexDirection: 'row' },
  hourLabel: { fontSize: 11, marginTop: -7, textAlign: 'right', paddingRight: 8 },
  dayCol: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, position: 'relative' },
  slot: {},
  event: { position: 'absolute', overflow: 'hidden', marginLeft: 1, marginRight: 1, justifyContent: 'center' },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  nowDot: { position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 5 },
});
