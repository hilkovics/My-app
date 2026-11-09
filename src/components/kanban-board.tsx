import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import type { Item, TaskStatus } from '@/db/types';
import { listBoardTasks, setTaskStatus } from '@/features/items/repository';
import { parseQuickAdd, toItemInput } from '@/features/quickadd/parse';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtDateTime, startOfDay } from '@/lib/dates';

import { useGuardedCreate } from './plan/capacity-guard';
import { STATUSES, StatusPicker } from './status-picker';
import { ThemedText } from './themed-text';
import { IconButton, Input } from './ui';

const PRIORITY_MARK = ['', '!', '!!', '!!!'];

/**
 * Kanban board: one column per task state. Cards move with ◀ ▶ (or a long press → state picker),
 * a tap opens the task. Optionally limited to one project.
 */
export function KanbanBoard({ projectId }: { projectId?: string | null }) {
  const db = useDb();
  const now = useNow();
  const board = useLiveQuery((d) => listBoardTasks(d, { projectId }, now), [projectId ?? null, Math.floor(now / 3_600_000)]);
  const [picking, setPicking] = useState<Item | null>(null);
  if (!board) return null;

  const move = async (item: Item, dir: -1 | 1) => {
    const current: TaskStatus = item.completedAt != null ? 'done' : (item.status ?? 'todo');
    const target = STATUSES[STATUSES.indexOf(current) + dir];
    if (!target) return;
    const updated = await setTaskStatus(db, item.id, target);
    // Moving into "waiting" without saying for whom: offer to fill it in.
    if (target === 'waiting' && !updated.waitingFor) setPicking(updated);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns} keyboardShouldPersistTaps="handled">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            items={board[status]}
            now={now}
            showProject={!projectId}
            projectId={projectId ?? null}
            onMove={move}
            onPick={setPicking}
          />
        ))}
      </ScrollView>
      <StatusPicker
        visible={picking != null}
        title={picking?.title ?? ''}
        status={picking ? (picking.completedAt != null ? 'done' : (picking.status ?? 'todo')) : 'todo'}
        waitingFor={picking?.waitingFor ?? null}
        onCancel={() => setPicking(null)}
        onSave={(status, who) => {
          if (picking) void setTaskStatus(db, picking.id, status, who);
          setPicking(null);
        }}
      />
    </>
  );
}

function Column({
  status,
  items,
  now,
  showProject,
  projectId,
  onMove,
  onPick,
}: {
  status: TaskStatus;
  items: Item[];
  now: number;
  showProject: boolean;
  projectId: string | null;
  onMove: (item: Item, dir: -1 | 1) => void;
  onPick: (item: Item) => void;
}) {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const { create, dialog } = useGuardedCreate();

  const add = async () => {
    const parsed = parseQuickAdd(text);
    if (!parsed.title) return;
    await create({ ...toItemInput(parsed, 'task'), projectId, status }, { alerts: parsed.alerts, onCreated: () => setText('') });
  };

  return (
    <View style={[styles.column, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.flex}>
          {t.status[status]} · {items.length}
        </ThemedText>
        {status !== 'done' ? (
          <IconButton name={adding ? 'close' : 'add'} size={18} label={t.board.addHere} onPress={() => setAdding(!adding)} />
        ) : null}
      </View>
      {adding ? (
        <Input
          value={text}
          onChangeText={setText}
          placeholder={t.board.addPlaceholder}
          autoFocus
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void add()}
        />
      ) : null}
      {items.length ? (
        items.map((item) => (
          <Card key={item.id} item={item} status={status} now={now} showProject={showProject} onMove={onMove} onPick={onPick} />
        ))
      ) : (
        <ThemedText type="small" themeColor="text2" style={styles.empty}>
          {t.board.emptyColumn}
        </ThemedText>
      )}
      {dialog}
    </View>
  );
}

function Card({
  item,
  status,
  now,
  showProject,
  onMove,
  onPick,
}: {
  item: Item;
  status: TaskStatus;
  now: number;
  showProject: boolean;
  onMove: (item: Item, dir: -1 | 1) => void;
  onPick: (item: Item) => void;
}) {
  const theme = useTheme();
  const index = STATUSES.indexOf(status);
  const when = item.dueAt ?? item.startAt;
  const dateOnly = when != null && startOfDay(when) === when;
  const overdue = status !== 'done' && item.dueAt != null && (startOfDay(item.dueAt) === item.dueAt ? item.dueAt < startOfDay(now) : item.dueAt < now);
  const meta = [
    when != null ? fmtDateTime(when, dateOnly, now) : null,
    status === 'waiting' && item.waitingFor ? `⏳ ${item.waitingFor}` : null,
    showProject ? item.projectName : null,
  ].filter(Boolean);
  return (
    <View
      role="group"
      accessibilityLabel={`${item.title || t.common.untitled}`}
      style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      {/* The tappable part is separate from the arrows (buttons must not nest). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${t.status[status]}`}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        onLongPress={() => onPick(item)}
        style={({ pressed }) => [styles.cardBody, pressed && { opacity: 0.7 }]}>
        <ThemedText numberOfLines={3} style={status === 'done' ? { textDecorationLine: 'line-through', color: theme.text2 } : undefined}>
          {PRIORITY_MARK[item.priority] ? <ThemedText style={{ color: theme.danger, fontFamily: FontFamily[800] }}>{PRIORITY_MARK[item.priority]} </ThemedText> : null}
          {item.title || t.common.untitled}
        </ThemedText>
        {meta.length ? (
          <ThemedText type="small" numberOfLines={2} style={{ color: overdue ? theme.danger : theme.text2 }}>
            {meta.join(' · ')}
          </ThemedText>
        ) : null}
      </Pressable>
      <View style={styles.arrows}>
        <IconButton name="chevronLeft" size={18} label={t.board.moveLeft} color={index === 0 ? theme.border : theme.text} onPress={() => index > 0 && onMove(item, -1)} />
        <IconButton name="chevronRight" size={18} label={t.board.moveRight} color={index === STATUSES.length - 1 ? theme.border : theme.text} onPress={() => index < STATUSES.length - 1 && onMove(item, 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  columns: { gap: Spacing.two, paddingRight: Spacing.three, alignItems: 'flex-start' },
  column: { width: 272, borderRadius: Radius.card, padding: Spacing.two, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.one },
  empty: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.one },
  card: { borderRadius: Radius.buttonSquare, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.two + 2, gap: 4 },
  cardBody: { gap: 4 },
  arrows: { flexDirection: 'row', justifyContent: 'space-between' },
});
