import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, Section } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import { listSeriesNotes } from '@/features/items/event-notes';
import { createItem, linkExternal, listItemsForExternal } from '@/features/items/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtDateLong, fmtTime } from '@/lib/dates';

/** Read-only view of a phone-calendar event, with local notes attached to it. */
export default function ExternalEventScreen() {
  const p = useLocalSearchParams<{
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: string;
    calendarId: string;
    calendarTitle: string;
    location: string;
    notes: string;
  }>();
  const db = useDb();
  const theme = useTheme();
  const notes =
    useLiveQuery(async (d) => {
      const [series, linked] = await Promise.all([listSeriesNotes(d, 'device', p.id), listItemsForExternal(d, p.id)]);
      const seen = new Set(series.map((n) => n.id));
      return [...series, ...linked.filter((n) => !seen.has(n.id))];
    }, [p.id]) ?? [];
  const start = Number(p.start);
  const end = Number(p.end);
  const allDay = p.allDay === '1';

  // Notes for this occurrence open the same screen as tapping the event in the calendar.
  const openNotes = () =>
    router.push({
      pathname: '/event/notes',
      params: { ...p, source: 'device', eventId: p.id },
    });

  const addTask = async () => {
    const task = await createItem(db, { type: 'task', title: `${p.title}: `, dueAt: start });
    await linkExternal(db, task.id, p.calendarId || null, p.id);
    router.push({ pathname: '/item/[id]', params: { id: task.id } });
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Card>
        <ThemedText type="subtitle" style={styles.title}>
          {p.title}
        </ThemedText>
        <ThemedText>
          {fmtDateLong(start)}
          {allDay ? ` · ${t.common.allDay}` : ` · ${fmtTime(start)}–${fmtTime(end)}`}
        </ThemedText>
        {p.location ? <ThemedText themeColor="textSecondary">📍 {p.location}</ThemedText> : null}
        {p.calendarTitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            📱 {p.calendarTitle}
          </ThemedText>
        ) : null}
        {p.notes ? <ThemedText type="small">{p.notes}</ThemedText> : null}
      </Card>
      <Section title="Moje poznámky a úlohy">
        {notes.length ? notes.map((n) => <ItemRow key={n.id} item={n} />) : <Empty text="Zatiaľ nič." />}
      </Section>
      <Button icon="note" label="Poznámky k tomuto termínu" onPress={openNotes} />
      <Button variant="secondary" icon="task" label="Pridať úlohu k udalosti" onPress={() => void addTask()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 24, lineHeight: 30 },
});
