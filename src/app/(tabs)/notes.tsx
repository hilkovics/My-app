import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { NoteCard } from '@/components/note-card';
import { Button, Chip, Empty, Fab, HeaderButtons, Screen } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { checklistProgress, getOrCreateJournal, listNotes, listTags } from '@/features/items/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { hexA } from '@/lib/color';

export default function NotesScreen() {
  const db = useDb();
  const theme = useTheme();
  const [tag, setTag] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const notes = useLiveQuery((d) => listNotes(d, { tag, text }), [tag, text]) ?? [];
  const tags = useLiveQuery((d) => listTags(d, 'note'), []) ?? [];
  const progress = useLiveQuery((d) => checklistProgress(d), []);
  const total = tags.length ? tags.reduce((a, x) => a + x.count, 0) : notes.length;

  const openJournal = async () => {
    const j = await getOrCreateJournal(db, Date.now());
    router.push({ pathname: '/item/[id]', params: { id: j.id } });
  };

  return (
    <Screen
      title={t.tabs.notes}
      actions={<HeaderButtons />}
      fab={<Fab label={t.common.add} onPress={() => router.push({ pathname: '/item/new', params: { type: 'note' } })} />}>
      <View style={styles.searchRow}>
        {/* minWidth: 0 lets the field shrink so the journal button never gets pushed out. */}
        <View
          style={[
            styles.search,
            { backgroundColor: theme.surface, borderColor: focused ? theme.mark : theme.border, borderWidth: focused ? 2 : 1 },
          ]}>
          <Icon name="search" size={20} color={theme.text2} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.notes.search}
            placeholderTextColor={hexA(theme.text2, 0.8)}
            accessibilityLabel={t.notes.search}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, { color: theme.text, fontFamily: FontFamily[600] }]}
          />
        </View>
        <View style={styles.journal}>
          <Button variant="ink" icon="book" label={t.notes.journalToday} onPress={() => void openJournal()} style={styles.journalButton} />
        </View>
      </View>
      {tags.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll} contentContainerStyle={styles.tags}>
          <Chip label={t.notes.all} count={total} selected={tag == null} onPress={() => setTag(null)} />
          {tags.map((x) => (
            <Chip key={x.name} label={`#${x.name}`} count={x.count} selected={tag === x.name} onPress={() => setTag(tag === x.name ? null : x.name)} />
          ))}
        </ScrollView>
      ) : null}
      <View>
        {notes.length ? notes.map((n) => <NoteCard key={n.id} item={n} progress={progress?.get(n.id)} />) : <Empty text={text.trim() || tag ? 'Nič sa nenašlo.' : t.notes.empty} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, minWidth: 0, height: 48, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  input: { flex: 1, minWidth: 0, fontSize: 15, height: 44, outlineStyle: 'none' as never },
  journal: { flexShrink: 0 },
  journalButton: { height: 48, paddingHorizontal: 16 },
  tagScroll: { flexGrow: 0 },
  tags: { gap: Spacing.two, alignItems: 'center' },
});
