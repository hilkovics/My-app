import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Layout, Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { endBreak, pauseFocus, resumeFocus, startBreak, startFocus, stopFocus } from '@/features/focus/controller';
import { setFocusDraft, useFocusDraft } from '@/features/focus/draft';
import { focusPhase, pepLine, setJustFinished, useJustFinished, type FocusPhase } from '@/features/focus/phase';
import {
  deleteSession,
  getRunningSession,
  listFocusTags,
  listSessions,
  pomodoroEndsAt,
  restoreSession,
  type FocusMode,
  type FocusSession,
} from '@/features/focus/repository';
import { fmtClock, fmtMinutes, sessionDuration } from '@/features/focus/stats';
import { listTags } from '@/features/items/repository';
import { getSettings, setSetting } from '@/features/settings/repository';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { MINUTE, addDays, fmtTime, startOfDay } from '@/lib/dates';
import { toast } from '@/lib/toast-store';

import { Icon } from '../icon';
import { ThemedText } from '../themed-text';
import { Button, Card, Chip, Empty, IconButton, Input, Meter, Section, Segmented } from '../ui';

const POMODORO_PRESETS = [25, 50, 90];

/** Everything the Fokus tab needs: the running session, break, today's log, goal and the actions. */
export function useTimerState(tick = 1000) {
  const db = useDb();
  const now = useNow(tick);
  const day = startOfDay(now);
  const justFinished = useJustFinished();
  const settings = useLiveQuery((d) => getSettings(d), []);
  const running = useLiveQuery((d) => getRunningSession(d), []);
  const today = useLiveQuery((d) => listSessions(d, day, addDays(day, 1)), [day]) ?? [];
  const breakUntil = settings?.breakUntil ?? null;
  const phase = focusPhase({ running: running ?? null, breakUntil, now, justFinished });
  const todayMinutes = today.reduce((a, s) => a + sessionDuration(s, now), 0) / MINUTE;
  const goal = settings?.focusGoalMinutes ?? 180;
  const pomodoroMinutes = settings?.pomodoroMinutes ?? 25;
  const breakMinutes = settings?.breakMinutes ?? 5;
  const endsAt = running ? pomodoroEndsAt(running) : null;
  const countdown = running
    ? endsAt != null
      ? fmtClock(endsAt - now)
      : running.mode === 'pomodoro' && running.plannedMinutes != null
        ? fmtClock(running.plannedMinutes * MINUTE - sessionDuration(running, now))
        : fmtClock(sessionDuration(running, now))
    : null;

  return { db, now, phase, running, breakUntil, today, todayMinutes, goal, pomodoroMinutes, breakMinutes, countdown };
}

export type TimerState = ReturnType<typeof useTimerState>;

/** Stop saves a log entry (at least 1 min) and says so. */
async function stopWithToast(db: TimerState['db'], now: number) {
  const s = await stopFocus(db);
  if (s) toast(`Záznam uložený · ${fmtMinutes(Math.max(1, Math.round(sessionDuration(s, now) / MINUTE)))}`);
}

/**
 * Hero content of the accent zone while the timer is active: status, big time, task, progress,
 * Pauza / Pokračovať + round Stop, pep line (running / paused); done and break variants.
 */
