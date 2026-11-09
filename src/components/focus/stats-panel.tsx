import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FontFamily, Radius, Spacing } from '@/constants/theme';
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
import { useTheme } from '@/hooks/use-theme';
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
import { Card, Chip, IconButton, Row, Section, Segmented } from '../ui';

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
  const title =
    period === 'week' ? `${fmtDateShort(from).slice(3)} – ${fmtDateShort(addDays(to, -1)).slice(3)}` : fmtMonthYear(from);
  const selectedIndex = series.findIndex((d) => d.day === today);

  return (
    <>
      <Segmented<Period>
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setAnchor(today);
        }}
        options={[
          { value: 'week', label: t.calendar.week },
          { value: 'month', label: t.calendar.month },
        ]}
      />
      <Row style={styles.nav}>
        <IconButton name="chevronLeft" label="Späť" onPress={() => step(-1)} />
        <ThemedText type="smallBold" style={styles.navTitle}>
          {title}
        </ThemedText>
        <IconButton name="chevronRight" label="Ďalej" onPress={() => step(1)} />
      </Row>

      <View style={styles.tiles}>
        <Tile label={t.focus.total} value={fmtMinutes(sum.totalMinutes)} />
        <Tile label={t.focus.average} value={fmtMinutes(sum.avgMinutes)} />
        <Tile
          label={t.focus.bestDay}
          value={sum.best ? fmtMinutes(sum.best.minutes) : '–'}
          sub={sum.best ? fmtDateShort(sum.best.day) : undefined}
        />
        <Tile label={t.focus.streak} value={`🔥 ${streak}`} sub={t.focus.streakSub} />
      </View>

      <Card>
        <ThemedText type="smallBold">{t.focus.perDay}</ThemedText>
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
        />
        <ThemedText type="small" themeColor="text2">
          {t.focus.daysWithGoal}: {sum.daysWithGoal}
        </ThemedText>
      </Card>

      <Section title={t.focus.dailyGoal}>
        <Row>
          {GOALS.map((g) => (
            <Chip key={g} label={fmtMinutes(g)} selected={goal === g} onPress={() => void setSetting(db, 'focusGoalMinutes', g)} />
          ))}
        </Row>
      </Section>

      <Card>
        <ThemedText type="smallBold">{t.focus.byHour}</ThemedText>
        <ThemedText type="small" themeColor="text2">
          {bestWin ? `${t.focus.bestWindow} ${bestWin[0]}:00 – ${bestWin[1]}:00.` : t.focus.noData}
        </ThemedText>
        <ColumnChart
          height={100}
          data={byHour.map((v, h) => ({
            key: String(h),
            label: h % 6 === 0 ? `${h}h` : '',
            value: v,
            title: `${h}:00–${h + 1}:00`,
          }))}
          formatValue={(v) => `${fmtMinutes(v)} ${t.focus.in30days}`}
        />
      </Card>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface }]}>
      <ThemedText type="small" themeColor="text2">
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
      {sub ? (
        <ThemedText type="small" themeColor="text2">
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  navTitle: { flex: 1, textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: Radius.card, padding: Spacing.three, gap: 2 },
  tileValue: { fontSize: 22, lineHeight: 28, fontFamily: FontFamily[800] },
});
