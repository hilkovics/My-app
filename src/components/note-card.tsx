import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ACTIVITY_COLORS, FontFamily, Radius } from '@/constants/theme';
import type { Item } from '@/db/types';
import { entityColor } from '@/features/plan/entity-color';
import { noteMeta, notePreview } from '@/features/items/note-meta';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtDateShort, fmtTime } from '@/lib/dates';

import { ThemedText } from './themed-text';

/** Note card: colour dot, title, ~90 character preview, meta line (tags, event, project, checklist), 📌 when pinned. */
export function NoteCard({ item, progress }: { item: Item; progress?: { done: number; total: number } }) {
  const theme = useTheme();
  const dot = entityColor(item.id, item.color, ACTIVITY_COLORS[theme.mode]);
  const preview = notePreview(item.body);
  const meta = noteMeta({
    tags: item.tags,
    event: item.eventStart != null ? `${fmtDateShort(item.eventStart)} ${fmtTime(item.eventStart)}` : null,
    project: item.projectName,
    checklist: progress,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title || t.common.untitled}${item.pinned ? ', pripnuté' : ''}`}
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={styles.body}>
        <ThemedText type="body" numberOfLines={2} style={{ fontFamily: FontFamily[800] }}>
          {item.title || t.common.untitled}
        </ThemedText>
        {preview ? (
          <ThemedText type="bodySmall" numberOfLines={2} themeColor="text2" style={{ fontFamily: FontFamily[500] }}>
            {preview}
          </ThemedText>
        ) : null}
        {meta ? (
          <ThemedText type="axis" numberOfLines={1} themeColor="text2" style={{ fontSize: 12, lineHeight: 16 }}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      {item.pinned ? <ThemedText accessibilityElementsHidden>📌</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: Radius.card, borderWidth: 1, marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 7 },
  body: { flex: 1, gap: 3 },
});
