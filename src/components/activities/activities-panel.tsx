import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Opacity, Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  getRunningActivity,
  listActivities,
  listLogs,
  logCheck,
  logDuration,
  pauseActivity,
  resumeActivity,
  startActivity,
  stopActivity,
  type Activity,
  type ActivityLog,
} from '@/features/activities/repository';
import {
  activitiesPerDay,
  completionRate,
  dayStreak,
  dayValues,
  fmtDistance,
  fmtGoal,
  heatLevel,
  heatScale,
  isScheduled,
  recentWeekStarts,
  weekStreak,
  weekValue,
  weeklyMix,
  yearGrid,
} from '@/features/activities/stats';
import { fmtClock, fmtMinutes } from '@/features/focus/stats';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { hexA, onColor } from '@/lib/color';
import { MINUTE, WEEKDAYS_SHORT, plural, addDays, startOfDay, weekdayIndex, ymd } from '@/lib/dates';

import { Heatmap } from '../heatmap';
import { StackedColumnChart } from '../stacked-column-chart';
import { ThemedText } from '../themed-text';
import { Button, Card, Empty, EntityTile, Meter, Row, Section } from '../ui';

/** Stops the running activity timer and opens the entry to add km / rating / note. */
export async function stopAndFinish(db: Parameters<typeof stopActivity>[0]) {
  const done = await stopActivity(db);
  if (done) router.push({ pathname: '/activity/log', params: { id: done.id, finish: '1' } });
}

export function ActivitiesPanel() {
  const now = useNow(1000);
  const today = startOfDay(now);
  const grid = yearGrid(today);
  const fromDay = ymd(grid[0][0]);
  const data = useLiveQuery(
    async (d) => ({
      activities: await listActivities(d, true),
      logs: await listLogs(d, fromDay, ymd(today)),
      running: await getRunningActivity(d),
    }),
    [fromDay, today],
  );
  if (!data) return null;
  const active = data.activities.filter((a) => !a.archived);

  return (
    <>
      {data.running ? <RunningCard run={data.running} activity={data.activities.find((a) => a.id === data.running!.activityId)} now={now} /> : null}

      {!data.activities.length ? <Empty text={t.activities.empty} /> : null}
      {data.activities.map((a) =>
        a.kind === 'check' ? (
          <CheckCard key={a.id} activity={a} logs={data.logs} now={now} />
        ) : (
          <TimedCard key={a.id} activity={a} logs={data.logs} now={now} running={data.running?.activityId === a.id} />
        ),
      )}
      <Button variant="dashed" icon="add" label={t.activities.new} onPress={() => router.push('/activity/edit')} />

      {active.length ? <YearMap activities={data.activities} logs={data.logs} grid={grid} now={now} /> : null}
      {active.some((a) => a.kind === 'timed') ? <WeeklyMixCard activities={data.activities} logs={data.logs} now={now} /> : null}
    </>
  );
}

/** Running activity timer: 2 px border in the activity colour, label, 48 px time, Pauza / Pokračovať + Stop. */
export function RunningCard({ run, activity, now }: { run: ActivityLog; activity?: Activity; now: number }) {
  const db = useDb();
  const theme = useTheme();
  const { activity: color } = useChartColors();
  const paused = run.pausedAt != null;
  return (
    <Card style={[styles.running, { borderColor: color(activity?.colorSlot ?? 0) }]}>
      <ThemedText type="label" themeColor="text2">
        {paused ? 'POZASTAVENÉ' : 'BEŽÍ'} · {activity ? `${activity.icon} ${activity.name.toUpperCase()}` : ''}
      </ThemedText>
      <ThemedText type="timerCard" tabular style={paused ? { color: theme.text2 } : undefined}>
        {fmtClock(logDuration(run, now))}
      </ThemedText>
      <Row>
        {paused ? (
          <Button small variant="secondary" icon="play" label={t.focus.resume} onPress={() => void resumeActivity(db)} />
        ) : (
          <Button small variant="secondary" icon="pause" label={t.focus.pause} onPress={() => void pauseActivity(db)} />
        )}
        <Button small variant="ink" icon="stop" label={t.focus.stop} onPress={() => void stopAndFinish(db)} />
      </Row>
    </Card>
  );
}

