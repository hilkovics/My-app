import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { Button, Chip, Field, Input, Row } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  createProject,
  deleteProject,
  getProject,
  listGoals,
  updateProject,
  type Project,
} from '@/features/projects/repository';
import { useChartColors } from '@/hooks/use-chart-colors';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { confirm } from '@/lib/confirm';
import { goBack } from '@/lib/nav';

const ICONS = ['📁', '🎤', '🎸', '💻', '🏠', '✈️', '📚', '🎓', '💼', '🛠️', '🎯', '🌱', '🎬', '🏃'];

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const data = useLiveQuery(
    async (d) => ({ project: id ? await getProject(d, id) : null, goals: await listGoals(d) }),
    [id ?? null],
  );
  if (!data) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  return <Editor key={data.project?.id ?? 'new'} project={data.project} goals={data.goals} />;
}

function Editor({ project, goals }: { project: Project | null; goals: Awaited<ReturnType<typeof listGoals>> }) {
  const db = useDb();
  const theme = useTheme();
  const { slots } = useChartColors();
  const [name, setName] = useState(project?.name ?? '');
  const [icon, setIcon] = useState(project?.icon ?? '📁');
  const [slot, setSlot] = useState<number | null>(project?.colorSlot ?? null);
  const [description, setDescription] = useState(project?.description ?? '');
  const [goalId, setGoalId] = useState<string | null>(project?.goalId ?? null);
  const [deadline, setDeadline] = useState<number | null>(project?.deadline ?? null);

  const save = async () => {
    if (!name.trim()) return;
    const input = { name: name.trim(), icon, description: description.trim(), goalId, deadline, ...(slot != null ? { colorSlot: slot } : {}) };
    if (project) {
      await updateProject(db, project.id, input);
      goBack();
    } else {
      const created = await createProject(db, input);
      router.replace({ pathname: '/project/[id]', params: { id: created.id } });
    }
  };

  const remove = async () => {
    if (project && (await confirm(t.common.confirmDelete, project.name, t.common.delete))) {
      await deleteProject(db, project.id);
      router.dismissTo('/tasks');
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label={t.projects.name}>
        <Input value={name} onChangeText={setName} placeholder="napr. Koncert" big autoFocus={!project} />
      </Field>
      <Field label={t.projects.icon}>
        <Row>
          {ICONS.map((i) => (
            <Chip key={i} label={i} selected={icon === i} onPress={() => setIcon(i)} />
          ))}
        </Row>
      </Field>
      <Field label={t.projects.color}>
        <Row>
          {slots.map((c, i) => (
            <Chip key={c} label={(slot ?? project?.colorSlot) === i ? '✓' : ' '} color={c} selected onPress={() => setSlot(i)} />
          ))}
        </Row>
      </Field>
      <Field label={t.item.body}>
        <Input value={description} onChangeText={setDescription} placeholder={t.projects.name} multiline style={styles.desc} />
      </Field>
      <Field label={t.projects.goal}>
        <Row>
          <Chip label={t.projects.noGoal} selected={goalId == null} onPress={() => setGoalId(null)} />
          {goals
            .filter((g) => g.kind === 'projects' || g.id === goalId)
            .map((g) => (
              <Chip key={g.id} label={`${g.icon} ${g.name}`} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />
            ))}
        </Row>
      </Field>
      <Field label={t.projects.deadline}>
        <DateTimeField value={deadline} withTime={false} onChange={setDeadline} />
      </Field>

      <Button label={t.common.save} onPress={() => void save()} disabled={!name.trim()} />

      {project ? (
        <Row>
          <Button
            variant="secondary"
            label={project.status === 'archived' ? t.projects.unarchive : t.projects.archive}
            onPress={() => void updateProject(db, project.id, { status: project.status === 'archived' ? 'active' : 'archived' }).then(goBack)}
          />
          <Button variant="danger" icon="trash" label={t.common.delete} onPress={() => void remove()} />
        </Row>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  desc: { minHeight: 80 },
});
