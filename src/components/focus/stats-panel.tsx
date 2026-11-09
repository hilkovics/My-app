import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { listSessions } from '@/features/focus/repository';
import {
  bestWindow,
  dailySeries,
  fmtMinutes,
  goalStreak,
  minutesByDay,
  minutesByHour,
  summarize,
} from '@/features/focus/stats';
import { getSettings, setSetting } from '@/features/settings/repository';
import { useNow } from '@/hooks/use-now';
import { t } from '@/i18n/sk';
import {
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  fmtDateShort,
  fmtMonthYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekdayIndex,
} from '@/lib/dates';

import { ColumnChart } from '../column-chart';
import { ThemedText } from '../themed-text';
import { Card, Chip, IconButton, Section, Segmented, StatTile } from '../ui';

type Period = 'week' | 'month';
const GOALS = [60, 120, 180, 240, 300, 360];

export function StatsPanel() {
  const db = useDb();
  const now = useNow();
  const today = startOfDay(now);
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(today);
  const settings = useLiveQuery((d) => getSettings(d), []);
  const goal = settings?.focusGoalMinutes ?? 180;

  const from = period === 'week' ? startOfWeek(anchor) : startOfMonth(anchor);
  const days = period === 'week' ? 7 : Math.round((addMonths(from, 1) - from) / 86_400_000);
  const to = addDays(from, days);
  // Load enough history for the streak and the 30-day hour profile.
  const histFrom = Math.min(from, addDays(today, -400));
  const sessions = useLiveQuery((d) => listSessions(d, histFrom, Math.max(to, addDays(today, 1))), [histFrom, to, today]) ?? [];

  const byDay = minutesByDay(sessions, now);
  const series = dailySeries(byDay, from, days);
  const sum = summarize(series, goal, now);
  const streak = goalStreak(byDay, goal, now);
  const last30 = sessions.filter((s) => (s.endedAt ?? now) > addDays(today, -29));
  const byHour = minutesByHour(last30, now);
  const bestWin = bestWindow(byHour);

  const step = (dir: number) => setAnchor(period === 'week' ? addDays(anchor, dir * 7) : addMonths(anchor, dir));
  const lastDay = addDays(to, -1);
  const [d1, d2] = [new Date(from), new Date(lastDay)];
  const title =
    period === 'week'
      ? d1.getMonth() === d2.getMonth()
        ? `${d1.getDate()}. – ${d2.getDate()}. ${d2.getMonth() + 1}.`
        : `${d1.getDate()}. ${d1.getMonth() + 1}. – ${d2.getDate()}. ${d2.getMonth() + 1}.`
      : fmtMonthYear(from);
  const selectedIndex = series.findIndex((d) => d.day === today);

  const bestRange = bestWin ?? null;

  return (
    <>
      <View style={styles.periodRow}>
        <View style={styles.segment}>
          <Segmented<Period>
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setAnchor(today);
            }}
            variant="filter"
            options={[
              { value: 'week', label: t.calendar.week },
              { value: 'month', label: t.calendar.month },
            ]}
          />
        </View>
        <ThemedText type="bodySmall" tabular style={{ fontFamily: FontFamily[800] }}>
          {title}
        </ThemedText>
      </View>

      <View style={styles.tiles}>
        <StatTile basis="45%" label={t.focus.total} value={fmtMinutes(sum.totalMinutes)} />
        <StatTile basis="45%" label={t.focus.average} value={fmtMinutes(sum.avgMinutes)} />
        <StatTile basis="45%" label={t.focus.bestDay} value={sum.best ? fmtMinutes(sum.best.minutes) : '–'} sub={sum.best ? fmtDateShort(sum.best.day) : undefined} />
        <StatTile basis="45%" label={t.focus.streak} value={`🔥 ${streak}`} sub={t.focus.streakSub} />
      </View>

      <Card>
        <View style={styles.cardHead}>
          <ThemedText type="cardTitle" style={styles.flex}>
            {t.focus.perDay}
          </ThemedText>
          <IconButton name="chevronLeft" label="Predchádzajúce obdobie" onPress={() => step(-1)} />
          <IconButton name="chevronRight" label="Nasledujúce obdobie" onPress={() => step(1)} />
        </View>
        <ColumnChart
          key={`${period}-${from}`}
          data={series.map((d, i) => ({
            key: String(d.day),
            label:
              period === 'week'
                ? WEEKDAYS_SHORT[weekdayIndex(d.day)]
                : i % 5 === 0 || i === days - 1
                  ? String(new Date(d.day).getDate())
                  : '',
            value: d.minutes,
            title: fmtDateShort(d.day),
          }))}
          goal={goal}
          goalLabel={`${t.focus.goal} ${fmtMinutes(goal)}`}
          formatValue={fmtMinutes}
          initialSelected={selectedIndex >= 0 ? selectedIndex : undefined}
          yTicks={[120, 240]}
          highlight={(i) => series[i]?.day === today}
          valuesToggle
        />
        <ThemedText type="meta" themeColor="text2" tabular>
          {t.focus.daysWithGoal}: {sum.daysWithGoal}
        </ThemedText>
      </Card>

      <Section title={t.focus.dailyGoal}>
        <View style={styles.goalChips}>
          {GOALS.map((g) => (
            <Chip key={g} label={fmtMinutes(g)} selected={goal === g} onPress={() => void setSetting(db, 'focusGoalMinutes', g)} />
          ))}
        </View>
      </Section>

      <Card>
        <ThemedText type="cardTitle">{t.focus.byHour}</ThemedText>
        <ThemedText type="bodySmall" themeColor="text2">
          {bestRange ? `${t.focus.bestWindow} ${bestRange[0]}:00 – ${bestRange[1]}:00.` : t.focus.noData}
        </ThemedText>
        <ColumnChart
          height={100}
          data={byHour.map((v, h) => ({
            key: String(h),
            label: h === 0 || h === 6 || h === 12 || h === 18 ? `${h}:00` : h === 23 ? '23:00' : '',
            value: v,
            title: `${h}:00–${h + 1}:00`,
          }))}
          formatValue={(v) => `${fmtMinutes(v)} ${t.focus.in30days}`}
          highlight={(h) => bestRange != null && h >= bestRange[0] && h < bestRange[1]}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  segment: { width: 180 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginRight: -8 },
  goalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
