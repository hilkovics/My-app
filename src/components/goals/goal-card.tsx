import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Opacity, Radius } from '@/constants/theme';
import type { GoalView } from '@/features/projects/goal-data';
import { fmtCountdown, fmtGoalValue } from '@/features/projects/stats';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

import { Icon } from '../icon';
import { ThemedText } from '../themed-text';
import { EntityTile, Meter } from '../ui';

/** Summary line about the plan, e.g. "Zaostávaš za plánom (podľa plánu by si mal mať 25,8 km)". */
export function planText(view: GoalView): string | null {
  const { progress: p } = view;
  if (p.reached) return t.goals.reached;
  if (p.expected == null) return null;
  return p.onTrack ? t.goals.onTrack : `${t.goals.behind} (${t.goals.plan.toLowerCase()} ${fmtGoalValue(p.expected, p.unit)})`;
}

/**
 * Goal card: emoji tile, title, sub line, percentage and meter, then a status line with an icon.
 * On track = 1 px border + check; behind = 2 px warning border + warning icon (text wraps to 2 lines);
 * done = successSoft fill, 2 px success border, celebration icon and a success meter.
 * The state is carried by the icon and the words as well as by the colours.
 */
export function GoalCard({ view, now, onPress }: { view: GoalView; now: number; onPress?: () => void }) {
  const theme = useTheme();
  const { goal, progress: p } = view;
  const plan = planText(view);
  const behind = !p.reached && p.expected != null && !p.onTrack;
  const frame = p.reached
    ? { backgroundColor: theme.successSoft, borderColor: theme.success, borderWidth: 2 }
    : behind
      ? { backgroundColor: theme.surface, borderColor: theme.warning, borderWidth: 2 }
      : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 };
  const statusColor = p.reached ? theme.success : behind ? theme.warning : theme.success;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.name}, ${p.target ? `${p.pct} %` : ''}${plan ? `. ${plan}` : ''}`}
      onPress={onPress ?? (() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } }))}
      style={[styles.card, frame, goal.archived && { opacity: Opacity.archived }]}>
      <View style={styles.head}>
        <EntityTile icon={goal.icon} color={theme.markSoft} />
        <View style={styles.flex}>
          <ThemedText type="cardTitle" numberOfLines={1}>
            {goal.name}
          </ThemedText>
          <ThemedText type="meta" themeColor="text2" numberOfLines={2} tabular>
            {goal.kind === 'projects'
              ? `${p.value}/${p.target} ${t.goals.tasksDone}`
              : `${fmtGoalValue(p.value, p.unit)} / ${fmtGoalValue(p.target, p.unit)}`}
            {goal.deadline != null ? ` · ${t.projects.deadline.toLowerCase()} ${fmtCountdown(goal.deadline, now)}` : ''}
          </ThemedText>
        </View>
        <ThemedText type="statValue" tabular>
          {p.target ? `${p.pct} %` : '–'}
        </ThemedText>
      </View>
      <Meter value={p.pct / 100} label={`${goal.name} ${p.pct} %`} height={10} color={p.reached ? theme.success : theme.mark} />
      {plan ? (
        <View style={styles.status}>
          <Icon name={p.reached ? 'celebration' : behind ? 'warning' : 'checkCircle'} size={20} color={statusColor} filled />
          <ThemedText type="bodySmall" style={[styles.flex, { fontFamily: FontFamily[700] }]}>
            {plan}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: Radius.card, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
