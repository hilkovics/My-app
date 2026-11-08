import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Field, Input, Row } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import {
  addManualLog,
  deleteLog,
  getActivity,
  getLog,
  logDuration,
  updateLog,
  type Activity,
  type ActivityLog,
} from '@/features/activities/repository';
import { fmtPace } from '@/features/activities/stats';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { confirm } from '@/lib/confirm';
import { MINUTE, roundUpMinutes } from '@/lib/dates';
import { goBack } from '@/lib/nav';

/** New manual entry (?activityId=) or edit / finish an existing one (?id=, &finish=1 after Stop). */
export default function ActivityLogScreen() {
  const p = useLocalSearchParams<{ id?: string; activityId?: string; finish?: string }>();
  const theme = useTheme();
  const data = useLiveQuery(
    async (d) => {
      const log = p.id ? await getLog(d, p.id) : null;
      const activity = await getActivity(d, log?.activityId ?? p.activityId ?? '');
      return { log, activity };
    },
    [p.id ?? null, p.activityId ?? null],
  );
  if (!data) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  if (!data.activity) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  return <LogForm key={data.log?.id ?? 'new'} activity={data.activity} log={data.log} finishing={p.finish === '1'} />;
}

function parseNumber(s: string): number | null {
  const n = Number(s.replace(',', '.').trim());
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

function LogForm({ activity: a, log, finishing }: { activity: Activity; log: ActivityLog | null; finishing: boolean }) {
  const db = useDb();
  const theme = useTheme();
  const [startedAt, setStartedAt] = useState<number>(() => log?.startedAt ?? roundUpMinutes(Date.now() - 60 * MINUTE, 15));
  const [minutes, setMinutes] = useState(() => (log ? String(Math.round(logDuration(log) / MINUTE)) : '30'));
  const [km, setKm] = useState(() => (log?.distanceM ? String(log.distanceM / 1000).replace('.', ',') : ''));
  const [rating, setRating] = useState<number | null>(log?.rating ?? null);
  const [note, setNote] = useState(log?.note ?? '');

  const min = parseNumber(minutes);
  const dist = parseNumber(km);
  const pace = min && dist ? fmtPace(min * MINUTE, dist * 1000) : null;
  const running = log != null && log.endedAt == null;

  const save = async () => {
    if (min == null) return;
    const distanceKm = a.trackDistance ? dist : null;
    if (log) {
      await updateLog(db, log.id, {
        startedAt,
        // Keep timer-measured durations untouched unless the user changed the minutes.
        minutes: Math.round(logDuration(log) / MINUTE) === min ? undefined : min,
        distanceKm,
        rating,
        note: note.trim(),
      });
    } else {
      await addManualLog(db, { activityId: a.id, startedAt, minutes: min, distanceKm, rating, note: note.trim() });
    }
    goBack();
  };

  const remove = async () => {
    if (log && (await confirm(t.activities.deleteLog, undefined, t.common.delete))) {
      await deleteLog(db, log.id);
      goBack();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: `${a.icon} ${finishing ? t.activities.finish : t.activities.log}` }} />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle" style={styles.title}>
          {a.icon} {a.name}
        </ThemedText>
        <Field label={t.activities.date}>
          <DateTimeField value={startedAt} allowClear={false} onChange={(v) => v != null && setStartedAt(v)} />
        </Field>
        {!running ? (
          <Field label={t.activities.minutes}>
            <Input value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="30" />
          </Field>
        ) : null}
        {a.trackDistance ? (
          <Field label={t.activities.distance}>
            <Input value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="5,2" autoFocus={finishing} />
            {pace ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t.activities.pace}: {pace}
              </ThemedText>
            ) : null}
          </Field>
        ) : null}
        {a.trackRating ? (
          <Field label={t.activities.rating}>
            <Row>
              {[1, 2, 3, 4, 5].map((r) => (
                <Chip key={r} label={'★'.repeat(r)} selected={rating === r} onPress={() => setRating(rating === r ? null : r)} />
              ))}
            </Row>
          </Field>
        ) : null}
        <Field label={t.activities.note}>
          <Input value={note} onChangeText={setNote} placeholder={t.activities.notePlaceholder} multiline style={styles.note} />
        </Field>
        <Button label={t.common.save} onPress={() => void save()} disabled={min == null} />
        {log && !running ? <Button variant="danger" icon="trash" label={t.common.delete} onPress={() => void remove()} /> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: 80, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 24, lineHeight: 30 },
  note: { minHeight: 100 },
});
