import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { Empty, Input } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/db/hooks';
import { searchItems } from '@/features/items/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

export default function SearchScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const results = useLiveQuery((d) => searchItems(d, text), [text]) ?? [];
  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Input value={text} onChangeText={setText} placeholder={t.search.placeholder} autoFocus />
      {text.trim() && !results.length ? <Empty text={t.search.empty} /> : null}
      <View>
        {results.map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
