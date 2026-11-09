import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OccurrenceRow } from '@/components/item-row';
import { MonthGrid } from '@/components/month-grid';
import { useCapacityGuard } from '@/components/plan/capacity-guard';
import { ThemedText } from '@/components/themed-text';
import { TimeGrid } from '@/components/time-grid';
import { Button, Card, Chip, Empty, Fab, HeaderButtons, IconButton, Screen, Segmented } from '@/components/ui';
import { FontFamily, Layout, Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { occurrencesOnDay, type Occurrence } from '@/features/calendar/agenda';
import { editOccurrence, openOccurrence } from '@/features/calendar/open';
import { useOccurrences } from '@/features/calendar/use-occurrences';
import { fmtMinutes } from '@/features/focus/stats';
import { listUnscheduledTasks, scheduleTask, updateItem } from '@/features/items/repository';
import { loadDayPlan, planSettingsOf } from '@/features/plan/data';
import { buildDayPlan } from '@/features/plan/layout';
import { getSettings } from '@/features/settings/repository';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import {
  addDays,
  addMonths,
  fmtDateLong,
  fmtDateShort,
  fmtMonthYear,
  fmtTime,
  minutesOfDay,
  monthGrid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  withTime,
} from '@/lib/dates';
import { toast } from '@/lib/toast-store';

type Mode = 'month' | 'week' | 'day';

export default function CalendarScreen() {
  const db = useDb();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('month');
  const [selected, setSelected] = useState(() => startOfDay(Date.now()));
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const [pickedTask, setPickedTask] = useState<string | null>(null);
  const settings = useLiveQuery((d) => getSettings(d), []);
  const { guard, dialog } = useCapacityGuard();
  const unscheduled = useLiveQuery((d) => listUnscheduledTasks(d), []) ?? [];

  const days = useMemo(() => {
    if (mode === 'week') {
      const s = startOfWeek(selected);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    return [selected];
  }, [mode, selected]);

  const grid = useMemo(() => monthGrid(month), [month]);
  const [from, to] = mode === 'month' ? [grid[0], addDays(grid[41], 1)] : [days[0], addDays(days[days.length - 1], 1)];
  const occurrences = useOccurrences(from, to);

  const now = useNow();
  const planSettings = settings ? planSettingsOf(settings) : null;
  // Days that hold more work than the day's capacity get a danger ring in the month view; in the
  // day / week views the blocks beyond the capacity are marked.
  let warnDays: Set<number> | undefined;
  const overflowKeys = new Set<string>();
  if (planSettings) {
    const check = mode === 'month' ? grid : days;
    if (mode === 'month') warnDays = new Set<number>();
    for (const day of check) {
      const plan = buildDayPlan(occurrencesOnDay(occurrences, day), day, planSettings, now);
      if (plan.overflowMinutes > 0) warnDays?.add(day);
      if (mode !== 'month') plan.entries.forEach((e) => e.overflow && overflowKeys.add(e.key));
    }
  }

  const dots = useMemo(() => {
    if (mode !== 'month') return undefined;
    const map = new Map<number, string[]>();
    for (const day of grid) {
      const list = occurrencesOnDay(occurrences, day);
      if (list.length) map.set(day, list.slice(0, 3).map((o) => o.color ?? theme.mark));
    }
    return map;
  }, [mode, grid, occurrences, theme.mark]);

  const step = (dir: number) => {
    if (mode === 'month') setMonth(addMonths(month, dir));
    else setSelected(addDays(selected, dir * (mode === 'week' ? 7 : 1)));
  };
  const goToday = () => {
    setSelected(startOfDay(Date.now()));
    setMonth(startOfMonth(Date.now()));
  };

  const onSlot = async (time: number) => {
    if (pickedTask) {
      // A full day can't take another task unless one is shortened or moved (dialog).
      const task = unscheduled.find((x) => x.id === pickedTask);
      if (!task) return;
      const minutes = task.estimateMinutes ?? 30;
      await guard({
        day: startOfDay(time),
        minutes,
        energy: task.energy ?? null,
        excludeId: pickedTask,
        proceed: async (d) => {
          const start = withTime(d, 0, minutesOfDay(time));
          await scheduleTask(db, task.id, start, minutes);
          setPickedTask(null);
          const before = { startAt: task.startAt, endAt: task.endAt, dueAt: task.dueAt, allDay: task.allDay };
          const plan = await loadDayPlan(db, d);
          toast(
            plan.overflowMinutes > 0
              ? `⚠ Deň je plný – +${fmtMinutes(plan.overflowMinutes)} nad kapacitu`
              : `Naplánované: ${fmtDateShort(start)} ${fmtTime(start)}`,
            { undo: () => void updateItem(db, task.id, before) },
          );
        },
      });
    } else {
      router.push({ pathname: '/item/new', params: { type: 'event', start: String(time) } });
    }
  };

  const title =
    mode === 'month'
      ? fmtMonthYear(month)
      : mode === 'week'
        ? `${new Date(days[0]).getDate()}. – ${fmtDateLong(days[6]).split(', ')[1]}`
        : fmtDateShort(selected);

  const dayList = occurrencesOnDay(occurrences, selected);
  const selOver = mode === 'month' && warnDays?.has(selected);
  const selOverMinutes =
    selOver && planSettings ? buildDayPlan(occurrencesOnDay(occurrences, selected), selected, planSettings, now).overflowMinutes : 0;
  const scheduling = !!pickedTask;

  return (
    <Screen
      title={t.tabs.calendar}
      scroll={mode === 'month'}
      actions={<HeaderButtons />}
      fab={<Fab label={t.common.add} onPress={() => router.push({ pathname: '/item/new', params: { type: 'event', date: String(selected) } })} />}>
      <View style={[styles.controls, mode !== 'month' && styles.padded]}>
        <Segmented<Mode>
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m === 'month') setMonth(startOfMonth(selected));
          }}
          options={[
            { value: 'month', label: t.calendar.month },
            { value: 'week', label: t.calendar.week },
            { value: 'day', label: t.calendar.day },
          ]}
        />
        <View style={styles.nav}>
          <IconButton name="chevronLeft" label="Späť" onPress={() => step(-1)} />
          <ThemedText type="body" tabular style={styles.navTitle} numberOfLines={1}>
            {title}
          </ThemedText>
          <Button small variant="secondary" label={t.common.today} onPress={goToday} />
          <IconButton name="chevronRight" label="Ďalej" onPress={() => step(1)} />
        </View>
      </View>

      {mode === 'month' ? (
        <>
          <View style={[styles.monthCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MonthGrid
              month={month}
              selected={selected}
              dots={dots}
              warnDays={warnDays}
              onSelect={(d) => {
                setSelected(d);
                if (new Date(d).getMonth() !== new Date(month).getMonth()) setMonth(startOfMonth(d));
              }}
            />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendRing, { borderColor: theme.accent }]} />
                <ThemedText type="axis" themeColor="text2">
                  dnes
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendRing, { borderColor: theme.danger }]} />
                <ThemedText type="axis" themeColor="text2">
                  ⚠ preplnený deň
                </ThemedText>
              </View>
            </View>
          </View>
          <Card>
            <View style={styles.dayHeader}>
              <ThemedText type="cardTitle" style={styles.flex} numberOfLines={2}>
                {fmtDateLong(selected)}
              </ThemedText>
              <Button small variant="ink" label="Otvoriť deň" onPress={() => setMode('day')} />
            </View>
            {selOver ? (
              <View style={[styles.banner, { backgroundColor: theme.dangerSoft }]}>
                <ThemedText type="bodySmall" style={{ color: theme.dangerText, fontFamily: FontFamily[800] }}>
                  ⚠ Preplnený deň: +{fmtMinutes(selOverMinutes)} nad kapacitu
                </ThemedText>
              </View>
            ) : null}
            {dayList.length ? dayList.map((o) => <OccurrenceRow key={o.key} occ={o} now={now} />) : <Empty text={t.calendar.nothing} />}
          </Card>
        </>
      ) : (
        <>
          {unscheduled.length ? (
            <View style={styles.tray}>
              <ThemedText type="label" themeColor="text2" style={styles.padded2}>
                NEPLÁNOVANÉ ÚLOHY
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trayScroll} contentContainerStyle={styles.trayList}>
                {unscheduled.map((task) => (
                  <Chip
                    key={task.id}
                    dashed
                    label={`☐ ${task.title || t.common.untitled}`}
                    selected={pickedTask === task.id}
                    color={theme.accent}
                    onPress={() => {
                      const next = pickedTask === task.id ? null : task.id;
                      setPickedTask(next);
                      if (next) setMode('day');
                    }}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
          {scheduling ? (
            <View style={[styles.hint, { backgroundColor: theme.markSoft }]}>
              <ThemedText type="bodySmall" style={[styles.flex, { fontFamily: FontFamily[700] }]}>
                {t.calendar.pickSlot}
              </ThemedText>
              <Button small variant="secondary" label={t.common.cancel} onPress={() => setPickedTask(null)} />
            </View>
          ) : null}
          <TimeGrid
            days={days}
            occurrences={occurrences}
            startHour={settings?.dayStartHour ?? 7}
            selectedDay={mode === 'week' ? selected : undefined}
            overflowKeys={overflowKeys}
            scheduling={scheduling}
            onSlotPress={(time) => void onSlot(time)}
            onOccurrenceLongPress={editOccurrence}
            onDayPress={(d) => {
              setSelected(d);
              setMode('day');
            }}
            onOccurrencePress={(o: Occurrence) => {
              if (mode === 'week') setSelected(startOfDay(o.start));
              openOccurrence(o);
            }}
          />
        </>
      )}
      {dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { gap: Spacing.two },
  padded: { paddingHorizontal: Layout.screenPaddingX, paddingBottom: Spacing.one },
  padded2: { paddingHorizontal: Layout.screenPaddingX },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: FontFamily[800] },
  monthCard: { borderRadius: Radius.cardL, borderWidth: 1, padding: 12, gap: 8 },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  banner: { borderRadius: Radius.tile, paddingVertical: 10, paddingHorizontal: 12 },
  tray: { gap: 6 },
  trayScroll: { flexGrow: 0 },
  trayList: { gap: Spacing.two, paddingHorizontal: Layout.screenPaddingX, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginHorizontal: Layout.screenPaddingX, marginTop: 8, paddingVertical: 8, paddingLeft: 14, paddingRight: 8, borderRadius: Radius.tile },
});