export function TimerHero({ s }: { s: TimerState }) {
  const theme = useTheme();
  const { db, now, phase, running, breakUntil } = s;
  const on = theme.onAccent;
  const nextPomodoro = () => void startFocus(db, { mode: 'pomodoro', plannedMinutes: s.pomodoroMinutes, itemId: null, tag: null });

  if (phase === 'done') {
    return (
      <View style={styles.hero}>
        <ThemedText type="label" style={[styles.status, { color: on }]}>
          POMODORO HOTOVÉ 🎉
        </ThemedText>
        <View style={styles.heroButtons}>
          <Button variant="onAccent" label={`☕ Prestávka ${s.breakMinutes} min`} onPress={() => void startBreak(db)} style={styles.pair} />
          <Button variant="heroOutline" label="Ďalšie Pomodoro" onPress={nextPomodoro} style={styles.pair} />
        </View>
      </View>
    );
  }
  if (phase === 'break' && breakUntil != null) {
    return (
      <View style={styles.hero}>
        <ThemedText type="label" style={[styles.status, { color: on }]}>
          ☕ {t.focus.break.toUpperCase()}
        </ThemedText>
        <ThemedText type="timerHero" tabular style={[styles.time, { color: on }]}>
          {fmtClock(breakUntil - now)}
        </ThemedText>
        <View style={styles.heroButtons}>
          <Button variant="onAccent" label={t.focus.endBreak} onPress={() => void endBreak(db)} style={styles.pair} />
          <Button variant="heroOutline" label={t.focus.startNext} onPress={nextPomodoro} style={styles.pair} />
        </View>
      </View>
    );
  }
  if (!running) return null;
  const paused = running.pausedAt != null;
  const planned = running.mode === 'pomodoro' ? running.plannedMinutes : null;
  const status = running.mode === 'pomodoro' ? `POMODORO · ${paused ? 'POZASTAVENÉ' : `${planned} MIN`}` : paused ? 'STOPKY · POZASTAVENÉ' : 'STOPKY';
  const subject = [running.itemTitle, running.tag ? `#${running.tag}` : null].filter(Boolean).join(' · ') || t.focus.noSubject;
  return (
    <View style={styles.hero}>
      <ThemedText type="label" style={[styles.status, { color: on }]}>
        {status}
      </ThemedText>
      <ThemedText type="timerHero" tabular style={[styles.time, { color: on, opacity: paused ? 0.7 : 1 }]} accessibilityLabel={`Zostáva ${s.countdown}`}>
        {s.countdown}
      </ThemedText>
      <ThemedText type="body" style={{ color: on, textAlign: 'center', fontSize: 19, lineHeight: 24 }} numberOfLines={2}>
        {subject}
      </ThemedText>
      {planned ? <Meter value={sessionDuration(running, now) / (planned * MINUTE)} height={12} color={on} trackColor={theme.heroChip} label="Priebeh Pomodora" /> : null}
      <View style={styles.heroButtons}>
        <Button
          hero
          variant="onAccent"
          icon={paused ? 'play' : 'pause'}
          label={paused ? t.focus.resume : t.focus.pause}
          onPress={() => void (paused ? resumeFocus(db) : pauseFocus(db))}
          style={styles.flex}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.focus.stop}
          onPress={() => void stopWithToast(db, now)}
          style={({ pressed }) => [styles.stop, { borderColor: on, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Icon name="stop" size={26} color={on} filled />
        </Pressable>
      </View>
      <ThemedText type="bodySmall" style={{ color: on, opacity: 0.9, textAlign: 'center' }}>
        {pepLine(s.todayMinutes, s.goal, fmtMinutes)}
      </ThemedText>
    </View>
  );
}

/** Idle card (shown below the header while the timer is idle) + the Dnes log card. */
export function TimerBody({ s }: { s: TimerState }) {
  return (
    <>
      {s.phase === 'idle' ? <IdleCard s={s} /> : null}
      <TodayLog s={s} />
    </>
  );
}

function IdleCard({ s }: { s: TimerState }) {
  const theme = useTheme();
  const { db, pomodoroMinutes } = s;
  const draft = useFocusDraft();
  const [mode, setMode] = useState<FocusMode>('pomodoro');
  const [newTag, setNewTag] = useState('');
  const tags =
    useLiveQuery(async (d) => {
      const used = await listFocusTags(d);
      const noteTags = (await listTags(d)).map((x) => x.name);
      return [...new Set([...used, ...noteTags])].slice(0, 12);
    }, []) ?? [];

  const start = () => {
    setJustFinished(false);
    void startFocus(db, { mode, plannedMinutes: pomodoroMinutes, itemId: draft.itemId, tag: draft.tag });
  };
  const addTag = () => {
    const tag = newTag.trim().replace(/^#/, '');
    if (tag) setFocusDraft({ tag });
    setNewTag('');
  };

  return (
    <Card style={styles.idle}>
      <Segmented<FocusMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'pomodoro', label: t.focus.pomodoro },
          { value: 'stopwatch', label: t.focus.stopwatch },
        ]}
      />
      {mode === 'pomodoro' ? (
        <View style={styles.presets}>
          {POMODORO_PRESETS.map((m) => {
            const selected = pomodoroMinutes === m;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void setSetting(db, 'pomodoroMinutes', m)}
                style={[styles.preset, { backgroundColor: selected ? theme.accent : theme.surface2 }]}>
                <ThemedText type="body" tabular style={{ color: selected ? theme.onAccent : theme.text, fontFamily: FontFamily[800] }}>
                  {m} min
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <ThemedText type="bodySmall" themeColor="text2">
          {t.focus.stopwatchHint}
        </ThemedText>
      )}

      <View style={styles.group}>
        <ThemedText type="meta" themeColor="text2" style={{ fontFamily: FontFamily[700] }}>
          {t.focus.workingOn}
        </ThemedText>
        <View style={styles.chipRow}>
          <Chip label={draft.itemTitle ? `☐ ${draft.itemTitle}` : t.focus.pickItem} selected={!!draft.itemId} soft={!draft.itemId} onPress={() => router.push('/focus/pick')} />
          {draft.itemId ? (
            <IconButton name="close" size={18} label={t.focus.clearItem} color={theme.text2} onPress={() => setFocusDraft({ itemId: null, itemTitle: null })} />
          ) : null}
        </View>
        <View style={styles.chipRow}>
          <Chip label={t.focus.noTag} selected={!draft.tag} onPress={() => setFocusDraft({ tag: null })} />
          {[...new Set([...(draft.tag ? [draft.tag] : []), ...tags])].map((tag) => (
            <Chip key={tag} label={`#${tag}`} selected={draft.tag === tag} onPress={() => setFocusDraft({ tag })} />
          ))}
        </View>
        <Input
          value={newTag}
          onChangeText={setNewTag}
          placeholder={t.focus.newTag}
          autoCapitalize="none"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={addTag}
          onBlur={addTag}
        />
      </View>
      <Button hero icon="play" label={t.focus.start} onPress={start} />
    </Card>
  );
}

function TodayLog({ s }: { s: TimerState }) {
  const theme = useTheme();
  const { db, now, today, todayMinutes, goal } = s;

  const remove = async (session: FocusSession) => {
    await deleteSession(db, session.id);
    toast('Záznam práce vymazaný.', { undo: () => void restoreSession(db, session) });
  };

  return (
    <Section title={t.focus.today}>
      <Card>
        <View style={styles.between}>
          <ThemedText type="cardTitle" tabular>
            Dnes {fmtMinutes(todayMinutes)} {t.focus.of} {fmtMinutes(goal)}
          </ThemedText>
        </View>
        <ThemedText type="meta" themeColor="text2" tabular>
          {todayMinutes >= goal ? `✓ ${t.focus.goalReached}` : `${t.focus.remaining} ${fmtMinutes(goal - todayMinutes)}`}
        </ThemedText>
        <Meter value={todayMinutes / goal} height={10} severity={false} label="Denný cieľ fokusu" />
        {today.length ? (
          today
            .slice()
            .reverse()
            .map((x) => (
              <View key={x.id} style={[styles.session, { borderColor: theme.border }]}>
                <ThemedText type="meta" themeColor="text2" tabular style={styles.sessionTime}>
                  {fmtTime(x.startedAt)}–{x.endedAt ? fmtTime(x.endedAt) : '…'}
                </ThemedText>
                <ThemedText type="bodySmall" numberOfLines={1} style={styles.flex}>
                  {[x.itemTitle, x.tag ? `#${x.tag}` : null].filter(Boolean).join(' · ') || t.focus.noSubject}
                </ThemedText>
                <ThemedText type="bodySmall" tabular style={{ fontFamily: FontFamily[800] }}>
                  {fmtMinutes(sessionDuration(x, now) / MINUTE)}
                </ThemedText>
                {x.endedAt ? (
                  <IconButton name="close" size={18} label={`${t.common.delete}: ${x.itemTitle ?? x.tag ?? t.focus.noSubject}`} color={theme.text2} onPress={() => void remove(x)} />
                ) : null}
              </View>
            ))
        ) : (
          <Empty text="Dnes ešte žiadna sústredená práca." />
        )}
      </Card>
    </Section>
  );
}

export type { FocusPhase };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pair: { flex: 1, paddingHorizontal: 10 },
  hero: { gap: 14, alignItems: 'stretch' },
  status: { textAlign: 'center', fontSize: 13, letterSpacing: 1.4 },
  time: { textAlign: 'center' },
  heroButtons: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stop: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  idle: { gap: Spacing.three, padding: Layout.cardPadding + 2 },
  presets: { flexDirection: 'row', gap: 10 },
  preset: { flex: 1, height: 56, borderRadius: Radius.taskRow, alignItems: 'center', justifyContent: 'center' },
  group: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  session: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth },
  sessionTime: { width: 84 },
});
