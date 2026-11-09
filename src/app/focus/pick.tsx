import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Empty, Input, Section } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/db/hooks';
import type { Item } from '@/db/types';
import { setFocusDraft } from '@/features/focus/draft';
import { listTasks, listTimedItems, searchItems } from '@/features/items/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { addDays, fmtDateTime, startOfDay } from '@/lib/dates';
import { goBack } from '@/lib/nav';

/** Choose the task or event the next focus session is about. */
export default function PickFocusItemScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const suggestions = useLiveQuery(async (d) => {
    const day = startOfDay(Date.now());
    const [today, inbox, events] = await Promise.all([
      listTasks(d, 'today'),
      listTasks(d, 'inbox'),
      listTimedItems(d, day, addDays(day, 1)),
    ]);
    const seen = new Set<string>();
    return [...today, ...events.filter((e) => e.type === 'event'), ...inbox].filter((i) => !seen.has(i.id) && seen.add(i.id));
  }, []);
  const results = useLiveQuery((d) => searchItems(d, text, 50), [text]) ?? [];
  const list = text.trim() ? results : (suggestions ?? []);

  const pick = (item: Item) => {
    setFocusDraft({ itemId: item.id, itemTitle: item.title, tag: item.tags[0] ?? null });
    goBack();
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input value={text} onChangeText={setText} placeholder={t.search.placeholder} autoFocus />
      <Section title={text.trim() ? t.focus.results : t.focus.suggestions}>
        {list.length ? (
          list.map((i) => (
            <Pressable
              key={i.id}
              onPress={() => pick(i)}
              style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && { opacity: 0.6 }]}>
              <View>
                <ThemedText numberOfLines={1}>{i.title || t.common.untitled}</ThemedText>
                <ThemedText type="small" themeColor="text2" numberOfLines={1}>
                  {[
                    t.types[i.type],
                    (i.startAt ?? i.dueAt) != null ? fmtDateTime((i.startAt ?? i.dueAt)!) : null,
                    ...i.tags.map((x) => `#${x}`),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
            </Pressable>
          ))
        ) : (
          <Empty text={t.search.empty} />
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
