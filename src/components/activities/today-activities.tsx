import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  getRunningActivity,
  listActivities,
  listLogs,
  logCheck,
  logDuration,
  startActivity,
} from '@/features/activities/repository';
import { dayStreak, dayValues, isScheduled } from '@/features/activities/stats';
import { fmtClock } from '@/features/focus/stats';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { onColor } from '@/lib/color';
import { addDays, startOfDay, ymd } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { Button, Card, Row, Section } from '../ui';
import { stopAndFinish } from './activities-panel';

/** Today screen: tick habits, quick ▶ for timed activities, the running activity timer. */
export function TodayActivities() {
  const db = useDb();
  const theme = useTheme();
  const { activity: color } = useChartColors();
  const now = useNow(1000);
  const day = startOfDay(now);
  const data = useLiveQuery(
    async (d) => ({
      activities: await listActivities(d),
      logs: await listLogs(d, ymd(addDays(day, -400)), ymd(day)),
      running: await getRunningActivity(d),
    }),
    [day],
  );
  if (!data?.activities.length) return null;
  const checks = data.activities.filter((a) => a.kind === 'check' && isScheduled(a, day));
  const timed = data.activities.filter((a) => a.kind === 'timed');
  const running = data.running ? data.activities.find((a) => a.id === data.running!.activityId) : null;

  return (
    <Section title={t.activities.section}>
      {data.running && running ? (
        <Card style={[styles.running, { borderColor: color(running.colorSlot) }]}>
          <Row style={styles.between}>
            <Pressable onPress={() => router.navigate('/progress')}>
              <ThemedText type="smallBold">
                ⏱ {running.icon} {running.name} · {fmtClock(logDuration(data.running, now))}
              </ThemedText>
            </Pressable>
            <Button small variant="danger" icon="stop" label={t.focus.stop} onPress={() => void stopAndFinish(db)} />
          </Row>
        </Card>
      ) : null}
      {checks.length ? (
        <Row>
          {checks.map((a) => {
            const counts = dayValues(
              data.logs.filter((l) => l.activityId === a.id),
              a,
            );
            const count = counts.get(ymd(day)) ?? 0;
            const done = count >= a.targetPerDay;
            const streak = dayStreak(a, counts, now);
            const c = color(a.colorSlot);
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${a.name} ${count}/${a.targetPerDay}`}
                onPress={() => void logCheck(db, a.id, ymd(day), 1)}
                onLongPress={() => void logCheck(db, a.id, ymd(day), -1)}
                style={[styles.habit, { borderColor: c, backgroundColor: done ? c : theme.surface }]}>
                <ThemedText style={{ color: done ? onColor(c) : theme.text }}>
                  {a.icon} {a.name}
                </ThemedText>
                <ThemedText type="small" style={{ color: done ? onColor(c) : theme.text2 }}>
                  {count}/{a.targetPerDay}
                  {streak ? ` · 🔥 ${streak}` : ''}
                </ThemedText>
              </Pressable>
            );
          })}
        </Row>
      ) : null}
      {timed.length ? (
        <Row>
          {timed.map((a) => (
            <Button
              key={a.id}
              small
              variant="secondary"
              icon="play"
              label={`${a.icon} ${a.name}`}
              disabled={data.running?.activityId === a.id}
              onPress={() => void startActivity(db, a.id)}
            />
          ))}
        </Row>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  running: { borderWidth: 2, paddingVertical: Spacing.two },
  between: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  habit: {
    borderWidth: 1.5,
    borderRadius: Radius.buttonSquare,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 120,
  },
});
