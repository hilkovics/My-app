import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Opacity, Radius, Spacing } from '@/constants/theme';
import type { Item } from '@/db/types';
import { useDb } from '@/db/hooks';
import { toggleTaskDone } from '@/features/items/repository';
import { restoreSnapshot, snapshotOf } from '@/features/items/snapshot';
import type { Occurrence } from '@/features/calendar/agenda';
import { editOccurrence, openOccurrence } from '@/features/calendar/open';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtRelDay, fmtTime, startOfDay } from '@/lib/dates';
import { toast } from '@/lib/toast-store';

import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { Checkbox } from './ui';

const PRIORITY_MARK = ['', '!', '!!', '!!!'];

/** Meta line parts of a task row, in the design's order (overdue, date, status, tags, project, checklist, repeat). */
export function taskMeta(
  item: Item,
  now: number,
  opts: { progress?: { done: number; total: number }; hideProject?: boolean } = {},
): { parts: string[]; overdue: boolean } {
  const isTask = item.type === 'task';
  const done = item.completedAt != null;
  const when = item.startAt ?? item.dueAt;
  const dateOnly = isDateOnly(item);
  // Date-only due dates are overdue only after that day ends.
  const overdue = isTask && !done && item.dueAt != null && (dateOnly ? item.dueAt < startOfDay(now) : item.dueAt < now);
  const parts: string[] = [];
  if (overdue) parts.push('Po termíne');
  if (when != null && item.type !== 'note') {
    parts.push(fmtRelDay(when, now) + (item.allDay || dateOnly ? '' : ` ${fmtTime(when)}`));
  }
  if (isTask && !done && item.status === 'doing') parts.push(`▶ ${t.status.doing}`);
  if (isTask && !done && item.status === 'waiting') parts.push(`⏳ Čaká na: ${item.waitingFor ?? '…'}`);
  if (item.type === 'note' && item.eventStart != null) parts.push(`📅 ${fmtRelDay(item.eventStart, now)} ${fmtTime(item.eventStart)}`);
  if (item.type === 'note' && item.body) parts.push(item.body.replace(/\s+/g, ' ').slice(0, 90));
  item.tags.forEach((x) => parts.push(`#${x}`));
  if (item.projectName && !opts.hideProject) parts.push(item.projectName);
  if (opts.progress?.total) parts.push(`☑ ${opts.progress.done}/${opts.progress.total}`);
  if (item.rrule) parts.push('🔁');
  if (!parts.length && isTask) parts.push('Inbox');
  return { parts, overdue };
}

export function ItemRow({
  item,
  now: nowProp,
  progress,
  hideProject,
}: {
  item: Item;
  now?: number;
  progress?: { done: number; total: number };
  /** Inside a project's own list the project name would just repeat. */
  hideProject?: boolean;
}) {
  const db = useDb();
  const theme = useTheme();
  const clock = useNow();
  const now = nowProp ?? clock;
  const isTask = item.type === 'task';
  const done = item.completedAt != null;
  const { parts, overdue } = taskMeta(item, now, { progress, hideProject });

  // Completing says so and can be undone (a recurring task goes back to its previous date).
  const complete = async () => {
    const before = snapshotOf(item);
    await toggleTaskDone(db, item.id);
    if (!done) toast(`Hotovo: ${item.title || t.common.untitled}`, { undo: () => void restoreSnapshot(db, item.id, before) });
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: done ? Opacity.archived : 1 },
        pressed && { backgroundColor: theme.surface2 },
      ]}>
      {isTask ? (
        <Checkbox checked={done} color={item.color} label={item.title} onPress={() => void complete()} />
      ) : (
        <View style={[styles.dot, { backgroundColor: item.color ?? (item.type === 'event' ? theme.mark : theme.text2) }]} />
      )}
      <View style={styles.flex}>
        <ThemedText
          type="body"
          numberOfLines={2}
          style={done ? { textDecorationLine: 'line-through', color: theme.text2 } : undefined}>
          {PRIORITY_MARK[item.priority] ? (
            <ThemedText type="body" style={{ color: theme.dangerText, fontFamily: FontFamily[800] }}>{PRIORITY_MARK[item.priority]} </ThemedText>
          ) : null}
          {item.title || t.common.untitled}
        </ThemedText>
        {parts.length ? (
          <ThemedText type="meta" numberOfLines={1} style={{ color: overdue ? theme.dangerText : theme.text2 }}>
            {parts.join(' · ')}
          </ThemedText>
        ) : null}
      </View>
      {item.pinned ? <Icon name="pin" size={16} color={theme.text2} /> : null}
    </Pressable>
  );
}

function isDateOnly(item: Item): boolean {
  const t0 = item.startAt ?? item.dueAt;
  if (t0 == null) return false;
  const d = new Date(t0);
  return item.startAt == null && d.getHours() === 0 && d.getMinutes() === 0;
}

/**
 * Row for a calendar occurrence (local or from the phone calendar): 84 px time column, colour bar,
 * title + place. The running occurrence is highlighted, past ones are dimmed to 55 %.
 */
export function OccurrenceRow({ occ, onPress, now: nowProp }: { occ: Occurrence; onPress?: () => void; now?: number }) {
  // Tap opens the event's notes, long press edits the event.
  const theme = useTheme();
  const clock = useNow();
  const now = nowProp ?? clock;
  const time = occ.allDay ? t.common.allDay : occ.kind === 'due' ? fmtTime(occ.start) : `${fmtTime(occ.start)}–${fmtTime(occ.end)}`;
  const kindLabel =
    occ.kind === 'external' ? (occ.calendarTitle ?? 'Telefón') : occ.kind === 'event' ? '' : occ.kind === 'block' ? t.types.task : t.item.due;
  const running = !occ.allDay && occ.kind !== 'due' && occ.start <= now && now < occ.end;
  const past = !occ.allDay && !running && (occ.kind === 'due' ? occ.start < now : occ.end <= now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${time} ${occ.title || t.common.untitled}${running ? ', práve prebieha' : ''}`}
      onPress={onPress ?? (() => openOccurrence(occ))}
      onLongPress={() => editOccurrence(occ)}
      style={({ pressed }) => [
        styles.occ,
        running && { backgroundColor: theme.markSoft },
        pressed && { backgroundColor: theme.surface2 },
        past && { opacity: 0.55 },
      ]}>
      <ThemedText type="meta" themeColor="text2" tabular style={styles.time}>
        {time}
      </ThemedText>
      <View style={[styles.bar, { backgroundColor: occ.color ?? theme.mark }]} />
      <View style={styles.flex}>
        <ThemedText
          type="body"
          numberOfLines={1}
          style={occ.done ? { textDecorationLine: 'line-through', color: theme.text2 } : undefined}>
          {occ.title || t.common.untitled}
        </ThemedText>
        {kindLabel || occ.location ? (
          <ThemedText type="meta" themeColor="text2" numberOfLines={1}>
            {[kindLabel, occ.location].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
      </View>
      {occ.hasNote ? <Icon name="note" size={16} color={theme.mark} /> : null}
      {occ.recurring ? <Icon name="repeat" size={16} color={theme.text2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 64,
    paddingVertical: 8,
    paddingLeft: 4,
    paddingRight: 14,
    borderRadius: Radius.taskRow,
    borderWidth: 1,
    marginBottom: 8,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 20 },
  occ: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, paddingHorizontal: 8, borderRadius: Radius.tile, minHeight: 56 },
  time: { width: 84 },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
