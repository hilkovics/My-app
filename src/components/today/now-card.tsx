import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { Meter } from '@/components/ui';
import { FontFamily, Layout, Radius } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { pauseFocus, resumeFocus, startFocus } from '@/features/focus/controller';
import { getRunningSession } from '@/features/focus/repository';
import { fmtClock, fmtMinutes, sessionDuration } from '@/features/focus/stats';
import { currentEntry } from '@/features/plan/hero';
import type { DayPlan, PlanEntry } from '@/features/plan/layout';
import { getSettings } from '@/features/settings/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtTime, MINUTE } from '@/lib/dates';

function kindLabel(e: PlanEntry): string {
  if (e.kind === 'event' || e.kind === 'external') return 'Udalosť';
  switch (e.visual_intensity.energy) {
    case 'deep':
      return `🔥 ${t.plan.legendDeep}`;
    case 'rest':
      return `☕ ${t.plan.legendRest}`;
    default:
      return t.plan.legendRoutine;
  }
}

/**
 * "Teraz" card: the plan block that contains now. The round button starts a Pomodoro on that task
 * (or pauses / resumes the one that is running for it) and shows its countdown and progress.
 */
export function NowCard({ plan, now }: { plan: DayPlan; now: number }) {
  const db = useDb();
  const theme = useTheme();
  const cur = currentEntry(plan.entries, now);
  const running = useLiveQuery((d) => getRunningSession(d), []);
  const pomodoroMinutes = useLiveQuery(async (d) => (await getSettings(d)).pomodoroMinutes, []) ?? 25;
  if (!cur || cur.start == null) return null;

  const itemId = cur.kind === 'external' ? null : cur.id;
  const mine = !!running && running.itemId === itemId;
  const paused = mine && running.pausedAt != null;
  const planned = mine && running.mode === 'pomodoro' ? (running.plannedMinutes ?? null) : null;
  const elapsedMs = mine ? sessionDuration(running, now) : 0;
  const remainingMs = planned != null ? Math.max(0, planned * MINUTE - elapsedMs) : null;
  const leftInBlock = Math.max(0, Math.round((cur.start + cur.durationMin * MINUTE - now) / MINUTE));

  const onPress = () => {
    if (mine) void (paused ? resumeFocus(db) : pauseFocus(db));
    else void startFocus(db, { mode: 'pomodoro', plannedMinutes: pomodoroMinutes, itemId, tag: null });
  };
  const icon = mine && !paused ? 'pause' : 'play';
  const buttonLabel = mine ? (paused ? 'Pokračovať' : 'Pozastaviť') : 'Spustiť Pomodoro';

  return (
    <View style={[styles.card, { backgroundColor: theme.ink }]}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <ThemedText type="label" style={{ color: theme.onInk, opacity: 0.7, letterSpacing: 1.2 }} tabular>
            TERAZ · {fmtTime(cur.start)}–{fmtTime(cur.start + cur.durationMin * MINUTE)}
          </ThemedText>
          <ThemedText type="cardTitleL" numberOfLines={2} style={{ color: theme.onInk }}>
            {cur.title}
          </ThemedText>
          <ThemedText type="bodySmall" style={{ color: theme.onInk, opacity: 0.85 }}>
            {kindLabel(cur)} · zostáva {fmtMinutes(leftInBlock)}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          onPress={onPress}
          style={({ pressed }) => [styles.play, { backgroundColor: theme.accent, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Icon name={icon} size={36} color={theme.onAccent} filled />
        </Pressable>
      </View>
      {remainingMs != null && planned ? (
        <View style={styles.bottom}>
          <ThemedText type="section" tabular style={{ color: theme.onInk, fontFamily: FontFamily[800], fontSize: 26, lineHeight: 32 }}>
            {fmtClock(remainingMs)}
          </ThemedText>
          <Meter value={elapsedMs / (planned * MINUTE)} height={10} color={theme.accent} trackColor={theme.inkTrack} label="Priebeh Pomodora" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { borderRadius: Radius.cardL, padding: 20, gap: 14, maxWidth: Layout.contentMaxWidth },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  play: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  bottom: { gap: 8 },
});
