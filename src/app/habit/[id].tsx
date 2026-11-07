import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MonthGrid } from '@/components/month-grid';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Field, IconButton, Input, Row } from '@/components/ui';
import { ITEM_COLORS, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDb, useLiveQuery } from '@/db/hooks';
import type { Habit } from '@/db/types';
import {
  createHabit,
  deleteHabit,
  getHabit,
  getHabitLogs,
  logHabit,
  updateHabit,
} from '@/features/habits/repository';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { goBack } from '@/lib/nav';
import { confirm } from '@/lib/confirm';
import { WEEKDAYS_SHORT, addMonths, fmtMonthYear, monthGrid, startOfMonth, ymd } from '@/lib/dates';

const ICONS = ['✓', '💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✍️', '🎸', '🚭', '🧹'];

export default function HabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const isNew = id === 'new';
  const habit = useLiveQuery((d) => (isNew ? Promise.resolve(null) : getHabit(d, id)), [id]);
  if (!isNew && habit === undefined) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  return <HabitEditor key={habit?.id ?? 'new'} id={id} habit={habit ?? null} />;
}

function HabitEditor({ id, habit }: { id: string; habit: Habit | null }) {
  const isNew = habit == null;
  const db = useDb();
  const theme = useTheme();
  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? '✓');
  const [color, setColor] = useState(habit?.color ?? ITEM_COLORS[0]);
  const [days, setDays] = useState(habit?.days ?? '1111111');
  const [target, setTarget] = useState(habit?.targetPerDay ?? 1);
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));

  const grid = monthGrid(month);
  const logs = useLiveQuery(
    async (d) => (isNew ? undefined : (await getHabitLogs(d, ymd(grid[0]), ymd(grid[41]))).get(id)),
    [id, month],
  );

  const save = async () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), icon, color, days, targetPerDay: target };
    if (isNew) await createHabit(db, data);
    else await updateHabit(db, id, data);
    goBack();
  };

  const remove = async () => {
    if (await confirm(t.common.confirmDelete, habit?.name, t.common.delete)) {
      await deleteHabit(db, id);
      goBack();
    }
  };

  const dots = new Map<number, string[]>();
  for (const day of grid) if ((logs?.get(ymd(day)) ?? 0) >= target) dots.set(day, [color]);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Field label={t.habits.name}>
        <Input value={name} onChangeText={setName} placeholder="napr. Voda" big autoFocus={isNew} />
      </Field>
      <Field label={t.habits.icon}>
        <Row>
          {ICONS.map((i) => (
            <Chip key={i} label={i} selected={icon === i} onPress={() => setIcon(i)} />
          ))}
        </Row>
      </Field>
      <Field label={t.item.color}>
        <Row>
          {ITEM_COLORS.map((c) => (
            <Chip key={c} label={color === c ? '✓' : ' '} color={c} selected onPress={() => setColor(c)} />
          ))}
        </Row>
      </Field>
      <Field label={t.habits.days}>
        <Row>
          {WEEKDAYS_SHORT.map((d, i) => (
            <Chip
              key={d}
              label={d}
              selected={days[i] === '1'}
              onPress={() => setDays(days.slice(0, i) + (days[i] === '1' ? '0' : '1') + days.slice(i + 1))}
            />
          ))}
        </Row>
      </Field>
      <Field label={t.habits.target}>
        <Row>
          <Button small variant="secondary" label="−" onPress={() => setTarget(Math.max(1, target - 1))} />
          <ThemedText type="smallBold">{target}×</ThemedText>
          <Button small variant="secondary" label="+" onPress={() => setTarget(target + 1)} />
        </Row>
      </Field>

      <Button label={t.common.save} onPress={() => void save()} disabled={!name.trim()} />

      {habit ? (
        <>
          <View style={styles.monthNav}>
            <IconButton name="chevronLeft" label="Predchádzajúci mesiac" onPress={() => setMonth(addMonths(month, -1))} />
            <ThemedText type="smallBold">{fmtMonthYear(month)}</ThemedText>
            <IconButton name="chevronRight" label="Ďalší mesiac" onPress={() => setMonth(addMonths(month, 1))} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Ťuknutím na deň pridáš splnenie.
          </ThemedText>
          <MonthGrid month={month} selected={null} dots={dots} onSelect={(day) => void logHabit(db, id, ymd(day), 1)} />
          <Row>
            <Button
              variant="secondary"
              label={habit.archived ? t.habits.unarchive : t.habits.archive}
              onPress={() => void updateHabit(db, id, { archived: !habit.archived }).then(() => goBack())}
            />
            <Button variant="danger" icon="trash" label={t.common.delete} onPress={() => void remove()} />
          </Row>
        </>
      ) : null}
    </ScrollView>
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
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
