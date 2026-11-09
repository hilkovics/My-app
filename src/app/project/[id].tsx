import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { KanbanBoard } from '@/components/kanban-board';
import { useGuardedCreate } from '@/components/plan/capacity-guard';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, Empty, IconButton, Input, Meter, Row, Section, Segmented } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { checklistProgress, listProjectItems } from '@/features/items/repository';
import { getGoal, getProject, updateProject } from '@/features/projects/repository';
import { fmtCountdown, projectProgress } from '@/features/projects/stats';
import { parseQuickAdd, toItemInput } from '@/features/quickadd/parse';
import { applyTemplate, listTemplates, templateFromProject } from '@/features/templates/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { notify } from '@/lib/confirm';

type View_ = 'list' | 'board';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const theme = useTheme();
  const now = useNow();
  const [view, setView] = useState<View_>('list');
  const [text, setText] = useState('');
  const { create, dialog } = useGuardedCreate();
  const data = useLiveQuery(
    async (d) => {
      const project = await getProject(d, id);
      return {
        project,
        goal: project?.goalId ? await getGoal(d, project.goalId) : null,
        items: await listProjectItems(d, id),
        templates: [...(await listTemplates(d, 'task')), ...(await listTemplates(d, 'note'))],
      };
    },
    [id],
  );
  const progress = useLiveQuery((d) => checklistProgress(d), []);
  if (!data) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  const { project, goal, items, templates } = data;
  if (!project) {
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: theme.bg }]}>
        <Empty text={t.item.notFound} />
      </View>
    );
  }
  const prog = projectProgress(items, now);
  const finished = project.status !== 'active';

  const add = async () => {
    const parsed = parseQuickAdd(text);
    if (!parsed.title) return;
    await create({ ...toItemInput(parsed, 'task'), projectId: project.id }, { alerts: parsed.alerts, onCreated: () => setText('') });
  };

  const saveAsTemplate = async () => {
    await templateFromProject(db, project.id, items);
    notify(t.projects.templateSaved);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `${project.icon} ${project.name}`,
          headerRight: () => (
            <IconButton name="settings" label={t.projects.edit} onPress={() => router.push({ pathname: '/project/edit', params: { id: project.id } })} />
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Row style={styles.between}>
            <ThemedText type="smallBold">
              {prog.total ? `${prog.done}/${prog.total} ${t.projects.tasks} · ${prog.pct} %` : t.projects.emptyProgress}
            </ThemedText>
            {project.deadline != null ? (
              <ThemedText type="small" style={{ color: project.deadline < now && !finished && prog.pct < 100 ? theme.danger : theme.text2 }}>
                {t.projects.deadline.toLowerCase()} {fmtCountdown(project.deadline, now)}
              </ThemedText>
            ) : null}
          </Row>
          <Meter value={prog.pct / 100} label={`${prog.pct} %`} />
          {goal ? (
            <ThemedText type="small" themeColor="text2">
              {goal.icon} {goal.name}
            </ThemedText>
          ) : null}
          {project.description ? <ThemedText type="small">{project.description}</ThemedText> : null}
        </Card>

        {!finished ? (
          <Input
            value={text}
            onChangeText={setText}
            placeholder={t.projects.addTask}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => void add()}
          />
        ) : null}

        <Segmented<View_>
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: t.taskViews.list },
            { value: 'board', label: t.taskViews.board },
          ]}
        />

        {view === 'board' ? (
          <KanbanBoard projectId={project.id} />
        ) : items.length ? (
          <View>
            {items.map((it) => (
              <ItemRow key={it.id} item={it} now={now} progress={progress?.get(it.id)} hideProject />
            ))}
          </View>
        ) : (
          <Empty text={t.projects.noItems} />
        )}

        <Row>
          <Button
            small
            variant="secondary"
            icon="note"
            label={t.projects.newNote}
            onPress={() => router.push({ pathname: '/item/new', params: { type: 'note', projectId: project.id } })}
          />
          <Button small variant="secondary" label={t.projects.saveTemplate} onPress={() => void saveAsTemplate()} />
          <Button
            small
            variant="secondary"
            label={project.status === 'done' ? t.projects.reopen : t.projects.markDone}
            onPress={() => void updateProject(db, project.id, { status: project.status === 'done' ? 'active' : 'done' })}
          />
        </Row>

        {templates.length ? (
          <Section title={t.projects.addFromTemplate}>
            <Row>
              {templates.map((tpl) => (
                <Chip
                  key={tpl.id}
                  label={`${tpl.icon} ${tpl.name}`}
                  onPress={() =>
                    void applyTemplate(db, tpl, { projectId: project.id }).then(({ id: itemId }) =>
                      router.push({ pathname: '/item/[id]', params: { id: itemId } }),
                    )
                  }
                />
              ))}
            </Row>
          </Section>
        ) : null}
      </ScrollView>
      {dialog}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  between: { justifyContent: 'space-between' },
});
