import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useCapacityGuard } from '@/components/plan/capacity-guard';
import { DayRing } from '@/components/plan/day-ring';
import { EntrySheet } from '@/components/plan/entry-sheet';
import { PlanColumn } from '@/components/plan/plan-column';
import { Meter } from '@/components/meter';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Empty, IconButton, Row, Section } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { finishDueFocus, pauseFocus, resumeFocus, stopFocus } from '@/features/focus/controller';
import { getRunningSession, listSessions, pomodoroEndsAt } from '@/features/focus/repository';
import { fmtClock, fmtMinutes, sessionDuration } from '@/features/focus/stats';
import { listUnscheduledTasks, updateItem } from '@/features/items/repository';
import { nowAngle, sessionArcs, DEFAULT_ESTIMATE_MIN } from '@/features/plan/layout';
import { useDayPlan } from '@/features/plan/use-day-plan';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { MINUTE, addDays, fmtDateLong, fmtTime, plural, startOfDay } from '@/lib/dates';

export default function PlanScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const db = useDb();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const now = useNow(1000);
  const today = startOfDay(now);
  const [day, setDay] = useState(() => (params.date ? startOfDay(Number(params.date)) : startOfDay(Date.now())));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { guard, dialog } = useCapacityGuard();

  const plan = useDayPlan(day);
  const running = useLiveQuery((d) => getRunningSession(d), []);
  const sessions = useLiveQuery((d) => listSessions(d, day, addDays(day, 1)), [day]) ?? [];
  const backlog = (useLiveQuery((d) => listUnscheduledTasks(d), []) ?? []).filter((i) => i.dueAt == null);

  // A Pomodoro whose time is up ends by itself (also while this screen is open).
  const endsAt = running ? pomodoroEndsAt(running) : null;
  useEffect(() => {
    if (endsAt != null && now >= endsAt) void finishDueFocus(db);
  }, [db, endsAt, now]);

  if (!plan) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  const isToday = day === today;
  const elapsed = isToday ? nowAngle(day, now) : day < today ? 360 : null;
  const focusEntry = running?.itemId ? plan.entries.find((e) => e.id === running.itemId && e.kind !== 'external') : undefined;
  const countdown = running
    ? endsAt != null
      ? fmtClock(endsAt - now)
      : running.mode === 'pomodoro' && running.plannedMinutes
        ? fmtClock(running.plannedMinutes * MINUTE - sessionDuration(running, now))
        : fmtClock(sessionDuration(running, now))
    : null;
  const selected = plan.entries.find((e) => e.key === selectedKey) ?? null;
  const ringSize = Math.min(300, Math.max(220, width - 2 * Spacing.three - 40));
  const over = plan.overflowMinutes > 0;
  const chain = plan.burnout.chains[0];

  const addToDay = (id: string, estimate: number | null) =>
    void guard({
      day,
      minutes: estimate ?? DEFAULT_ESTIMATE_MIN,
      proceed: (target) => void updateItem(db, id, { dueAt: target }),
    });

  return (
    <>
      <Stack.Screen options={{ title: t.plan.title }} />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
        <Row style={styles.nav}>
          <IconButton name="chevronLeft" label="Predchádzajúci deň" onPress={() => setDay(addDays(day, -1))} />
          <ThemedText type="smallBold" style={styles.navTitle} numberOfLines={1}>
            {fmtDateLong(day)}
          </ThemedText>
          <Button small variant="secondary" label={t.common.today} onPress={() => setDay(today)} />
          <IconButton name="chevronRight" label="Nasledujúci deň" onPress={() => setDay(addDays(day, 1))} />
        </Row>

        {running ? (
          <Card style={[styles.focusCard, { borderColor: theme.accent }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t.plan.focusMode} · {t.plan.focusOn}
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1}>
              {running.itemTitle ?? running.tag ?? t.focus.noSubject}
            </ThemedText>
            <ThemedText style={[styles.clock, running.pausedAt != null && { color: theme.textSecondary }]}>{countdown}</ThemedText>
            <Row style={styles.center}>
              {running.pausedAt != null ? (
                <Button small icon="play" label={t.focus.resume} onPress={() => void resumeFocus(db)} />
              ) : (
                <Button small variant="secondary" icon="pause" label={t.focus.pause} onPress={() => void pauseFocus(db)} />
              )}
              <Button small variant="danger" icon="stop" label={t.plan.exitFocus} onPress={() => void stopFocus(db)} />
            </Row>
          </Card>
        ) : null}

        {chain ? (
          <Card style={[styles.warn, { borderColor: theme.warning }]}>
            <ThemedText type="smallBold" style={{ color: theme.warning }}>
              ⚠ Riziko vyčerpania
            </ThemedText>
            <ThemedText type="small">
              {plural(chain.deepCount, 'náročný blok', 'náročné bloky', 'náročných blokov')} po sebe bez pauzy ({fmtTime(chain.start)}–{fmtTime(chain.end)}, spolu {fmtMinutes(chain.totalMinutes)}). Vlož medzi ne pauzu.
            </ThemedText>
          </Card>
        ) : null}

        <View style={styles.ringWrap}>
          <DayRing
            plan={plan}
            size={ringSize}
            elapsedAngle={elapsed}
            workArcs={sessionArcs(sessions, day, now)}
            selectedKey={selectedKey}
            focusKey={focusEntry?.key ?? null}
            onSelect={setSelectedKey}
            label={`${t.plan.ring}: ${t.plan.planned} ${fmtMinutes(plan.plannedMinutes)} ${t.plan.of} ${fmtMinutes(plan.capacityMinutes)}`}>
            <ThemedText style={styles.ringBig}>{fmtMinutes(plan.plannedMinutes)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.plan.of} {fmtMinutes(plan.capacityMinutes)}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: over ? theme.danger : plan.full ? theme.warning : theme.success }}>
              {over ? `+${fmtMinutes(plan.overflowMinutes)} ${t.plan.over}` : plan.full ? t.plan.full : `${t.plan.remaining} ${fmtMinutes(plan.remainingMinutes)}`}
            </ThemedText>
          </DayRing>
        </View>

        <View style={styles.legend}>
          <Legend color={theme.accent} label={t.plan.legendDeep} swatch="solid" />
          <Legend color={theme.accent} label={t.plan.legendRoutine} swatch="muted" />
          <Legend color={theme.success} label={t.plan.legendRest} swatch="muted" />
          <Legend color={theme.textSecondary} label={t.plan.legendSleep} swatch="muted" />
          <Legend color={theme.accent} label={t.plan.legendTentative} swatch="dashed" />
          <Legend color={theme.accent} label={t.plan.legendWork} swatch="thin" />
        </View>

        <Card>
          <Row style={styles.between}>
            <ThemedText type="smallBold">
              {t.plan.planned} {fmtMinutes(plan.plannedMinutes)} {t.plan.of} {fmtMinutes(plan.capacityMinutes)}
            </ThemedText>
            <ThemedText type="small" style={{ color: over ? theme.danger : theme.textSecondary }}>
              {over ? `+${fmtMinutes(plan.overflowMinutes)} ${t.plan.over}` : `${fmtMinutes(plan.freeMinutes)} ${t.plan.free}`}
            </ThemedText>
          </Row>
          <Meter value={plan.plannedMinutes / plan.capacityMinutes} label={t.plan.capacity} />
        </Card>

        <Section title={t.plan.column}>
          {plan.entries.length ? (
            <PlanColumn plan={plan} selectedKey={selectedKey} focusKey={focusEntry?.key ?? null} countdown={countdown} onSelect={setSelectedKey} />
          ) : (
            <Empty text={t.plan.noEntries} />
          )}
        </Section>

        <Section title={t.plan.backlog}>
          {backlog.length ? (
            backlog.map((task) => (
              <Row key={task.id} style={styles.backlogRow}>
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1}>{task.title || t.common.untitled}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {task.estimateMinutes ? fmtMinutes(task.estimateMinutes) : `~${fmtMinutes(DEFAULT_ESTIMATE_MIN)} (${t.plan.guessed})`}
                  </ThemedText>
                </View>
                <Chip label={t.plan.addToDay} onPress={() => addToDay(task.id, task.estimateMinutes)} />
                <Chip label="Otvoriť" onPress={() => router.push({ pathname: '/item/[id]', params: { id: task.id } })} />
              </Row>
            ))
          ) : (
            <Empty text={t.plan.backlogEmpty} />
          )}
        </Section>
      </ScrollView>
      <EntrySheet entry={selected} onClose={() => setSelectedKey(null)} />
      {dialog}
    </>
  );
}

function Legend({ color, label, swatch }: { color: string; label: string; swatch: 'solid' | 'muted' | 'dashed' | 'thin' }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.swatch,
          swatch === 'solid' && { backgroundColor: color },
          swatch === 'muted' && { backgroundColor: `${color}55` },
          swatch === 'dashed' && { borderColor: color, borderWidth: 2, borderStyle: 'dashed' },
          swatch === 'thin' && { backgroundColor: color, height: 4, alignSelf: 'center' },
        ]}
      />
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  nav: { flexWrap: 'nowrap', justifyContent: 'space-between' },
  navTitle: { flex: 1, textAlign: 'center' },
  center: { justifyContent: 'center' },
  between: { justifyContent: 'space-between' },
  focusCard: { borderWidth: 2 },
  warn: { borderWidth: 2 },
  clock: { fontSize: 44, lineHeight: 52, fontWeight: 300, textAlign: 'center', fontVariant: ['tabular-nums'] },
  ringWrap: { alignItems: 'center' },
  ringBig: { fontSize: 32, lineHeight: 38, fontWeight: 600 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 10, borderRadius: 2 },
  backlogRow: { flexWrap: 'nowrap', paddingVertical: 4 },
});
