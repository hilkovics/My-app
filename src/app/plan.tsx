import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { useCapacityGuard } from '@/components/plan/capacity-guard';
import { DayRing } from '@/components/plan/day-ring';
import { EntrySheet } from '@/components/plan/entry-sheet';
import { PlanColumn } from '@/components/plan/plan-column';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Empty, IconButton, Meter, Section } from '@/components/ui';
import { FontFamily, Layout, Radius, Spacing, Viz } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { finishDueFocus, pauseFocus, resumeFocus, stopFocus } from '@/features/focus/controller';
import { getRunningSession, listSessions, pomodoroEndsAt } from '@/features/focus/repository';
import { fmtClock, fmtMinutes, hm, sessionDuration } from '@/features/focus/stats';
import { listUnscheduledTasks, updateItem } from '@/features/items/repository';
import { nowAngle, sessionArcs, DEFAULT_ESTIMATE_MIN } from '@/features/plan/layout';
import { useDayPlan } from '@/features/plan/use-day-plan';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { goBack } from '@/lib/nav';
import { toast } from '@/lib/toast-store';
import { MINUTE, addDays, fmtDateLong, fmtDateShort, fmtTime, plural, startOfDay } from '@/lib/dates';

export default function PlanScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const db = useDb();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  if (!plan) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  const isToday = day === today;
  const elapsed = isToday ? nowAngle(day, now) : day < today ? 360 : null;
  const focusEntry = isToday && running?.itemId ? plan.entries.find((e) => e.id === running.itemId && e.kind !== 'external') : undefined;
  const countdown = running
    ? endsAt != null
      ? fmtClock(endsAt - now)
      : running.mode === 'pomodoro' && running.plannedMinutes
        ? fmtClock(running.plannedMinutes * MINUTE - sessionDuration(running, now))
        : fmtClock(sessionDuration(running, now))
    : null;
  const selected = plan.entries.find((e) => e.key === selectedKey) ?? null;
  const ringSize = Math.min(Viz.ring.sizeLarge, Math.max(220, width - 2 * Layout.screenPaddingX - 36));
  const over = plan.overflowMinutes > 0;
  const chain = plan.burnout.chains[0];
  const past = day < today;

  const addToDay = (id: string, estimate: number | null) =>
    void guard({
      day,
      minutes: estimate ?? DEFAULT_ESTIMATE_MIN,
      proceed: async (target) => {
        await updateItem(db, id, { dueAt: target });
        toast(`Pridané do dňa ${fmtDateShort(target)}`, { undo: () => void updateItem(db, id, { dueAt: null }) });
      },
    });

  const status = over
    ? { text: `${t.plan.overloaded}: +${fmtMinutes(plan.overflowMinutes)}`, bg: theme.dangerSoft, fg: theme.dangerText, icon: 'warning' as const }
    : plan.full
      ? { text: t.plan.full, bg: theme.warningSoft, fg: theme.text, icon: 'info' as const }
      : { text: `Zostáva ${fmtMinutes(plan.remainingMinutes)} voľna`, bg: theme.successSoft, fg: theme.text, icon: 'checkCircle' as const };
  const statusIconColor = over ? theme.dangerText : plan.full ? theme.warning : theme.success;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.nav}>
          <IconButton name="arrowBack" label="Späť" variant="surface" onPress={goBack} />
          <View style={styles.navMid}>
            <IconButton name="chevronLeft" label="Predchádzajúci deň" onPress={() => setDay(addDays(day, -1))} />
            <ThemedText type="body" tabular style={styles.navTitle} numberOfLines={1}>
              {fmtDateShort(day)}
            </ThemedText>
            <IconButton name="chevronRight" label="Nasledujúci deň" onPress={() => setDay(addDays(day, 1))} />
          </View>
          <Button small variant={isToday ? 'ink' : 'secondary'} label={t.common.today} onPress={() => setDay(today)} />
        </View>

        <View style={[styles.body, past && { opacity: 0.6 }]}>
          <View>
            <ThemedText type="planTitle" accessibilityRole="header">
              {t.plan.title}
            </ThemedText>
            <ThemedText type="bodySmall" themeColor="text2">
              {fmtDateLong(day)}
            </ThemedText>
          </View>

          {running && isToday ? (
            <View style={[styles.focusCard, { backgroundColor: theme.ink }]}>
              <ThemedText type="label" style={{ color: theme.onInk, opacity: 0.7, letterSpacing: 1.2 }}>
                {t.plan.focusMode.toUpperCase()} · {t.plan.focusOn.toUpperCase()}
              </ThemedText>
              <ThemedText type="cardTitle" numberOfLines={2} style={{ color: theme.onInk, fontSize: 19, lineHeight: 24, fontFamily: FontFamily[800] }}>
                {running.itemTitle ?? running.tag ?? t.focus.noSubject}
              </ThemedText>
              <ThemedText type="timerCard" tabular style={{ color: theme.onInk, fontSize: 44, lineHeight: 52, opacity: running.pausedAt != null ? 0.6 : 1 }}>
                {countdown}
              </ThemedText>
              <View style={styles.focusButtons}>
                {running.pausedAt != null ? (
                  <Button small icon="play" label={t.focus.resume} onPress={() => void resumeFocus(db)} />
                ) : (
                  <Button small icon="pause" label={t.focus.pause} onPress={() => void pauseFocus(db)} />
                )}
                <Button small variant="inkOutline" label={t.plan.exitFocus} onPress={() => void stopFocus(db)} />
              </View>
            </View>
          ) : null}

          {chain ? (
            <Card tone="warning">
              <ThemedText type="bodySmall" style={{ color: theme.text }}>
                <ThemedText type="bodySmall" style={{ fontFamily: FontFamily[800] }}>
                  Riziko vyčerpania
                </ThemedText>{' '}
                – {plural(chain.deepCount, 'náročný blok', 'náročné bloky', 'náročných blokov')} po sebe bez pauzy ({fmtTime(chain.start)}–{fmtTime(chain.end)}, spolu {fmtMinutes(chain.totalMinutes)}). Vlož medzi ne pauzu.
              </ThemedText>
            </Card>
          ) : null}

          <View style={[styles.ringCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <DayRing
              plan={plan}
              size={ringSize}
              elapsedAngle={elapsed}
              workArcs={sessionArcs(sessions, day, now)}
              selectedKey={selectedKey}
              focusKey={focusEntry?.key ?? null}
              onSelect={setSelectedKey}
              label={`${t.plan.ring}: ${t.plan.planned} ${fmtMinutes(plan.plannedMinutes)} ${t.plan.of} ${fmtMinutes(plan.capacityMinutes)}. ${status.text}`}>
              <ThemedText type="ringCenter" tabular>
                {hm(plan.plannedMinutes)}
              </ThemedText>
              <ThemedText type="body" themeColor="text2" style={{ fontFamily: FontFamily[700] }}>
                z {fmtMinutes(plan.capacityMinutes)}
              </ThemedText>
            </DayRing>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <Icon name={status.icon} size={18} color={statusIconColor} filled />
              <ThemedText type="bodySmall" style={{ color: status.fg, fontFamily: FontFamily[800] }}>
                {status.text}
              </ThemedText>
            </View>
          </View>

          <View style={styles.legend}>
            <Legend label={`🔥 ${t.plan.legendDeep}`} color={theme.mark} swatch="solid" />
            <Legend label={t.plan.legendRoutine} color={theme.mark} swatch="muted" />
            <Legend label={`☕ ${t.plan.legendRest}`} color={theme.success} swatch="muted" />
            <Legend label="Udalosť" color={theme.text2} swatch="event" />
            <Legend label={t.plan.legendSleep} color={theme.text2} swatch="sleep" />
            <Legend label={t.plan.legendTentative} color={theme.mark} swatch="dashed" />
            <Legend label={t.plan.legendWork} color={theme.mark} swatch="ring" />
          </View>

          <Card>
            <View style={styles.between}>
              <ThemedText type="cardTitle">{t.plan.planned}</ThemedText>
              <ThemedText type="bodySmall" tabular style={{ fontFamily: FontFamily[800] }}>
                {fmtMinutes(plan.plannedMinutes)} z {fmtMinutes(plan.capacityMinutes)}
              </ThemedText>
            </View>
            <Meter value={plan.plannedMinutes / plan.capacityMinutes} label={t.plan.capacity} height={10} severity />
            <ThemedText type="meta" style={{ color: over ? theme.dangerText : theme.text2, fontFamily: FontFamily[700] }}>
              {over ? `⚠ +${fmtMinutes(plan.overflowMinutes)} ${t.plan.over}` : `${fmtMinutes(plan.remainingMinutes)} ${t.plan.free}`}
            </ThemedText>
          </Card>

          <Section title={t.plan.column}>
            {plan.entries.length ? (
              <PlanColumn plan={plan} selectedKey={selectedKey} focusKey={focusEntry?.key ?? null} countdown={countdown} now={isToday ? now : null} onSelect={setSelectedKey} />
            ) : (
              <Empty text={t.plan.noEntries} />
            )}
          </Section>

          <Section title={t.plan.backlog}>
            {backlog.length ? (
              backlog.map((task) => (
                <Card key={task.id}>
                  <ThemedText type="body" numberOfLines={2}>
                    {task.title || t.common.untitled}
                  </ThemedText>
                  <ThemedText type="meta" themeColor="text2" tabular>
                    {task.estimateMinutes ? fmtMinutes(task.estimateMinutes) : `~${fmtMinutes(DEFAULT_ESTIMATE_MIN)} (${t.plan.guessed})`}
                  </ThemedText>
                  <View style={styles.chips}>
                    <Chip label={t.plan.addToDay} selected onPress={() => addToDay(task.id, task.estimateMinutes)} />
                    <Chip label="Otvoriť" onPress={() => router.push({ pathname: '/item/[id]', params: { id: task.id } })} />
                  </View>
                </Card>
              ))
            ) : (
              <Empty text={t.plan.backlogEmpty} />
            )}
          </Section>
        </View>
      </ScrollView>
      <EntrySheet entry={selected} onClose={() => setSelectedKey(null)} />
      {dialog}
    </>
  );
}

