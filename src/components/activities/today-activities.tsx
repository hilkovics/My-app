import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  getRunningActivity,
  listActivities,
  listLogs,
  logCheck,
  startActivity,
  type Activity,
  type ActivityLog,
} from '@/features/activities/repository';
import { dayStreak, dayValues, isScheduled, weekValue } from '@/features/activities/stats';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { addDays, plural, startOfDay, startOfWeek, ymd } from '@/lib/dates';
import { toast } from '@/lib/toast-store';

import { Icon } from '../icon';
import { ThemedText } from '../themed-text';
import { Section } from '../ui';
import { RunningCard } from './activities-panel';

function useTodayActivities() {
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
  return { now, day, data };
}

/** Card with the running activity timer (2 px border in the activity colour). Null when nothing runs. */
export function RunningActivityCard() {
  const { now, data } = useTodayActivities();
  const run = data?.running;
  const activity = run ? data.activities.find((a) => a.id === run.activityId) : undefined;
  if (!run || !activity) return null;
  return <RunningCard run={run} activity={activity} now={now} />;
}

/** Aktivity: 3-column tile grid. Check habits: tap +1, long press −1. Timed: tap starts the timer. */
export function TodayActivities() {
  const { now, day, data } = useTodayActivities();
  if (!data?.activities.length) return null;
  const shown = data.activities.filter((a) => (a.kind === 'check' ? isScheduled(a, day) : true));
  if (!shown.length) return null;
  const weekStart = startOfWeek(day);
  return (
    <Section title={t.activities.section}>
      <View style={styles.grid}>
        {shown.map((a) => (
          <ActivityTile key={a.id} a={a} logs={data.logs} day={day} now={now} weekStart={weekStart} running={data.running?.activityId === a.id} />
        ))}
      </View>
    </Section>
  );
}

function ActivityTile({
  a,
  logs,
  day,
  now,
  weekStart,
  running,
}: {
  a: Activity;
  logs: ActivityLog[];
  day: number;
  now: number;
  weekStart: number;
  running: boolean;
}) {
  const db = useDb();
  const theme = useTheme();
  const own = logs.filter((l) => l.activityId === a.id);
  const isCheck = a.kind === 'check';
  const counts = dayValues(own, a);
  const count = counts.get(ymd(day)) ?? 0;
  const done = isCheck && count >= a.targetPerDay;
  const streak = isCheck ? dayStreak(a, counts, now) : 0;

  let value: string;
  let sub: string;
  if (isCheck) {
    value = `${count}/${a.targetPerDay}`;
    sub = streak ? `🔥 ${streak}` : ' ';
  } else {
    const wv = weekValue(a, own, weekStart, now);
    const g = a.goalValue ?? 0;
    if (a.goalType === 'km') {
      value = String(Math.round(wv * 10) / 10).replace('.', ',');
      sub = `z ${String(g).replace('.', ',')} km`;
    } else if (a.goalType === 'minutes') {
      value = String(Math.round(wv));
      sub = `z ${g} min`;
    } else if (a.goalType === 'sessions') {
      value = `${Math.round(wv)}/${g}×`;
      sub = 'tento týždeň';
    } else {
      value = `${Math.round(wv)}×`;
      sub = 'tento týždeň';
    }
  }

  const onPress = () => {
    if (!isCheck) {
      if (running) router.navigate('/progress');
      else void startActivity(db, a.id);
      return;
    }
    void logCheck(db, a.id, ymd(day), 1).then(() => {
      if (count + 1 === a.targetPerDay) {
        const next = dayStreak(a, new Map(counts).set(ymd(day), count + 1), now);
        toast(`${a.icon} ${a.name} splnená na dnes${next ? ` · 🔥 ${plural(next, 'deň', 'dni', 'dní')} v rade` : ''}`);
      }
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isCheck ? `${a.name} ${count} z ${a.targetPerDay}${done ? ', splnené' : ''}` : `${running ? 'Beží' : 'Spustiť'} ${a.name}`}
      accessibilityHint={isCheck ? 'Podržaním ubereš jedno' : undefined}
      onPress={onPress}
      onLongPress={isCheck ? () => void logCheck(db, a.id, ymd(day), -1) : undefined}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: done ? theme.successSoft : theme.surface,
          borderColor: done ? theme.success : running ? theme.mark : theme.border,
          borderWidth: done || running ? 2 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}>
      <View style={styles.tileTop}>
        <ThemedText style={styles.emoji}>{a.icon}</ThemedText>
        {done ? <Icon name="checkCircle" size={20} color={theme.success} /> : !isCheck ? <Icon name={running ? 'timer' : 'play'} size={18} color={theme.mark} /> : null}
      </View>
      <ThemedText type="bodySmall" numberOfLines={1} style={{ fontFamily: FontFamily[700] }}>
        {a.name}
      </ThemedText>
      <ThemedText type="statValue" tabular numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="axis" numberOfLines={1} style={{ color: theme.text2, fontFamily: FontFamily[700], fontSize: 12 }}>
        {sub}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '30%', flexGrow: 1, maxWidth: '33%', minWidth: 96, borderRadius: Radius.card, padding: 14, gap: 2 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  emoji: { fontSize: 26, lineHeight: 32 },
});
