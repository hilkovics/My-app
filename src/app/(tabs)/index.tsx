import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { TodayActivities } from '@/components/activities/today-activities';
import { ItemRow, OccurrenceRow } from '@/components/item-row';
import { TodayPlanCard } from '@/components/plan/today-plan-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, Fab, IconButton, Meter, Row, Screen, Section } from '@/components/ui';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { useOccurrences } from '@/features/calendar/use-occurrences';
import { getRunningSession, listSessions } from '@/features/focus/repository';
import { fmtMinutes, sessionDuration } from '@/features/focus/stats';
import { checklistProgress, getOrCreateJournal, listPinnedNotes, listTasks } from '@/features/items/repository';
import { getSettings } from '@/features/settings/repository';
import { t } from '@/i18n/sk';
import { addDays, fmtDateLong, startOfDay } from '@/lib/dates';

export default function TodayScreen() {
  const db = useDb();
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
      <TodayPlanCard />

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
        <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/progress', params: { section: 'focus' } })}>
          <Card>
            <Row style={styles.between}>
              <ThemedText type="smallBold">
                {focus.running ? `⏱ ${t.focus.running}` : `${t.tabs.focus} ${t.focus.today.toLowerCase()}`}
                {focus.running?.itemTitle ? ` · ${focus.running.itemTitle}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="text2">
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

      <TodayActivities />

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
});
