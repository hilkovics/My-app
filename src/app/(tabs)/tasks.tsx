import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { KanbanBoard } from '@/components/kanban-board';
import { useGuardedCreate } from '@/components/plan/capacity-guard';
import { ProjectsPanel } from '@/components/projects/projects-panel';
import { QuickAddField } from '@/components/quick-add-field';
import { Chip, Empty, HeaderButtons, Screen, Segmented } from '@/components/ui';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { checklistProgress, deleteItem, listTasks, type TaskView } from '@/features/items/repository';
import { listProjects } from '@/features/projects/repository';
import { parseQuickAdd, toItemInput } from '@/features/quickadd/parse';
import { QUICK_ADD_HINT, landingView, quickPreview } from '@/features/quickadd/preview';
import { t } from '@/i18n/sk';
import { fmtRelDay } from '@/lib/dates';
import { toast } from '@/lib/toast-store';

function TaskList({ requested }: { requested: TaskView | undefined }) {
  const db = useDb();
  const { create, dialog } = useGuardedCreate();
  const now = useNow();
  const [view, setView] = useState<TaskView>(requested ?? 'today');
  // A link from another screen (Dnes › "Všetky") can ask for a filter; applied once per request.
  const [seen, setSeen] = useState(requested);
  if (requested !== seen) {
    setSeen(requested);
    if (requested) setView(requested);
  }
  const [text, setText] = useState('');
  const tasks = useLiveQuery((d) => listTasks(d, view, now), [view, Math.floor(now / 3_600_000)]) ?? [];
  const progress = useLiveQuery((d) => checklistProgress(d), []);

  const parsed = text.trim() ? parseQuickAdd(text) : null;
  const chips = parsed ? quickPreview(parsed, (day) => fmtRelDay(day, now)) : null;

  const add = async () => {
    if (!parsed?.title) return;
    const where = parsed.day != null ? fmtRelDay(parsed.day, now) : 'Inbox';
    await create(toItemInput(parsed, 'task'), {
      alerts: parsed.alerts,
      onCreated: (item) => {
        setText('');
        setView(landingView(parsed, now));
        toast(`Pridané: ${item.title} · ${where}`, { undo: () => void deleteItem(db, item.id) });
      },
    });
  };

  return (
    <>
      <QuickAddField value={text} onChangeText={setText} onSubmit={() => void add()} placeholder={t.tasks.quickAdd} chips={chips} hint={QUICK_ADD_HINT} />
      <Segmented<TaskView>
        value={view}
        onChange={setView}
        variant="filter"
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
  const params = useLocalSearchParams<{ view?: TaskView }>();
  const [view, setView] = useState<TasksView>('list');
  const [projectId, setProjectId] = useState<string | null>(null);
  const projects = useLiveQuery((d) => listProjects(d, 'active'), []) ?? [];

  return (
    <Screen title={t.tabs.tasks} actions={<HeaderButtons />}>
      <Segmented<TasksView>
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: t.taskViews.list },
          { value: 'board', label: t.taskViews.board },
          { value: 'projects', label: t.taskViews.projects },
        ]}
      />
      {view === 'list' ? <TaskList requested={params.view} /> : null}
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
