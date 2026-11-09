import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GoalCard } from '@/components/goals/goal-card';
import { ProjectCard } from '@/components/projects/project-card';
import { Button, Empty, IconButton, Row, Section } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { loadGoalViews } from '@/features/projects/goal-data';
import { getGoal, updateGoal } from '@/features/projects/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const theme = useTheme();
  const now = useNow();
  const view = useLiveQuery(
    async (d) => {
      const goal = await getGoal(d, id);
      return goal ? (await loadGoalViews(d, [goal], now))[0] : null;
    },
    [id, Math.floor(now / 60_000)],
  );
  if (view === undefined) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  if (view === null) {
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: theme.background }]}>
        <Empty text={t.item.notFound} />
      </View>
    );
  }
  const { goal } = view;
  return (
    <>
      <Stack.Screen
        options={{
          title: `${goal.icon} ${goal.name}`,
          headerRight: () => <IconButton name="settings" label={t.goals.edit} onPress={() => router.push({ pathname: '/goal/edit', params: { id: goal.id } })} />,
        }}
      />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
        <GoalCard view={view} now={now} onPress={() => {}} />
        <Section title={t.goals.projects}>
          {view.projects.length ? (
            view.projects.map(({ project, items }) => <ProjectCard key={project.id} project={project} items={items} goal={goal} now={now} />)
          ) : (
            <Empty text={t.goals.noProjects} />
          )}
        </Section>
        <Row>
          <Button
            small
            variant="secondary"
            label={goal.archived ? t.goals.unarchive : t.goals.archive}
            onPress={() => void updateGoal(db, goal.id, { archived: !goal.archived })}
          />
        </Row>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
