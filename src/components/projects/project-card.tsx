import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Item } from '@/db/types';
import type { Goal, Project } from '@/features/projects/repository';
import { fmtCountdown, projectProgress } from '@/features/projects/stats';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { plural } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { Card, Meter } from '../ui';

/** Project summary: progress of its tasks, deadline countdown, goal. */
export function ProjectCard({ project, items, goal, now }: { project: Project; items: Item[]; goal?: Goal | null; now: number }) {
  const theme = useTheme();
  const { activity: color } = useChartColors();
  const prog = projectProgress(items, now);
  const finished = project.status !== 'active';
  const sub = [
    goal ? `${goal.icon} ${goal.name}` : null,
    project.deadline != null ? `${t.projects.deadline.toLowerCase()} ${fmtCountdown(project.deadline, now)}` : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={project.name}
      onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}>
      <Card style={finished ? styles.finished : undefined}>
        <View style={styles.head}>
          <View style={[styles.swatch, { backgroundColor: color(project.colorSlot) }]} />
          <ThemedText style={styles.icon}>{project.icon}</ThemedText>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {project.name}
            </ThemedText>
            {sub.length ? (
              <ThemedText
                type="small"
                numberOfLines={1}
                style={{ color: project.deadline != null && project.deadline < now && !finished && prog.pct < 100 ? theme.danger : theme.text2 }}>
                {sub.join(' · ')}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="smallBold">{prog.total ? `${prog.pct} %` : '–'}</ThemedText>
        </View>
        <Meter value={prog.pct / 100} label={`${project.name} ${prog.pct} %`} />
        <ThemedText type="small" themeColor="text2">
          {prog.total ? `${prog.done}/${prog.total} ${t.projects.tasks}` : t.projects.emptyProgress}
          {prog.overdue ? ` · ${plural(prog.overdue, 'úloha', 'úlohy', 'úloh')} ${t.projects.overdue}` : ''}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  icon: { fontSize: 24, lineHeight: 30 },
  finished: { opacity: 0.55 },
});
