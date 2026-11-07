import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Item } from '@/db/types';
import { useDb } from '@/db/hooks';
import { toggleTaskDone } from '@/features/items/repository';
import type { Occurrence } from '@/features/calendar/agenda';
import { editOccurrence, openOccurrence } from '@/features/calendar/open';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtDateTime, fmtTime, startOfDay } from '@/lib/dates';

import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { Checkbox } from './ui';

const PRIORITY_MARK = ['', '!', '!!', '!!!'];

export function ItemRow({
  item,
  now: nowProp,
  progress,
}: {
  item: Item;
  now?: number;
  progress?: { done: number; total: number };
}) {
  const db = useDb();
  const theme = useTheme();
  const clock = useNow();
  const now = nowProp ?? clock;
  const isTask = item.type === 'task';
  const done = item.completedAt != null;
  const when = item.startAt ?? item.dueAt;
  // Date-only due dates are overdue only after that day ends.
  const overdue =
    isTask && !done && item.dueAt != null && (isDateOnly(item) ? item.dueAt < startOfDay(now) : item.dueAt < now);
  const meta: string[] = [];
  if (when != null && item.type !== 'note') meta.push(fmtDateTime(when, item.allDay || isDateOnly(item), now));
  if (item.type === 'note' && item.eventStart != null) meta.push(`📅 ${fmtDateTime(item.eventStart, false, now)}`);
  if (item.type === 'note' && item.body) meta.push(item.body.replace(/\s+/g, ' ').slice(0, 90));
  if (progress?.total) meta.push(`☑ ${progress.done}/${progress.total}`);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && { opacity: 0.6 }]}>
      {isTask ? (
        <Checkbox
          checked={done}
          color={item.color}
          label={item.title}
          onPress={() => void toggleTaskDone(db, item.id)}
        />
      ) : (
        <View style={[styles.dot, { backgroundColor: item.color ?? (item.type === 'event' ? theme.accent : theme.textSecondary) }]} />
      )}
      <View style={styles.flex}>
        <ThemedText
          numberOfLines={1}
          style={done ? { textDecorationLine: 'line-through', color: theme.textSecondary } : undefined}>
          {PRIORITY_MARK[item.priority] ? (
            <ThemedText style={{ color: theme.danger, fontWeight: 700 }}>{PRIORITY_MARK[item.priority]} </ThemedText>
          ) : null}
          {item.title || t.common.untitled}
        </ThemedText>
        {meta.length || item.tags.length ? (
          <ThemedText type="small" numberOfLines={1} style={{ color: overdue ? theme.danger : theme.textSecondary }}>
            {[...meta, ...item.tags.map((x) => `#${x}`)].join(' · ')}
          </ThemedText>
        ) : null}
      </View>
      {item.rrule ? <Icon name="repeat" size={14} color={theme.textSecondary} /> : null}
      {item.pinned ? <Icon name="pin" size={14} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

function isDateOnly(item: Item): boolean {
  const t0 = item.startAt ?? item.dueAt;
  if (t0 == null) return false;
  const d = new Date(t0);
  return item.startAt == null && d.getHours() === 0 && d.getMinutes() === 0;
}

/** Row for a calendar occurrence (local or from the phone calendar). */
export function OccurrenceRow({ occ, onPress }: { occ: Occurrence; onPress?: () => void }) {
  // Tap opens the event's notes, long press edits the event.
  const theme = useTheme();
  const time = occ.allDay ? t.common.allDay : occ.kind === 'due' ? fmtTime(occ.start) : `${fmtTime(occ.start)}–${fmtTime(occ.end)}`;
  const kindLabel =
    occ.kind === 'external' ? (occ.calendarTitle ?? 'Telefón') : occ.kind === 'event' ? '' : occ.kind === 'block' ? t.types.task : t.item.due;
  return (
    <Pressable
      onPress={onPress ?? (() => openOccurrence(occ))}
      onLongPress={() => editOccurrence(occ)}
      style={({ pressed }) => [styles.occ, pressed && { opacity: 0.6 }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
        {time}
      </ThemedText>
      <View style={[styles.bar, { backgroundColor: occ.color ?? theme.accent }]} />
      <View style={styles.flex}>
        <ThemedText
          numberOfLines={1}
          style={occ.done ? { textDecorationLine: 'line-through', color: theme.textSecondary } : undefined}>
          {occ.title || t.common.untitled}
        </ThemedText>
        {kindLabel || occ.location ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[kindLabel, occ.location].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
      </View>
      {occ.hasNote ? <Icon name="note" size={14} color={theme.accent} /> : null}
      {occ.recurring ? <Icon name="repeat" size={14} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 6 },
  occ: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 8 },
  time: { width: 92, fontVariant: ['tabular-nums'] },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
