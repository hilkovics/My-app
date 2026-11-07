import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ItemRow, OccurrenceRow } from '@/components/item-row';
import { Meter } from '@/components/meter';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, Fab, IconButton, Row, Screen, Section } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { useOccurrences } from '@/features/calendar/use-occurrences';
import { getHabitLogs, listHabits, logHabit } from '@/features/habits/repository';
import { computeStreak, isScheduled } from '@/features/habits/stats';
import { getRunningSession, listSessions } from '@/features/focus/repository';
import { fmtMinutes, sessionDuration } from '@/features/focus/stats';
import { checklistProgress, getOrCreateJournal, listPinnedNotes, listTasks } from '@/features/items/repository';
import { getSettings } from '@/features/settings/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { addDays, fmtDateLong, startOfDay, ymd } from '@/lib/dates';

export default function TodayScreen() {
  const db = useDb();
  const theme = useTheme();
  const now = useNow();
  const day = startOfDay(now);
  const occurrences = useOccurrences(day, addDays(day, 1)).filter((o) => o.kind !== 'due');
  const tasks = useLiveQuery((d) => listTasks(d, 'today', now), [day]) ?? [];
  const progress = useLiveQuery((d) => checklistProgress(d), []);
  const pinned = useLiveQuery((d) => listPinnedNotes(d), []) ?? [];
  const focus = useLiveQuery(
    async (d) => ({
      running: await getRunningSession(d),
      sessions: await listSessions(d, day, addDays(day, 1)),
      goal: (await getSettings(d)).focusGoalMinutes,
    }),
    [day],
  );
  const focusMinutes = (focus?.sessions ?? []).reduce((a, s) => a + sessionDuration(s, now), 0) / 60_000;
  const habitData = useLiveQuery(
    async (d) => {
      const habits = (await listHabits(d)).filter((h) => isScheduled(h, day));
      const logs = await getHabitLogs(d, ymd(addDays(day, -400)), ymd(day));
      return { habits, logs };
    },
    [day],
  );

  const openJournal = async () => {
    const j = await getOrCreateJournal(db, day);
    router.push({ pathname: '/item/[id]', params: { id: j.id } });
  };

  return (
    <Screen
      title={t.tabs.today}
      subtitle={fmtDateLong(now)}
      actions={
        <>
          <IconButton name="search" label={t.common.search} onPress={() => router.push('/search')} />
          <IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />
        </>
      }
      fab={<Fab label={t.common.add} onPress={() => router.push('/item/new')} />}>
      <Section title={t.today.timeline}>
        <Card>
          {occurrences.length ? (
            occurrences.map((o) => <OccurrenceRow key={o.key} occ={o} />)
          ) : (
            <Empty text={t.today.empty} />
          )}
        </Card>
      </Section>

      {focus ? (
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/focus')}>
          <Card>
            <Row style={styles.between}>
              <ThemedText type="smallBold">
                {focus.running ? `⏱ ${t.focus.running}` : `${t.tabs.focus} ${t.focus.today.toLowerCase()}`}
                {focus.running?.itemTitle ? ` · ${focus.running.itemTitle}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {fmtMinutes(focusMinutes)} {t.focus.of} {fmtMinutes(focus.goal)}
              </ThemedText>
            </Row>
            <Meter value={focusMinutes / focus.goal} />
          </Card>
        </Pressable>
      ) : null}

      <Section title={t.today.tasks}>
        {tasks.length ? (
          <View>
            {tasks.map((it) => (
              <ItemRow key={it.id} item={it} now={now} progress={progress?.get(it.id)} />
            ))}
          </View>
        ) : (
          <Empty text={t.today.noTasks} />
        )}
      </Section>

      {habitData?.habits.length ? (
        <Section title={t.today.habits}>
          <Row>
            {habitData.habits.map((h) => {
              const logs = habitData.logs.get(h.id);
              const count = logs?.get(ymd(day)) ?? 0;
              const done = count >= h.targetPerDay;
              const streak = computeStreak(h, logs, now);
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${h.name} ${count}/${h.targetPerDay}`}
                  onPress={() => void logHabit(db, h.id, ymd(day), 1)}
                  onLongPress={() => void logHabit(db, h.id, ymd(day), -1)}
                  style={[
                    styles.habit,
                    { borderColor: h.color, backgroundColor: done ? h.color : theme.backgroundElement },
                  ]}>
                  <ThemedText style={{ color: done ? '#fff' : theme.text }}>
                    {h.icon} {h.name}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: done ? '#ffffffcc' : theme.textSecondary }}>
                    {count}/{h.targetPerDay}
                    {streak ? ` · 🔥 ${streak}` : ''}
                  </ThemedText>
                </Pressable>
              );
            })}
          </Row>
        </Section>
      ) : null}

      <Section
        title={t.today.pinned}
        right={<Button small variant="ghost" icon="book" label={t.today.journal} onPress={() => void openJournal()} />}>
        {pinned.length ? pinned.map((n) => <ItemRow key={n.id} item={n} now={now} />) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  habit: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 120,
  },
});
