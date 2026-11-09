import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ColumnChart } from '@/components/column-chart';
import { Heatmap } from '@/components/heatmap';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, IconButton, Meter, Row, Section } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  getActivity,
  getRunningActivity,
  listLogs,
  listRecentLogs,
  logDuration,
  startActivity,
  type Activity,
  type ActivityLog,
} from '@/features/activities/repository';
import {
  dayValues,
  fmtDistance,
  fmtGoal,
  fmtPace,
  heatLevel,
  heatScale,
  recentWeekStarts,
  weekStreak,
  weekValue,
  yearGrid,
} from '@/features/activities/stats';
import { fmtMinutes } from '@/features/focus/stats';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { MINUTE, fmtDateShort, fmtTime, plural, startOfDay, ymd } from '@/lib/dates';

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const now = useNow();
  const today = startOfDay(now);
  const grid = yearGrid(today);
  const data = useLiveQuery(
    async (d) => ({
      activity: await getActivity(d, id),
      logs: await listLogs(d, ymd(grid[0][0]), ymd(today), id),
      recent: await listRecentLogs(d, id, 200),
      running: await getRunningActivity(d),
    }),
    [id, today],
  );
  if (!data) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!data.activity) {
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: theme.bg }]}>
        <Empty text={t.item.notFound} />
      </View>
    );
  }
  return <Detail activity={data.activity} logs={data.logs} recent={data.recent} running={data.running} grid={grid} now={now} />;
}

function Detail({
  activity: a,
  logs,
  recent,
  running,
  grid,
  now,
}: {
  activity: Activity;
  logs: ActivityLog[];
  recent: ActivityLog[];
  running: ActivityLog | null;
  grid: number[][];
  now: number;
}) {
  const db = useDb();
  const theme = useTheme();
  const values = dayValues(logs, a, now);
  const scale = heatScale(values.values(), a.kind === 'check' ? a.targetPerDay : null);
  const weeks = recentWeekStarts(now, 12);
  const thisWeek = weeks[weeks.length - 1];
  const goalNow = a.goalType ? weekValue(a, logs, thisWeek, now) : 0;
  const streak = weekStreak(a, logs, now);
  // Weekly chart in the goal's unit (minutes when there is no goal; days done for habits).
  const unitOf = (w: number) => (a.goalType || a.kind === 'check' ? weekValue({ ...a, goalType: a.goalType ?? 'sessions' }, logs, w, now) : weekMinutes(logs, w, now));
  const fmtUnit = (v: number) =>
    a.goalType === 'km' ? fmtDistance(v * 1000) : a.goalType === 'minutes' || (!a.goalType && a.kind === 'timed') ? fmtMinutes(v) : `${Math.round(v)}×`;

  const describe = (day: number) => {
    const v = values.get(ymd(day)) ?? 0;
    return a.kind === 'check' ? `${v}/${a.targetPerDay}` : v ? fmtMinutes(v) : 'nič';
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `${a.icon} ${a.name}`,
          headerRight: () => (
            <IconButton name="settings" label={t.activities.edit} onPress={() => router.push({ pathname: '/activity/edit', params: { id: a.id } })} />
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
        {a.kind === 'timed' && !a.archived ? (
          <Row>
            <Button
              icon="play"
              label={running?.activityId === a.id ? t.activities.running : t.activities.start}
              disabled={running?.activityId === a.id}
              onPress={() => void startActivity(db, a.id).then(() => router.navigate('/progress'))}
            />
            <Button
              variant="secondary"
              icon="add"
              label={t.activities.addManual}
              onPress={() => router.push({ pathname: '/activity/log', params: { activityId: a.id } })}
            />
          </Row>
        ) : null}

        {a.goalType && a.goalValue ? (
          <Card>
            <Row style={styles.between}>
              <ThemedText type="smallBold">
                {t.activities.weeklyGoal}: {fmtGoal(a, goalNow)}
              </ThemedText>
              <ThemedText type="small" themeColor="text2">
                🔥 {plural(streak, 'týždeň', 'týždne', 'týždňov')} v rade
              </ThemedText>
            </Row>
            <Meter value={goalNow / a.goalValue} label={fmtGoal(a, goalNow)} />
          </Card>
        ) : null}

        <Section title={t.activities.yearMap}>
          <Card>
            <Heatmap weeks={grid} levelOf={(day) => heatLevel(values.get(ymd(day)) ?? 0, scale)} describe={describe} />
          </Card>
        </Section>

        <Section title={t.activities.perWeek}>
          <Card>
            <ColumnChart
              data={weeks.map((w, i) => ({
                key: String(w),
                label: i % 3 === 2 || i === weeks.length - 1 ? `${new Date(w).getDate()}.${new Date(w).getMonth() + 1}.` : '',
                value: unitOf(w),
                title: `týždeň od ${new Date(w).getDate()}. ${new Date(w).getMonth() + 1}.`,
              }))}
              goal={a.goalValue ?? undefined}
              goalLabel={a.goalType ? `cieľ ${fmtUnit(a.goalValue ?? 0)}` : undefined}
              formatValue={fmtUnit}
              initialSelected={weeks.length - 1}
            />
          </Card>
        </Section>

        <Section title={t.activities.diary}>
          {recent.length ? (
            recent.map((l) => <LogRow key={l.id} activity={a} log={l} now={now} />)
          ) : (
            <Empty text={t.activities.noLogs} />
          )}
        </Section>
      </ScrollView>
    </>
  );
}

function weekMinutes(logs: ActivityLog[], weekStart: number, now: number): number {
  const from = ymd(weekStart);
  const to = ymd(weekStart + 7 * 86_400_000 - 1);
  return logs.filter((l) => l.day >= from && l.day <= to).reduce((acc, l) => acc + logDuration(l, now), 0) / MINUTE;
}

function LogRow({ activity: a, log: l, now }: { activity: Activity; log: ActivityLog; now: number }) {
  const theme = useTheme();
  const { activity: color } = useChartColors();
  const dur = logDuration(l, now);
  const running = l.endedAt == null;
  const main =
    a.kind === 'check'
      ? `${l.count}/${a.targetPerDay}`
      : [
          running ? `${t.activities.running} ${fmtMinutes(dur / MINUTE)}` : fmtMinutes(dur / MINUTE),
          l.distanceM ? fmtDistance(l.distanceM) : null,
          l.distanceM ? fmtPace(dur, l.distanceM) : null,
          l.rating ? '★'.repeat(l.rating) : null,
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      disabled={a.kind === 'check'}
      onPress={() => router.push({ pathname: '/activity/log', params: { id: l.id } })}
      style={({ pressed }) => [styles.log, { borderColor: theme.border }, pressed && { opacity: 0.6 }]}>
      <View style={[styles.bar, { backgroundColor: color(a.colorSlot) }]} />
      <View style={styles.flex}>
        <Row style={styles.between}>
          <ThemedText type="small" themeColor="text2">
            {fmtDateShort(l.startedAt)}
            {a.kind === 'timed' ? ` · ${fmtTime(l.startedAt)}` : ''}
          </ThemedText>
          <ThemedText type="smallBold">{main}</ThemedText>
        </Row>
        {l.note ? (
          <ThemedText type="small" numberOfLines={2}>
            {l.note}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  between: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  log: { flexDirection: 'row', gap: Spacing.two, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { width: 4, borderRadius: 2 },
});