function CardHeader({ activity, sub }: { activity: Activity; sub: string }) {
  const { activity: color } = useChartColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${activity.name}. ${sub}`}
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
      style={styles.head}>
      <EntityTile icon={activity.icon} color={color(activity.colorSlot)} />
      <View style={styles.flex}>
        <ThemedText type="cardTitle" numberOfLines={1}>
          {activity.name}
        </ThemedText>
        <ThemedText type="meta" themeColor="text2" numberOfLines={2} tabular>
          {sub}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function TimedCard({ activity: a, logs, now, running }: { activity: Activity; logs: ActivityLog[]; now: number; running: boolean }) {
  const db = useDb();
  const { activity: color } = useChartColors();
  const week = recentWeekStarts(now, 1)[0];
  const mine = logs.filter((l) => l.activityId === a.id);
  const inWeek = mine.filter((l) => l.day >= ymd(week));
  const minutes = inWeek.reduce((acc, l) => acc + logDuration(l, now), 0) / MINUTE;
  const km = inWeek.reduce((acc, l) => acc + (l.distanceM ?? 0), 0);
  const value = a.goalType ? weekValue(a, logs, week, now) : 0;
  const streak = weekStreak(a, logs, now);
  const sub = [
    `${fmtMinutes(minutes)} ${t.activities.thisWeek}`,
    a.trackDistance && km ? fmtDistance(km) : null,
    a.goalType ? fmtGoal(a, value) : null,
    streak ? `🔥 ${plural(streak, 'týždeň', 'týždne', 'týždňov')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card style={a.archived ? styles.archived : undefined}>
      <CardHeader activity={a} sub={sub} />
      {a.goalType && a.goalValue ? (
        <View style={styles.goalRow}>
          <View style={styles.flex}>
            <Meter value={value / a.goalValue} label={fmtGoal(a, value)} height={10} color={color(a.colorSlot)} />
          </View>
          <ThemedText type="meta" tabular style={{ fontFamily: FontFamily[800] }}>
            {fmtGoal(a, value)}
          </ThemedText>
        </View>
      ) : null}
      {!a.archived ? (
        <Row>
          <Button small variant="ink" icon="play" label={t.activities.start} disabled={running} onPress={() => void startActivity(db, a.id)} />
          <Button
            small
            variant="secondary"
            icon="add"
            label={t.activities.addManual}
            onPress={() => router.push({ pathname: '/activity/log', params: { activityId: a.id } })}
          />
        </Row>
      ) : null}
    </Card>
  );
}

