import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Empty, Fab, IconButton, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { getHabitLogs, listHabits, logHabit } from '@/features/habits/repository';
import { completionRate, computeStreak, isScheduled } from '@/features/habits/stats';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { WEEKDAYS_SHORT, addDays, startOfDay, weekdayIndex, ymd } from '@/lib/dates';

export default function HabitsScreen() {
  const db = useDb();
  const theme = useTheme();
  const now = useNow();
  const today = startOfDay(now);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const data = useLiveQuery(
    async (d) => ({
      habits: await listHabits(d, true),
      logs: await getHabitLogs(d, ymd(addDays(today, -400)), ymd(today)),
    }),
    [today],
  );

  return (
    <Screen
      title={t.tabs.habits}
      actions={<IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />}
      fab={<Fab label={t.habits.new} onPress={() => router.push({ pathname: '/habit/[id]', params: { id: 'new' } })} />}>
      {data && !data.habits.length ? <Empty text={t.habits.empty} /> : null}
      {data?.habits.map((h) => {
        const logs = data.logs.get(h.id);
        const streak = computeStreak(h, logs, now);
        const rate = Math.round(completionRate(h, logs, 30, now) * 100);
        return (
          <Card key={h.id} style={h.archived ? styles.archived : undefined}>
            <Pressable
              onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })}
              style={styles.head}>
              <ThemedText style={styles.icon}>{h.icon}</ThemedText>
              <View style={styles.flex}>
                <ThemedText type="smallBold">{h.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  🔥 {streak} {t.habits.streak} · {rate} % {t.habits.rate}
                </ThemedText>
              </View>
            </Pressable>
            <View style={styles.week}>
              {week.map((day) => {
                const count = logs?.get(ymd(day)) ?? 0;
                const scheduled = isScheduled(h, day);
                const done = count >= h.targetPerDay;
                const partial = count > 0 && !done;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`${h.name} ${new Date(day).toLocaleDateString('sk-SK')} ${count}/${h.targetPerDay}`}
                    onPress={() => void logHabit(db, h.id, ymd(day), done ? -count : 1)}
                    onLongPress={() => void logHabit(db, h.id, ymd(day), -1)}
                    style={styles.dayCell}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
                      {WEEKDAYS_SHORT[weekdayIndex(day)]}
                    </ThemedText>
                    <View
                      style={[
                        styles.box,
                        {
                          borderColor: h.color,
                          backgroundColor: done ? h.color : partial ? `${h.color}55` : 'transparent',
                          opacity: scheduled ? 1 : 0.3,
                        },
                        day === today && styles.todayBox,
                      ]}>
                      <ThemedText type="small" style={{ color: done ? '#fff' : theme.text }}>
                        {h.targetPerDay > 1 ? count : done ? '✓' : ''}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { fontSize: 26, lineHeight: 32 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: { alignItems: 'center', gap: 4, flex: 1 },
  dayLabel: { fontSize: 11 },
  box: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBox: { transform: [{ scale: 1.08 }] },
  archived: { opacity: 0.45 },
});
