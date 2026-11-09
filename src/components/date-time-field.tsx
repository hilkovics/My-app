import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import {
  addDays,
  addMonths,
  fmtDateLong,
  fmtMonthYear,
  fmtTime,
  minutesOfDay,
  parseTime,
  startOfDay,
  startOfMonth,
  withTime,
} from '@/lib/dates';

import { MonthGrid } from './month-grid';
import { ThemedText } from './themed-text';
import { Button, Chip, IconButton, Input } from './ui';

/**
 * Cross-platform date (+ optional time) picker built from the month grid.
 * value null = no date. `withTime` false → date-only (midnight).
 */
export function DateTimeField({
  value,
  onChange,
  withTime: showTime = true,
  allowClear = true,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  withTime?: boolean;
  allowClear?: boolean;
  label?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(value ?? Date.now()));
  const [timeText, setTimeText] = useState(value != null && showTime ? fmtTime(value) : '');

  const text =
    value == null
      ? t.item.noDate
      : showTime && minutesOfDay(value) !== 0
        ? `${fmtDateLong(value)}, ${fmtTime(value)}`
        : fmtDateLong(value);

  const setDay = (day: number) => {
    const mins = value != null ? minutesOfDay(value) : (parseTime(timeText) ?? 0);
    onChange(showTime ? withTime(day, 0, mins) : startOfDay(day));
  };

  const applyTime = (s: string) => {
    setTimeText(s);
    const mins = parseTime(s);
    if (mins == null && s.trim()) return;
    const day = startOfDay(value ?? Date.now());
    onChange(withTime(day, 0, mins ?? 0));
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen((o) => !o)}
        style={[styles.value, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ThemedText themeColor={value == null ? 'text2' : 'text'}>{text}</ThemedText>
      </Pressable>
      {open ? (
        <View style={[styles.panel, { borderColor: theme.border }]}>
          <View style={styles.quick}>
            <Chip label="Dnes" onPress={() => setDay(startOfDay(Date.now()))} />
            <Chip label="Zajtra" onPress={() => setDay(addDays(startOfDay(Date.now()), 1))} />
            <Chip label="O týždeň" onPress={() => setDay(addDays(startOfDay(Date.now()), 7))} />
            {allowClear ? <Chip label="Bez dátumu" onPress={() => onChange(null)} /> : null}
          </View>
          <View style={styles.monthNav}>
            <IconButton name="chevronLeft" label="Predchádzajúci mesiac" onPress={() => setMonth(addMonths(month, -1))} />
            <ThemedText type="smallBold">{fmtMonthYear(month)}</ThemedText>
            <IconButton name="chevronRight" label="Ďalší mesiac" onPress={() => setMonth(addMonths(month, 1))} />
          </View>
          <MonthGrid month={month} selected={value} onSelect={setDay} compact />
          {showTime ? (
            <View style={styles.timeRow}>
              <ThemedText type="small" themeColor="text2">
                Čas
              </ThemedText>
              <Input
                value={timeText}
                onChangeText={applyTime}
                placeholder="napr. 14:30"
                keyboardType="numbers-and-punctuation"
                style={styles.timeInput}
              />
              {['8:00', '12:00', '18:00'].map((s) => (
                <Chip key={s} label={s} onPress={() => applyTime(s)} />
              ))}
            </View>
          ) : null}
          <Button label="Hotovo" small variant="secondary" onPress={() => setOpen(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  value: {
    borderRadius: Radius.buttonSquare,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.buttonSquare, padding: Spacing.two, gap: Spacing.two },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  timeInput: { width: 100, paddingVertical: 6 },
});
