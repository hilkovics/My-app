import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { Button, Chip, Empty, Fab, IconButton, Input, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { checklistProgress, getOrCreateJournal, listNotes, listTags } from '@/features/items/repository';
import { t } from '@/i18n/sk';

export default function NotesScreen() {
  const db = useDb();
  const [tag, setTag] = useState<string | null>(null);
  const [text, setText] = useState('');
  const notes = useLiveQuery((d) => listNotes(d, { tag, text }), [tag, text]) ?? [];
  const tags = useLiveQuery((d) => listTags(d, 'note'), []) ?? [];
  const progress = useLiveQuery((d) => checklistProgress(d), []);

  const openJournal = async () => {
    const j = await getOrCreateJournal(db, Date.now());
    router.push({ pathname: '/item/[id]', params: { id: j.id } });
  };

  return (
    <Screen
      title={t.tabs.notes}
      actions={
        <>
          <IconButton name="search" label={t.common.search} onPress={() => router.push('/search')} />
          <IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />
        </>
      }
      fab={<Fab label={t.common.add} onPress={() => router.push({ pathname: '/item/new', params: { type: 'note' } })} />}>
      <Row>
        <View style={styles.flex}>
          <Input value={text} onChangeText={setText} placeholder={t.notes.search} />
        </View>
        <Button variant="secondary" icon="book" label={t.notes.journalToday} onPress={() => void openJournal()} />
      </Row>
      {tags.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll} contentContainerStyle={styles.tags}>
          <Chip label={t.notes.all} selected={tag == null} onPress={() => setTag(null)} />
          {tags.map((x) => (
            <Chip
              key={x.name}
              label={`#${x.name} ${x.count}`}
              selected={tag === x.name}
              onPress={() => setTag(tag === x.name ? null : x.name)}
            />
          ))}
        </ScrollView>
      ) : null}
      <View>
        {notes.length ? (
          notes.map((n) => <ItemRow key={n.id} item={n} progress={progress?.get(n.id)} />)
        ) : (
          <Empty text={t.notes.empty} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 160 },
  tagScroll: { flexGrow: 0 },
  tags: { gap: Spacing.two, alignItems: 'center' },
});
