import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/db/hooks';
import { getRunningSession, listSessions } from '@/features/focus/repository';
import { fmtClock, fmtMinutes, sessionDuration } from '@/features/focus/stats';
import { nowAngle, sessionArcs } from '@/features/plan/layout';
import { useDayPlan } from '@/features/plan/use-day-plan';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { addDays, startOfDay } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { Card } from '../ui';
import { DayRing } from './day-ring';

/** Today screen: the day ring in small, the load against the capacity, warnings; opens the day plan. */
export function TodayPlanCard() {
  const theme = useTheme();
  const now = useNow(1000);
  const day = startOfDay(now);
  const plan = useDayPlan(day);
  const sessions = useLiveQuery((d) => listSessions(d, day, addDays(day, 1)), [day]) ?? [];
  const running = useLiveQuery((d) => getRunningSession(d), []);
  if (!plan) return null;

  const over = plan.overflowMinutes > 0;
  const chain = plan.burnout.chains[0];
  const focusEntry = running?.itemId ? plan.entries.find((e) => e.id === running.itemId && e.kind !== 'external') : undefined;
  const status = over
    ? `${t.plan.overloaded}: +${fmtMinutes(plan.overflowMinutes)}`
    : plan.full
      ? t.plan.full
      : `${t.plan.remaining} ${fmtMinutes(plan.remainingMinutes)}`;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t.plan.openPlan} onPress={() => router.push('/plan')}>
      <Card>
        <View style={styles.row}>
          <DayRing
            plan={plan}
            size={116}
            compact
            elapsedAngle={nowAngle(day, now)}
            workArcs={sessionArcs(sessions, day, now)}
            focusKey={focusEntry?.key ?? null}
            label={`${t.plan.ring}: ${fmtMinutes(plan.plannedMinutes)} ${t.plan.of} ${fmtMinutes(plan.capacityMinutes)}`}>
            <ThemedText type="smallBold">{Math.round((plan.plannedMinutes / plan.capacityMinutes) * 100)} %</ThemedText>
          </DayRing>
          <View style={styles.flex}>
            <ThemedText type="smallBold">{t.plan.title}</ThemedText>
            <ThemedText type="small">
              {fmtMinutes(plan.plannedMinutes)} {t.plan.of} {fmtMinutes(plan.capacityMinutes)}
            </ThemedText>
            <ThemedText type="small" style={{ color: over ? theme.danger : plan.full ? theme.warning : theme.success }}>
              {status}
            </ThemedText>
            {chain ? (
              <ThemedText type="small" style={{ color: theme.warning }}>
                ⚠ Riziko vyčerpania
              </ThemedText>
            ) : null}
            {running ? (
              <ThemedText type="small" themeColor="text2" numberOfLines={1}>
                ⏱ {running.itemTitle ?? t.focus.running} · {fmtClock(sessionDuration(running, now))}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1, gap: 2 },
});
