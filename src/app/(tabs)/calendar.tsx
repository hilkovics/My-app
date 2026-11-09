import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OccurrenceRow } from '@/components/item-row';
import { MonthGrid } from '@/components/month-grid';
import { ThemedText } from '@/components/themed-text';
import { TimeGrid } from '@/components/time-grid';
import { Button, Card, Chip, Empty, Fab, IconButton, Row, Screen, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { occurrencesOnDay, type Occurrence } from '@/features/calendar/agenda';
import { editOccurrence, openOccurrence } from '@/features/calendar/open';
import { useOccurrences } from '@/features/calendar/use-occurrences';
import { listUnscheduledTasks, scheduleTask } from '@/features/items/repository';
import { planSettingsOf } from '@/features/plan/data';
import { buildDayPlan } from '@/features/plan/layout';
import { getSettings } from '@/features/settings/repository';
import { useNow } from '@/hooks/use-now';
import { useCapacityGuard } from '@/components/plan/capacity-guard';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import {
  addDays,
  addMonths,
  fmtDateLong,
  fmtMonthYear,
  minutesOfDay,
  monthGrid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  withTime,
} from '@/lib/dates';

type Mode = 'month' | 'week' | 'day';

export default function CalendarScreen() {
  const db = useDb();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('month');
  const [selected, setSelected] = useState(() => startOfDay(Date.now()));
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const [blockingTask, setBlockingTask] = useState<string | null>(null);
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
  // Days that hold more work than the day's capacity get a red ring in the month view.
  let warnDays: Set<number> | undefined;
  if (mode === 'month' && planSettings) {
    warnDays = new Set<number>();
    for (const day of grid) {
      if (buildDayPlan(occurrencesOnDay(occurrences, day), day, planSettings, now).overflowMinutes > 0) warnDays.add(day);
    }
  }

  const dots = useMemo(() => {
    if (mode !== 'month') return undefined;
    const map = new Map<number, string[]>();
    for (const day of grid) {
      const list = occurrencesOnDay(occurrences, day);
      if (list.length) map.set(day, list.slice(0, 3).map((o) => o.color ?? theme.accent));
    }
    return map;
  }, [mode, grid, occurrences, theme.accent]);

  const step = (dir: number) => {
    if (mode === 'month') setMonth(addMonths(month, dir));
    else setSelected(addDays(selected, dir * (mode === 'week' ? 7 : 1)));
  };
  const goToday = () => {
    setSelected(startOfDay(Date.now()));
    setMonth(startOfMonth(Date.now()));
  };

  const onSlot = async (time: number) => {
    if (blockingTask) {
      // A full day can't take another task unless one is shortened or moved (dialog).
      const task = unscheduled.find((x) => x.id === blockingTask);
      const minutes = task?.estimateMinutes ?? 60;
      await guard({
        day: startOfDay(time),
        minutes,
        energy: task?.energy ?? null,
        excludeId: blockingTask,
        proceed: async (d) => {
          await scheduleTask(db, blockingTask, withTime(d, 0, minutesOfDay(time)), minutes);
          setBlockingTask(null);
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
        : fmtDateLong(selected);

  const dayList = occurrencesOnDay(occurrences, selected);

  return (
    <Screen
      title={t.tabs.calendar}
      scroll={mode === 'month'}
      actions={
        <>
          <IconButton name="search" label={t.common.search} onPress={() => router.push('/search')} />
          <IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />
        </>
      }
      fab={
        <Fab
          label={t.common.add}
          onPress={() => router.push({ pathname: '/item/new', params: { type: 'event', date: String(selected) } })}
        />
      }>
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
          <ThemedText type="smallBold" style={styles.navTitle} numberOfLines={1}>
            {title}
          </ThemedText>
          <Button small variant="secondary" label={t.common.today} onPress={goToday} />
          <IconButton name="chevronRight" label="Ďalej" onPress={() => step(1)} />
        </View>
      </View>

      {mode === 'month' ? (
        <>
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
          <Card>
            <Row style={styles.dayHeader}>
              <ThemedText type="smallBold">{fmtDateLong(selected)}</ThemedText>
              <Button small variant="ghost" label="Otvoriť deň" onPress={() => setMode('day')} />
            </Row>
            {dayList.length ? (
              dayList.map((o) => <OccurrenceRow key={o.key} occ={o} />)
            ) : (
              <Empty text={t.calendar.nothing} />
            )}
          </Card>
        </>
      ) : (
        <>
          <View style={[styles.tray, styles.padded]}>
            <ThemedText type="smallBold" themeColor="text2">
              {blockingTask ? t.calendar.pickSlot : t.calendar.unscheduled}
            </ThemedText>
            {blockingTask ? (
              <Button small variant="secondary" label={t.common.cancel} onPress={() => setBlockingTask(null)} />
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.trayScroll}
            contentContainerStyle={styles.trayList}>
            {unscheduled.length ? (
              unscheduled.map((task) => (
                <Chip
                  key={task.id}
                  label={task.title || t.common.untitled}
                  color={task.color}
                  selected={blockingTask === task.id}
                  onPress={() => setBlockingTask(blockingTask === task.id ? null : task.id)}
                />
              ))
            ) : (
              <ThemedText type="small" themeColor="text2">
                {t.calendar.noUnscheduled}
              </ThemedText>
            )}
          </ScrollView>
          <TimeGrid
            days={days}
            occurrences={occurrences}
            startHour={settings?.dayStartHour ?? 7}
            highlightSlots={!!blockingTask}
            onSlotPress={(time) => void onSlot(time)}
            onOccurrenceLongPress={editOccurrence}
            onOccurrencePress={(o: Occurrence) => {
              if (mode === 'week' && !blockingTask) setSelected(startOfDay(o.start));
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
  controls: { gap: Spacing.two },
  padded: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  navTitle: { flex: 1, textAlign: 'center' },
  dayHeader: { justifyContent: 'space-between' },
  tray: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 0 },
  trayScroll: { flexGrow: 0 },
  trayList: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, alignItems: 'center' },
});
