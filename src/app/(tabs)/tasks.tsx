import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { ThemedText } from '@/components/themed-text';
import { KanbanBoard } from '@/components/kanban-board';
import { useGuardedCreate } from '@/components/plan/capacity-guard';
import { ProjectsPanel } from '@/components/projects/projects-panel';
import { Chip, Empty, IconButton, Input, Screen, Segmented } from '@/components/ui';
import { useLiveQuery, useNow } from '@/db/hooks';
import { checklistProgress, listTasks, type TaskView } from '@/features/items/repository';
import { listProjects } from '@/features/projects/repository';
import { parseQuickAdd, toItemInput } from '@/features/quickadd/parse';
import { t } from '@/i18n/sk';
import { describeRule } from '@/lib/recurrence';
import { fmtDateTime } from '@/lib/dates';

function TaskList() {
  const { create, dialog } = useGuardedCreate();
  const now = useNow();
  const [view, setView] = useState<TaskView>('today');
  const [text, setText] = useState('');
  const tasks = useLiveQuery((d) => listTasks(d, view, now), [view, Math.floor(now / 3_600_000)]) ?? [];
  const progress = useLiveQuery((d) => checklistProgress(d), []);

  const parsed = text.trim() ? parseQuickAdd(text) : null;
  const preview = parsed
    ? [
        parsed.day != null ? fmtDateTime(parsed.day + (parsed.minutes ?? 0) * 60_000, parsed.minutes == null) : null,
        parsed.rule ? describeRule(parsed.rule) : null,
        parsed.priority ? `priorita ${parsed.priority}` : null,
        ...parsed.tags.map((x) => `#${x}`),
        parsed.alerts.length ? '🔔' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const add = async () => {
    if (!parsed?.title) return;
    await create(toItemInput(parsed, 'task'), { alerts: parsed.alerts, onCreated: () => setText('') });
  };

  return (
    <>
      <View style={{ gap: 6 }}>
        <Input
          value={text}
          onChangeText={setText}
          placeholder={t.tasks.quickAdd}
          returnKeyType="done"
          onSubmitEditing={() => void add()}
          submitBehavior="submit"
        />
        {preview ? (
          <ThemedText type="small" themeColor="textSecondary">
            {preview}
          </ThemedText>
        ) : null}
      </View>
      <Segmented<TaskView>
        value={view}
        onChange={setView}
        options={[
          { value: 'inbox', label: t.tasks.inbox },
          { value: 'today', label: t.tasks.today },
          { value: 'upcoming', label: t.tasks.upcoming },
          { value: 'done', label: t.tasks.done },
        ]}
      />
      <View>
        {tasks.length ? (
          tasks.map((it) => <ItemRow key={it.id} item={it} now={now} progress={progress?.get(it.id)} />)
        ) : (
          <Empty text={t.tasks.empty} />
        )}
      </View>
      {dialog}
    </>
  );
}

type TasksView = 'list' | 'board' | 'projects';

export default function TasksScreen() {
  const [view, setView] = useState<TasksView>('list');
  const [projectId, setProjectId] = useState<string | null>(null);
  const projects = useLiveQuery((d) => listProjects(d, 'active'), []) ?? [];

  return (
    <Screen
      title={t.tabs.tasks}
      actions={
        <>
          <IconButton name="search" label={t.common.search} onPress={() => router.push('/search')} />
          <IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />
        </>
      }>
      <Segmented<TasksView>
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: t.taskViews.list },
          { value: 'board', label: t.taskViews.board },
          { value: 'projects', label: t.taskViews.projects },
        ]}
      />
      {view === 'list' ? <TaskList /> : null}
      {view === 'board' ? (
        <>
          {projects.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
              <Chip label={t.board.allProjects} selected={projectId == null} onPress={() => setProjectId(null)} />
              {projects.map((p) => (
                <Chip key={p.id} label={`${p.icon} ${p.name}`} selected={projectId === p.id} onPress={() => setProjectId(projectId === p.id ? null : p.id)} />
              ))}
            </ScrollView>
          ) : null}
          <KanbanBoard projectId={projectId} />
        </>
      ) : null}
      {view === 'projects' ? <ProjectsPanel /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipScroll: { flexGrow: 0 },
  chips: { gap: 8, alignItems: 'center' },
});
