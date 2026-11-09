import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { GoalView } from '@/features/projects/goal-data';
import { fmtCountdown, fmtGoalValue } from '@/features/projects/stats';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

import { ThemedText } from '../themed-text';
import { Card, Meter } from '../ui';

/** Summary line about the plan, e.g. "Zaostávaš za plánom (podľa plánu by si mal mať 25,8 km)". */
export function planText(view: GoalView): string | null {
  const { progress: p } = view;
  if (p.reached) return t.goals.reached;
  if (p.expected == null) return null;
  return p.onTrack ? t.goals.onTrack : `${t.goals.behind} (${t.goals.plan.toLowerCase()} ${fmtGoalValue(p.expected, p.unit)})`;
}

export function GoalCard({ view, now, onPress }: { view: GoalView; now: number; onPress?: () => void }) {
  const theme = useTheme();
  const { goal, progress: p } = view;
  const plan = planText(view);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={goal.name}
      onPress={onPress ?? (() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } }))}>
      <Card style={goal.archived ? styles.archived : undefined}>
        <View style={styles.head}>
          <ThemedText style={styles.icon}>{goal.icon}</ThemedText>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {goal.name}
            </ThemedText>
            <ThemedText type="small" themeColor="text2" numberOfLines={1}>
              {goal.kind === 'projects'
                ? `${p.value}/${p.target} ${t.goals.tasksDone}`
                : `${fmtGoalValue(p.value, p.unit)} / ${fmtGoalValue(p.target, p.unit)}`}
              {goal.deadline != null ? ` · ${t.projects.deadline.toLowerCase()} ${fmtCountdown(goal.deadline, now)}` : ''}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">{p.target ? `${p.pct} %` : '–'}</ThemedText>
        </View>
        <Meter value={p.pct / 100} label={`${goal.name} ${p.pct} %`} />
        {plan ? (
          <ThemedText type="small" style={{ color: p.reached || p.onTrack ? theme.success : theme.warning }}>
            {plan}
          </ThemedText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { fontSize: 24, lineHeight: 30 },
  archived: { opacity: 0.5 },
});
