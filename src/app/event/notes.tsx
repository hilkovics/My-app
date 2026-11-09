import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Input, Row, Section } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import type { Item } from '@/db/types';
import {
  createEventNote,
  getEventNote,
  listSeriesNotes,
  type EventRef,
  type EventSource,
} from '@/features/items/event-notes';
import { getItem, updateItem } from '@/features/items/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtDateLong, fmtTime } from '@/lib/dates';

type Params = {
  source: EventSource;
  eventId: string;
  title: string;
  start: string;
  end: string;
  allDay: string;
  calendarId: string;
  calendarTitle: string;
  location: string;
  notes: string;
};

/** Notes for one occurrence of an event. Opened by tapping an event in the calendar. */
export default function EventNotesScreen() {
  const p = useLocalSearchParams<Params>();
  const theme = useTheme();
  const start = Number(p.start);
  const end = Number(p.end);
  const allDay = p.allDay === '1';
  // Local events: show the current title/location from the database (params may be stale).
  const local = useLiveQuery((d) => (p.source === 'local' ? getItem(d, p.eventId) : Promise.resolve(null)), [p.source, p.eventId]);
  const title = local?.title || p.title || t.common.untitled;
  const ref: EventRef = { source: p.source, eventId: p.eventId, occurrenceStart: start, title };
  const note = useLiveQuery((d) => getEventNote(d, ref), [p.source, p.eventId, start]);
  const series = useLiveQuery((d) => listSeriesNotes(d, p.source, p.eventId), [p.source, p.eventId]) ?? [];
  const others = series.filter((n) => n.eventStart !== start);

  const editEvent = () => {
    if (p.source === 'local') router.push({ pathname: '/item/[id]', params: { id: p.eventId } });
    else router.push({ pathname: '/external/[id]', params: { ...p, id: p.eventId } });
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Card>
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText>
          {fmtDateLong(start)}
          {allDay ? ` · ${t.common.allDay}` : ` · ${fmtTime(start)}–${fmtTime(end)}`}
        </ThemedText>
        {p.location ? <ThemedText themeColor="text2">📍 {p.location}</ThemedText> : null}
        {p.source === 'device' && p.calendarTitle ? (
          <ThemedText type="small" themeColor="text2">
            📱 {p.calendarTitle}
          </ThemedText>
        ) : null}
        <Row>
          <Button small variant="secondary" icon="calendar" label={t.eventNotes.editEvent} onPress={editEvent} />
        </Row>
      </Card>

      {note === undefined ? null : <NoteEditor key={`${p.source}:${p.eventId}@${start}`} initial={note} eventRef={ref} />}

      {others.length ? (
        <Section title={t.eventNotes.otherNotes}>
          <View>
            {others.map((n) => (
              <ItemRow key={n.id} item={n} />
            ))}
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}

/** Body editor; the note is created on the first typed text, then autosaved. */
function NoteEditor({ initial, eventRef }: { initial: Item | null; eventRef: EventRef }) {
  const db = useDb();
  const [body, setBody] = useState(initial?.body ?? '');
  const noteId = useRef<string | null>(initial?.id ?? null);
  const creating = useRef<Promise<string> | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(body);
  const refRef = useRef(eventRef);

  useEffect(() => {
    refRef.current = eventRef;
  });

  /** Returns the note id, creating the note if needed. */
  const ensureNote = async (text: string): Promise<string> => {
    if (noteId.current) return noteId.current;
    creating.current ??= createEventNote(db, refRef.current, text).then((n) => {
      noteId.current = n.id;
      return n.id;
    });
    return creating.current;
  };

  const save = async (text: string) => {
    if (!noteId.current && !text.trim()) return;
    const wasNew = !noteId.current && !creating.current;
    const id = await ensureNote(text);
    if (!wasNew) await updateItem(db, id, { body: text });
  };

  const flush = () => {
    if (!pending.current) return Promise.resolve();
    clearTimeout(pending.current);
    pending.current = null;
    return save(latest.current);
  };

  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (text: string) => {
    setBody(text);
    latest.current = text;
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      void save(text).catch((e) => console.warn('event note save', e));
    }, 500);
  };

  const openFull = async () => {
    await flush();
    const id = await ensureNote(latest.current);
    router.push({ pathname: '/item/[id]', params: { id } });
  };

  return (
    <View style={styles.editor}>
      <Input
        value={body}
        onChangeText={onChange}
        placeholder={t.eventNotes.placeholder}
        multiline
        autoFocus={!initial}
        style={styles.body}
      />
      <Row style={styles.between}>
        <ThemedText type="small" themeColor="text2">
          {initial || body.trim() ? t.eventNotes.autosave : t.eventNotes.hint}
        </ThemedText>
        <Button small variant="ghost" icon="note" label={t.eventNotes.more} onPress={() => void openFull()} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: 80,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: { fontSize: 24, lineHeight: 30 },
  editor: { gap: Spacing.two },
  body: { minHeight: 260 },
  between: { justifyContent: 'space-between' },
});
