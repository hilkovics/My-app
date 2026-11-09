import { router } from 'expo-router';

import { useLiveQuery, useNow } from '@/db/hooks';
import { loadGoalViews } from '@/features/projects/goal-data';
import { listGoals } from '@/features/projects/repository';
import { t } from '@/i18n/sk';

import { Button, Empty } from '../ui';
import { GoalCard } from './goal-card';

/** "Ciele" section of the Progress tab. */
export function GoalsPanel() {
  const now = useNow();
  const views = useLiveQuery(async (d) => loadGoalViews(d, await listGoals(d), now), [Math.floor(now / 60_000)]);
  if (!views) return null;
  return (
    <>
      {views.length ? views.map((v) => <GoalCard key={v.goal.id} view={v} now={now} />) : <Empty text={t.goals.empty} />}
      <Button variant="secondary" icon="add" label={t.goals.new} onPress={() => router.push('/goal/edit')} />
    </>
  );
}