function CheckCard({ activity: a, logs, now }: { activity: Activity; logs: ActivityLog[]; now: number }) {
  const db = useDb();
  const theme = useTheme();
  const { activity: color } = useChartColors();
  const c = color(a.colorSlot);
  const today = startOfDay(now);
  const counts = dayValues(
    logs.filter((l) => l.activityId === a.id),
    a,
  );
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const streak = dayStreak(a, counts, now);
  const rate = Math.round(completionRate(a, counts, 30, now) * 100);
  return (
    <Card style={a.archived ? styles.archived : undefined}>
      <CardHeader activity={a} sub={`🔥 ${plural(streak, 'deň', 'dni', 'dní')} v rade · ${rate} % ${t.activities.rate}`} />
      <View style={styles.strip}>
        {week.map((day) => {
          const count = counts.get(ymd(day)) ?? 0;
          const done = count >= a.targetPerDay;
          const isToday = day === today;
          const scheduled = isScheduled(a, day);
          const size = isToday ? 40 : 34;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${a.name}, ${WEEKDAYS_SHORT[weekdayIndex(day)]} ${new Date(day).getDate()}. ${new Date(day).getMonth() + 1}., ${count} z ${a.targetPerDay}${done ? ', splnené' : ''}`}
              onPress={() => void logCheck(db, a.id, ymd(day), done ? -count : 1)}
              onLongPress={() => void logCheck(db, a.id, ymd(day), -1)}
              style={styles.dayCell}>
              <ThemedText type="axis" themeColor="text2" style={{ fontFamily: isToday ? FontFamily[800] : FontFamily[700] }}>
                {WEEKDAYS_SHORT[weekdayIndex(day)]}
              </ThemedText>
              <View
                style={[
                  styles.box,
                  {
                    width: size,
                    height: size,
                    backgroundColor: done ? c : count > 0 ? hexA(c, 0.55) : 'transparent',
                    borderWidth: done || count > 0 ? 0 : 1.5,
                    borderColor: day > today || !scheduled ? hexA(theme.text2, 0.3) : theme.text2,
                  },
                ]}>
                <ThemedText type="bodySmall" tabular style={{ color: done ? onColor(c) : theme.text, fontFamily: FontFamily[800] }}>
                  {a.targetPerDay > 1 ? (count || '') : done ? '✓' : ''}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function YearMap({ activities, logs, grid, now }: { activities: Activity[]; logs: ActivityLog[]; grid: number[][]; now: number }) {
  const perDay = activitiesPerDay(logs, activities, now);
  const scale = heatScale(perDay.values());
  const byId = new Map(activities.map((a) => [a.id, a]));
  const describe = (day: number) => {
    const key = ymd(day);
    const parts = new Map<string, { min: number; m: number; count: number }>();
    for (const l of logs) {
      if (l.day !== key) continue;
      const p = parts.get(l.activityId) ?? { min: 0, m: 0, count: 0 };
      p.min += logDuration(l, now) / MINUTE;
      p.m += l.distanceM ?? 0;
      p.count += l.count;
      parts.set(l.activityId, p);
    }
    const text = [...parts]
      .map(([id, p]) => {
        const a = byId.get(id);
        if (!a) return null;
        const v = a.kind === 'check' ? `${p.count}/${a.targetPerDay}` : [fmtMinutes(p.min), p.m ? fmtDistance(p.m) : null].filter(Boolean).join(', ');
        return `${a.icon} ${a.name} ${v}`;
      })
      .filter(Boolean)
      .join(' · ');
    return text || 'nič';
  };
  return (
    <Section title={t.activities.yearMap}>
      <Card>
        <Heatmap weeks={grid} levelOf={(day) => heatLevel(perDay.get(ymd(day)) ?? 0, scale)} describe={describe} />
      </Card>
    </Section>
  );
}

function WeeklyMixCard({ activities, logs, now }: { activities: Activity[]; logs: ActivityLog[]; now: number }) {
  const { activity: color } = useChartColors();
  const weeks = recentWeekStarts(now, 12);
  const mix = weeklyMix(logs, activities, weeks, now);
  const totals = mix.series.map((_, i) => mix.values.reduce((acc, row) => acc + row[i], 0));
  return (
    <Section title={t.activities.mix}>
      <Card>
        {mix.series.length ? (
          <>
            <StackedColumnChart
              series={mix.series.map((s) => ({ key: s.key, name: s.name, icon: activities.find((a) => a.id === s.key)?.icon, color: color(s.colorSlot) }))}
              values={mix.values}
              labels={weeks.map((w, i) => (i % 3 === 2 || i === weeks.length - 1 ? `${new Date(w).getDate()}.${new Date(w).getMonth() + 1}.` : ''))}
              titles={weeks.map((w) => `týždeň od ${new Date(w).getDate()}. ${new Date(w).getMonth() + 1}.`)}
              formatValue={fmtMinutes}
              legend={false}
            />
            <ThemedText type="label" themeColor="text2" style={styles.totalsTitle}>
              {t.activities.mixTotals.toUpperCase()}
            </ThemedText>
            {mix.series.map((s, i) => (
              <View key={s.key} style={styles.totalRow}>
                <View style={[styles.swatch, { backgroundColor: color(s.colorSlot) }]} />
                <ThemedText type="bodySmall" style={styles.flex}>
                  {s.name}
                </ThemedText>
                <ThemedText type="bodySmall" tabular style={{ fontFamily: FontFamily[800] }}>
                  {fmtMinutes(totals[i])}
                </ThemedText>
              </View>
            ))}
          </>
        ) : (
          <Empty text={t.activities.mixEmpty} />
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  running: { borderWidth: 2, gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  archived: { opacity: Opacity.archived },
  strip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dayCell: { alignItems: 'center', gap: 4, flex: 1, minHeight: 56, justifyContent: 'flex-end' },
  box: { borderRadius: Radius.tile - 4, alignItems: 'center', justifyContent: 'center' },
  totalsTitle: { marginTop: Spacing.two },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
});
