import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { ThemedText } from '@/components/themed-text';
import { Empty, IconButton, Input, Screen, Segmented } from '@/components/ui';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import { checklistProgress, createItem, listTasks, setAlerts, type TaskView } from '@/features/items/repository';
import { parseQuickAdd, toItemInput } from '@/features/quickadd/parse';
import { t } from '@/i18n/sk';
import { describeRule } from '@/lib/recurrence';
import { fmtDateTime } from '@/lib/dates';

export default function TasksScreen() {
  const db = useDb();
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
    const item = await createItem(db, toItemInput(parsed, 'task'));
    if (parsed.alerts.length) await setAlerts(db, item.id, parsed.alerts);
    setText('');
  };

  return (
    <Screen
      title={t.tabs.tasks}
      actions={
        <>
          <IconButton name="search" label={t.common.search} onPress={() => router.push('/search')} />
          <IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />
        </>
      }>
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
    </Screen>
  );
}
