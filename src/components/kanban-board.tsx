import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from './icon';

import { Opacity, Radius } from '@/constants/theme';
import { useDb, useLiveQuery, useNow } from '@/db/hooks';
import type { Item, TaskStatus } from '@/db/types';
import { listBoardTasks, setTaskStatus } from '@/features/items/repository';
import { parseQuickAdd, toItemInput } from '@/features/quickadd/parse';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtRelDay, fmtTime, startOfDay } from '@/lib/dates';

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns} keyboardShouldPersistTaps="handled" style={styles.scroll}>
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
      <ThemedText type="meta" themeColor="text2">
        Podrž kartu pre výber stavu · ◀ ▶ presúva medzi stĺpcami
      </ThemedText>
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
    <View style={[styles.column, { backgroundColor: theme.surface2 }]}>
      <View style={styles.header}>
        <ThemedText type="cardTitle" style={styles.flex} numberOfLines={1}>
          {t.status[status]} <ThemedText type="cardTitle" themeColor="text2" tabular>{items.length}</ThemedText>
        </ThemedText>
        {status !== 'done' ? <IconButton name={adding ? 'close' : 'add'} size={22} label={`${t.board.addHere}: ${t.status[status]}`} onPress={() => setAdding(!adding)} /> : null}
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
        <View style={[styles.empty, { borderColor: theme.text2 }]}>
          <ThemedText type="bodySmall" themeColor="text2">
            {t.board.emptyColumn}
          </ThemedText>
        </View>
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
    when != null ? `${fmtRelDay(when, now)}${dateOnly ? '' : ` ${fmtTime(when)}`}` : null,
    status === 'waiting' && item.waitingFor ? `⏳ ${item.waitingFor}` : null,
    showProject ? item.projectName : null,
  ].filter(Boolean);
  const first = index === 0;
  const last = index === STATUSES.length - 1;
  return (
    <View
      role="group"
      accessibilityLabel={`${item.title || t.common.untitled}`}
      style={[styles.card, { backgroundColor: theme.surface, opacity: status === 'done' ? 0.6 : 1 }]}>
      {/* The tappable part is separate from the arrows (buttons must not nest). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${t.status[status]}`}
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        onLongPress={() => onPick(item)}
        style={({ pressed }) => [styles.cardBody, pressed && { opacity: 0.7 }]}>
        <ThemedText type="cardTitle" numberOfLines={3} style={[styles.cardTitle, status === 'done' && { textDecorationLine: 'line-through', color: theme.text2 }]}>
          {PRIORITY_MARK[item.priority] ? <ThemedText type="cardTitle" style={[styles.cardTitle, { color: theme.dangerText }]}>{PRIORITY_MARK[item.priority]} </ThemedText> : null}
          {item.title || t.common.untitled}
        </ThemedText>
        {meta.length ? (
          <ThemedText type="meta" numberOfLines={2} style={{ color: overdue ? theme.dangerText : theme.text2, fontSize: 12, lineHeight: 17 }}>
            {meta.join(' · ')}
          </ThemedText>
        ) : null}
      </Pressable>
      <View style={styles.arrows}>
        <ArrowButton dir="left" disabled={first} label={t.board.moveLeft} onPress={() => onMove(item, -1)} />
        <ArrowButton dir="right" disabled={last} label={t.board.moveRight} onPress={() => onMove(item, 1)} />
      </View>
    </View>
  );
}

/** 44 × 44 square arrow (◀ ▶), disabled at 30 % in the first and last column. */
function ArrowButton({ dir, disabled, label, onPress }: { dir: 'left' | 'right'; disabled: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, { backgroundColor: theme.surface2, opacity: disabled ? 0.3 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <Icon name={dir === 'left' ? 'chevronLeft' : 'chevronRight'} size={22} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { marginHorizontal: -16 },
  columns: { gap: 12, paddingHorizontal: 16, alignItems: 'flex-start' },
  column: { width: 272, borderRadius: Radius.ringCard - 6, padding: 10, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6, minHeight: 44 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.boardCard, paddingVertical: 20, alignItems: 'center', opacity: Opacity.archived + 0.1 },
  card: { borderRadius: Radius.boardCard, padding: 12, gap: 8 },
  cardBody: { gap: 4 },
  cardTitle: { fontSize: 15, lineHeight: 20 },
  arrows: { flexDirection: 'row', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, borderRadius: Radius.buttonSquare, alignItems: 'center', justifyContent: 'center' },
});
