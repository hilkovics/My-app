import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { RunningActivityCard, TodayActivities } from '@/components/activities/today-activities';
import { ItemRow, OccurrenceRow } from '@/components/item-row';
import { NoteCard } from '@/components/note-card';
import { ThemedText } from '@/components/themed-text';
import { TodayHero } from '@/components/today/hero';
import { NowCard } from '@/components/today/now-card';
import { Button, Card, Empty, Fab, LinkButton, Meter, Screen, Section, StatTile } from '@/components/ui';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { useOccurrences } from '@/features/calendar/use-occurrences';
import { getRunningSession, listSessions } from '@/features/focus/repository';
import { fmtMinutes, goalStreak, minutesByDay, sessionDuration } from '@/features/focus/stats';
import { checklistProgress, getOrCreateJournal, listPinnedNotes, listTasks } from '@/features/items/repository';
import { useDayPlan } from '@/features/plan/use-day-plan';
import { getSettings } from '@/features/settings/repository';
import { t } from '@/i18n/sk';
import { addDays, plural, startOfDay } from '@/lib/dates';

export default function TodayScreen() {
  const db = useDb();
  const now = useNow();
  const day = startOfDay(now);
  const plan = useDayPlan(day);
  const occurrences = useOccurrences(day, addDays(day, 1)).filter((o) => o.kind !== 'due');
  const tasks = useLiveQuery((d) => listTasks(d, 'today', now), [day]) ?? [];
  const doneToday = useLiveQuery(async (d) => (await listTasks(d, 'done', now)).filter((i) => i.completedAt != null && i.completedAt >= day).length, [day]) ?? 0;
  const progress = useLiveQuery((d) => checklistProgress(d), []);
  const pinned = useLiveQuery((d) => listPinnedNotes(d), []) ?? [];
  const focus = useLiveQuery(
    async (d) => ({
      running: await getRunningSession(d),
      sessions: await listSessions(d, addDays(day, -400), addDays(day, 1)),
      goal: (await getSettings(d)).focusGoalMinutes,
    }),
    [day],
  );
  const todaySessions = (focus?.sessions ?? []).filter((s) => s.startedAt >= day);
  const focusMinutes = todaySessions.reduce((a, s) => a + sessionDuration(s, now), 0) / 60_000;
  const streak = focus ? goalStreak(minutesByDay(focus.sessions, now), focus.goal, now) : 0;
  const openJournal = async () => {
    const j = await getOrCreateJournal(db, day);
    router.push({ pathname: '/item/[id]', params: { id: j.id } });
  };
  const goFocus = () => router.navigate({ pathname: '/progress', params: { section: 'focus' } });

  return (
    <Screen
      hero={<TodayHero plan={plan} now={now} />}
      gap={22}
      fab={<Fab label={t.common.add} onPress={() => router.push('/item/new')} />}>
      <RunningActivityCard />

      {plan ? <NowCard plan={plan} now={now} /> : null}

      {focus ? (
        <View style={styles.tiles}>
          <StatTile
            label="Fokus dnes"
            value={fmtMinutes(focusMinutes)}
            sub={focusMinutes >= focus.goal ? `z ${fmtMinutes(focus.goal)} · cieľ splnený` : `z ${fmtMinutes(focus.goal)} · zostáva ${fmtMinutes(focus.goal - focusMinutes)}`}
            onPress={goFocus}>
            <Meter value={focusMinutes / focus.goal} height={8} label="Denný cieľ fokusu" />
          </StatTile>
          <StatTile label="Séria" value={`🔥 ${plural(streak, 'deň', 'dni', 'dní')}`} sub="so splneným cieľom fokusu" onPress={goFocus} />
        </View>
      ) : null}

      <Section title={t.today.timeline} right={<LinkButton label="Kalendár" onPress={() => router.navigate('/calendar')} />}>
        <Card>
          {occurrences.length ? occurrences.map((o) => <OccurrenceRow key={o.key} occ={o} now={now} />) : <Empty text={t.today.empty} />}
        </Card>
      </Section>

      <Section
        title={t.today.tasks}
        right={
          <Pressable accessibilityRole="link" onPress={() => router.navigate({ pathname: '/tasks', params: { view: 'today' } })} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <ThemedText type="button" themeColor="mark" tabular>
              {doneToday}/{doneToday + tasks.length} · Všetky
            </ThemedText>
          </Pressable>
        }>
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
        right={<Button small variant="secondary" icon="book" label={t.today.journal} onPress={() => void openJournal()} />}>
        {pinned.length ? <View>{pinned.map((n) => <NoteCard key={n.id} item={n} progress={progress?.get(n.id)} />)}</View> : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
});
