import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Empty, Input } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { linkItems, searchItems } from '@/features/items/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { goBack } from '@/lib/nav';
import { fmtDateTime } from '@/lib/dates';

/** Pick another item to link with `from`. */
export default function LinkScreen() {
  const { from } = useLocalSearchParams<{ from: string }>();
  const db = useDb();
  const theme = useTheme();
  const [text, setText] = useState('');
  const results = (useLiveQuery((d) => searchItems(d, text, 50), [text]) ?? []).filter((i) => i.id !== from);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input value={text} onChangeText={setText} placeholder={t.search.placeholder} autoFocus />
      {text.trim() && !results.length ? <Empty text={t.search.empty} /> : null}
      {results.map((i) => (
        <Pressable
          key={i.id}
          onPress={() => void linkItems(db, from, i.id).then(() => goBack())}
          style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && { opacity: 0.6 }]}>
          <View style={styles.flex}>
            <ThemedText numberOfLines={1}>{i.title || t.common.untitled}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.types[i.type]}
              {i.startAt ?? i.dueAt ? ` · ${fmtDateTime((i.startAt ?? i.dueAt)!)}` : ''}
            </ThemedText>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
