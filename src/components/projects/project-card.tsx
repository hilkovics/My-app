import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Opacity, Radius } from '@/constants/theme';
import type { Item } from '@/db/types';
import type { Goal, Project } from '@/features/projects/repository';
import { fmtCountdown, projectProgress } from '@/features/projects/stats';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { plural } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { EntityTile, Meter } from '../ui';

/** Project summary: tile in the project colour, progress of its tasks, deadline countdown, goal. */
export function ProjectCard({ project, items, goal, now }: { project: Project; items: Item[]; goal?: Goal | null; now: number }) {
  const theme = useTheme();
  const { activity: color } = useChartColors();
  const prog = projectProgress(items, now);
  const finished = project.status !== 'active';
  const c = color(project.colorSlot);
  const late = project.deadline != null && project.deadline < now && !finished && prog.pct < 100;
  const sub = [
    goal ? `${goal.icon} ${goal.name}` : null,
    project.deadline != null ? `${t.projects.deadline.toLowerCase()} ${fmtCountdown(project.deadline, now)}` : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${prog.total ? `${prog.pct} %` : t.projects.emptyProgress}`}
      onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, finished && { opacity: Opacity.archived }]}>
      <View style={styles.head}>
        <EntityTile icon={project.icon} color={c} />
        <View style={styles.flex}>
          <ThemedText type="cardTitle" numberOfLines={1}>
            {project.name}
          </ThemedText>
          {sub.length ? (
            <ThemedText type="meta" numberOfLines={2} style={{ color: late ? theme.dangerText : theme.text2 }}>
              {sub.join(' · ')}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="statValue" tabular>
          {prog.total ? `${prog.pct} %` : '–'}
        </ThemedText>
      </View>
      <Meter value={prog.pct / 100} label={`${project.name} ${prog.pct} %`} height={10} color={c} />
      <ThemedText type="meta" themeColor="text2" tabular>
        {prog.total ? `${prog.done}/${prog.total} ${t.projects.tasks}` : t.projects.emptyProgress}
        {prog.overdue ? (
          <ThemedText type="meta" style={{ color: theme.dangerText, fontFamily: FontFamily[700] }}>{` · ${plural(prog.overdue, 'úloha', 'úlohy', 'úloh')} ${t.projects.overdue}`}</ThemedText>
        ) : null}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: Radius.card, borderWidth: 1, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