type Swatch = 'solid' | 'muted' | 'dashed' | 'ring' | 'event' | 'sleep';

function Legend({ color, label, swatch }: { color: string; label: string; swatch: Swatch }) {
  const theme = useTheme();
  return (
    <View style={[styles.legendItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View
        style={[
          styles.dot,
          swatch === 'solid' && { backgroundColor: color },
          swatch === 'muted' && { backgroundColor: color, opacity: 0.5 },
          swatch === 'event' && { backgroundColor: color, opacity: 0.8 },
          swatch === 'sleep' && { backgroundColor: theme.sleepArc },
          swatch === 'dashed' && { borderColor: color, borderWidth: 1.5, borderStyle: 'dashed' },
          swatch === 'ring' && { borderColor: color, borderWidth: 3 },
        ]}
      />
      <ThemedText type="meta" style={{ color: theme.text, fontFamily: FontFamily[700] }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 80, width: '100%', maxWidth: Layout.contentMaxWidth, alignSelf: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingHorizontal: Layout.screenPaddingX, paddingBottom: Spacing.two },
  navMid: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  navTitle: { minWidth: 92, textAlign: 'center', fontFamily: FontFamily[800] },
  body: { paddingHorizontal: Layout.screenPaddingX, gap: 18 },
  focusCard: { borderRadius: Radius.cardL, padding: 20, gap: 8 },
  focusButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ringCard: { borderRadius: Radius.ringCard, borderWidth: 1, paddingTop: 18, paddingBottom: 20, alignItems: 'center', gap: 14 },
  statusPill: { height: 36, borderRadius: Radius.pill, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { height: 32, borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
