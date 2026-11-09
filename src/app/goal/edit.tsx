import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Field, Input, Row, Segmented } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { listActivities } from '@/features/activities/repository';
import { createGoal, deleteGoal, getGoal, listGoals, updateGoal, type Goal, type GoalKind, type GoalMetric } from '@/features/projects/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { confirm } from '@/lib/confirm';
import { startOfDay } from '@/lib/dates';
import { goBack } from '@/lib/nav';

const ICONS = ['🎯', '🎤', '🏃', '🎸', '📚', '💪', '🌍', '💼', '🏆', '🌱'];
const DEFAULT_TARGET: Record<GoalMetric, number> = { minutes: 600, km: 50, sessions: 12 };

export default function EditGoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const data = useLiveQuery(
    async (d) => ({ goal: id ? await getGoal(d, id) : null, activities: await listActivities(d), all: await listGoals(d, true) }),
    [id ?? null],
  );
  if (!data) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return <Editor key={data.goal?.id ?? 'new'} goal={data.goal} activities={data.activities} />;
}

function Editor({ goal, activities }: { goal: Goal | null; activities: Awaited<ReturnType<typeof listActivities>> }) {
  const db = useDb();
  const theme = useTheme();
  const [name, setName] = useState(goal?.name ?? '');
  const [icon, setIcon] = useState(goal?.icon ?? '🎯');
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'projects');
  const [activityId, setActivityId] = useState<string | null>(goal?.activityId ?? activities[0]?.id ?? null);
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'minutes');
  const [target, setTarget] = useState(String(goal?.target ?? DEFAULT_TARGET[goal?.metric ?? 'minutes']).replace('.', ','));
  const [startAt, setStartAt] = useState<number | null>(() => goal?.startAt ?? startOfDay(Date.now()));
  const [deadline, setDeadline] = useState<number | null>(goal?.deadline ?? null);

  const activity = activities.find((a) => a.id === activityId);
  const metrics: GoalMetric[] = activity?.kind === 'check' ? ['sessions'] : activity?.trackDistance ? ['minutes', 'km', 'sessions'] : ['minutes', 'sessions'];
  const effectiveMetric = metrics.includes(metric) ? metric : metrics[0];
  const targetNum = Number(target.replace(',', '.'));
  const valid = name.trim() && (kind === 'projects' || (activity && targetNum > 0));

  const save = async () => {
    if (!valid) return;
    const input =
      kind === 'projects'
        ? { name: name.trim(), icon, kind, activityId: null, metric: null, target: null, startAt: null, deadline }
        : { name: name.trim(), icon, kind, activityId, metric: effectiveMetric, target: targetNum, startAt, deadline };
    if (goal) {
      await updateGoal(db, goal.id, input);
      goBack();
    } else {
      const created = await createGoal(db, input);
      router.replace({ pathname: '/goal/[id]', params: { id: created.id } });
    }
  };

  const remove = async () => {
    if (goal && (await confirm(t.common.confirmDelete, goal.name, t.common.delete))) {
      await deleteGoal(db, goal.id);
      router.dismissTo('/progress');
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label={t.goals.name}>
        <Input value={name} onChangeText={setName} placeholder="napr. Zahrať koncert" big autoFocus={!goal} />
      </Field>
      <Field label={t.projects.icon}>
        <Row>
          {ICONS.map((i) => (
            <Chip key={i} label={i} selected={icon === i} onPress={() => setIcon(i)} />
          ))}
        </Row>
      </Field>
      <Field label={t.goals.kind}>
        <Segmented<GoalKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'projects', label: t.goals.fromProjects },
            { value: 'activity', label: t.goals.fromActivity },
          ]}
        />
      </Field>

      {kind === 'activity' ? (
        activities.length ? (
          <>
            <Field label={t.goals.activity}>
              <Row>
                {activities.map((a) => (
                  <Chip key={a.id} label={`${a.icon} ${a.name}`} selected={activityId === a.id} onPress={() => setActivityId(a.id)} />
                ))}
              </Row>
            </Field>
            <Field label={t.goals.metric}>
              <Row>
                {metrics.map((m) => (
                  <Chip
                    key={m}
                    label={m === 'minutes' ? t.goals.metricMinutes : m === 'km' ? t.goals.metricKm : t.goals.metricSessions}
                    selected={effectiveMetric === m}
                    onPress={() => {
                      setMetric(m);
                      if (!goal || goal.metric !== m) setTarget(String(DEFAULT_TARGET[m]));
                    }}
                  />
                ))}
              </Row>
            </Field>
            <Field label={t.goals.target}>
              <Input value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
            </Field>
            <Field label={t.goals.from}>
              <DateTimeField value={startAt} withTime={false} allowClear={false} onChange={setStartAt} />
            </Field>
          </>
        ) : (
          <ThemedText themeColor="text2">{t.goals.pickActivity}</ThemedText>
        )
      ) : null}

      <Field label={t.goals.to}>
        <DateTimeField value={deadline} withTime={false} onChange={setDeadline} />
      </Field>

      <Button label={t.common.save} onPress={() => void save()} disabled={!valid} />
      {goal ? <Button variant="danger" icon="trash" label={t.common.delete} onPress={() => void remove()} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
