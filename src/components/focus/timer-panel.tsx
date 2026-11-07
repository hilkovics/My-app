import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  endBreak,
  finishDueFocus,
  pauseFocus,
  resumeFocus,
  startBreak,
  startFocus,
  stopFocus,
} from '@/features/focus/controller';
import { setFocusDraft, useFocusDraft } from '@/features/focus/draft';
import {
  deleteSession,
  getRunningSession,
  listFocusTags,
  listSessions,
  pomodoroEndsAt,
  type FocusMode,
} from '@/features/focus/repository';
import { fmtClock, fmtMinutes, sessionDuration } from '@/features/focus/stats';
import { listTags } from '@/features/items/repository';
import { getSettings, setSetting } from '@/features/settings/repository';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { confirm } from '@/lib/confirm';
import { MINUTE, addDays, fmtTime, startOfDay } from '@/lib/dates';

import { Meter } from '../meter';
import { ThemedText } from '../themed-text';
import { Button, Card, Chip, Empty, IconButton, Input, Row, Section, Segmented } from '../ui';

const POMODORO_PRESETS = [25, 50, 90];

export function TimerPanel() {
  const db = useDb();
  const theme = useTheme();
  const now = useNow(1000);
  const day = startOfDay(now);
  const draft = useFocusDraft();
  const [mode, setMode] = useState<FocusMode>('pomodoro');
  const [newTag, setNewTag] = useState('');
  const [justFinished, setJustFinished] = useState(false);
  const settings = useLiveQuery((d) => getSettings(d), []);
  const running = useLiveQuery((d) => getRunningSession(d), []);
  const today = useLiveQuery((d) => listSessions(d, day, addDays(day, 1)), [day]) ?? [];
  const tags =
    useLiveQuery(async (d) => {
      const used = await listFocusTags(d);
      const noteTags = (await listTags(d)).map((x) => x.name);
      return [...new Set([...used, ...noteTags])].slice(0, 12);
    }, []) ?? [];

  const endsAt = running ? pomodoroEndsAt(running) : null;
  const breakUntil = settings?.breakUntil ?? null;
  const onBreak = breakUntil != null && breakUntil > now;

  // Pomodoro time is up → finish it and offer a break.
  useEffect(() => {
    if (endsAt != null && now >= endsAt) {
      void finishDueFocus(db).then((s) => s && setJustFinished(true));
    }
  }, [db, endsAt, now]);

  // Break over → clear it.
  useEffect(() => {
    if (breakUntil != null && breakUntil <= now) void endBreak(db);
  }, [db, breakUntil, now]);

  const todayMinutes = today.reduce((a, s) => a + sessionDuration(s, now), 0) / MINUTE;
  const goal = settings?.focusGoalMinutes ?? 180;
  const pomodoroMinutes = settings?.pomodoroMinutes ?? 25;

  const start = async () => {
    setJustFinished(false);
    await startFocus(db, {
      mode,
      plannedMinutes: pomodoroMinutes,
      itemId: draft.itemId,
      tag: draft.tag,
    });
  };

  const stop = async () => {
    const s = await stopFocus(db);
    if (s?.mode === 'pomodoro') setJustFinished(true);
  };

  const addTag = () => {
    const tag = newTag.trim().replace(/^#/, '');
    if (tag) setFocusDraft({ tag });
    setNewTag('');
  };

  return (
    <>
      <Card style={styles.card}>
        {running ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {running.mode === 'pomodoro' ? `${t.focus.pomodoro} · ${running.plannedMinutes} min` : t.focus.stopwatch}
              {running.pausedAt != null ? ` · ${t.focus.paused}` : ''}
            </ThemedText>
            <ThemedText style={[styles.clock, { color: running.pausedAt != null ? theme.textSecondary : theme.text }]}>
              {endsAt != null
                ? fmtClock(endsAt - now)
                : running.mode === 'pomodoro' && running.plannedMinutes != null
                  ? fmtClock(running.plannedMinutes * MINUTE - sessionDuration(running, now))
                  : fmtClock(sessionDuration(running, now))}
            </ThemedText>
            {running.mode === 'pomodoro' && running.plannedMinutes ? (
              <Meter value={sessionDuration(running, now) / (running.plannedMinutes * MINUTE)} />
            ) : null}
            <ThemedText themeColor="textSecondary" numberOfLines={1}>
              {[running.itemTitle, running.tag ? `#${running.tag}` : null].filter(Boolean).join(' · ') || t.focus.noSubject}
            </ThemedText>
            <Row style={styles.center}>
              {running.pausedAt != null ? (
                <Button icon="play" label={t.focus.resume} onPress={() => void resumeFocus(db)} />
              ) : (
                <Button variant="secondary" icon="pause" label={t.focus.pause} onPress={() => void pauseFocus(db)} />
              )}
              <Button variant="danger" icon="stop" label={t.focus.stop} onPress={() => void stop()} />
            </Row>
          </>
        ) : onBreak ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              ☕ {t.focus.break}
            </ThemedText>
            <ThemedText style={styles.clock}>{fmtClock(breakUntil - now)}</ThemedText>
            <Row style={styles.center}>
              <Button variant="secondary" label={t.focus.endBreak} onPress={() => void endBreak(db)} />
              <Button icon="play" label={t.focus.startNext} onPress={() => void start()} />
            </Row>
          </>
        ) : (
          <>
            {justFinished ? (
              <View style={styles.finished}>
                <ThemedText type="smallBold">{t.focus.finished}</ThemedText>
                <Row style={styles.center}>
                  <Button
                    variant="secondary"
                    label={`☕ ${t.focus.break} ${settings?.breakMinutes ?? 5} min`}
                    onPress={() => {
                      setJustFinished(false);
                      void startBreak(db);
                    }}
                  />
                </Row>
              </View>
            ) : null}
            <Segmented<FocusMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'pomodoro', label: t.focus.pomodoro },
                { value: 'stopwatch', label: t.focus.stopwatch },
              ]}
            />
            {mode === 'pomodoro' ? (
              <Row>
                {POMODORO_PRESETS.map((m) => (
                  <Chip
                    key={m}
                    label={`${m} min`}
                    selected={pomodoroMinutes === m}
                    onPress={() => void setSetting(db, 'pomodoroMinutes', m)}
                  />
                ))}
              </Row>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t.focus.stopwatchHint}
              </ThemedText>
            )}

            <ThemedText type="smallBold" themeColor="textSecondary">
              {t.focus.workingOn}
            </ThemedText>
            <Row>
              <Chip
                label={draft.itemTitle ? `☐ ${draft.itemTitle}` : t.focus.pickItem}
                selected={!!draft.itemId}
                onPress={() => router.push('/focus/pick')}
              />
              {draft.itemId ? (
                <IconButton
                  name="close"
                  size={16}
                  label={t.focus.clearItem}
                  color={theme.textSecondary}
                  onPress={() => setFocusDraft({ itemId: null, itemTitle: null })}
                />
              ) : null}
            </Row>
            <Row>
              <Chip label={t.focus.noTag} selected={!draft.tag} onPress={() => setFocusDraft({ tag: null })} />
              {[...new Set([...(draft.tag ? [draft.tag] : []), ...tags])].map((tag) => (
                <Chip key={tag} label={`#${tag}`} selected={draft.tag === tag} onPress={() => setFocusDraft({ tag })} />
              ))}
            </Row>
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
            <Button icon="play" label={t.focus.start} onPress={() => void start()} />
          </>
        )}
      </Card>

      <Section title={t.focus.today}>
        <Card>
          <Row style={styles.between}>
            <ThemedText type="smallBold">
              {fmtMinutes(todayMinutes)} {t.focus.of} {fmtMinutes(goal)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {todayMinutes >= goal ? `✓ ${t.focus.goalReached}` : `${t.focus.remaining} ${fmtMinutes(goal - todayMinutes)}`}
            </ThemedText>
          </Row>
          <Meter value={todayMinutes / goal} />
        </Card>
        {today.length ? (
          today
            .slice()
            .reverse()
            .map((s) => (
              <Row key={s.id} style={[styles.session, { borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sessionTime}>
                  {fmtTime(s.startedAt)}–{s.endedAt ? fmtTime(s.endedAt) : '…'}
                </ThemedText>
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1}>
                    {[s.itemTitle, s.tag ? `#${s.tag}` : null].filter(Boolean).join(' · ') || t.focus.noSubject}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{fmtMinutes(sessionDuration(s, now) / MINUTE)}</ThemedText>
                {s.endedAt ? (
                  <IconButton
                    name="close"
                    size={16}
                    label={t.common.delete}
                    color={theme.textSecondary}
                    onPress={() =>
                      void confirm(t.focus.deleteSession, undefined, t.common.delete).then(async (ok) => {
                        if (ok) await deleteSession(db, s.id);
                      })
                    }
                  />
                ) : null}
              </Row>
            ))
        ) : (
          <Empty text={t.focus.noSessions} />
        )}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: Spacing.three },
  clock: { fontSize: 64, lineHeight: 72, fontWeight: 300, textAlign: 'center', fontVariant: ['tabular-nums'] },
  center: { justifyContent: 'center' },
  between: { justifyContent: 'space-between' },
  finished: { gap: Spacing.two, alignItems: 'center' },
  session: { flexWrap: 'nowrap', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  sessionTime: { width: 96, fontVariant: ['tabular-nums'] },
});
