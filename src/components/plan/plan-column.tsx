import { StyleSheet, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
import type { DayPlan } from '@/features/plan/layout';
import { useTheme } from '@/hooks/use-theme';
import { MINUTE } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { PlanCard } from './plan-card';

/** "KAPACITA 8 H" / "KAPACITA 7,5 H" */
export function capacityLabel(capacityMinutes: number): string {
  const h = Math.round((capacityMinutes / 60) * 10) / 10;
  return `KAPACITA ${String(h).replace('.', ',')} H`;
}

/**
 * The day as a column of cards stacked in order, each as tall as its duration (80 px/h − 3 px gap).
 * The dashed danger rule marks where the day's capacity ends: blocks beyond it spill over and get
 * a danger border. `now` is set for today so that finished blocks are dimmed.
 */
export function PlanColumn({
  plan,
  selectedKey,
  focusKey,
  countdown,
  now,
  onSelect,
}: {
  plan: DayPlan;
  selectedKey: string | null;
  focusKey: string | null;
  countdown: string | null;
  now: number | null;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  const total = Math.max(plan.content_height_px, plan.capacity_line_px);
  return (
    <View style={{ height: total + 8 }}>
      {plan.entries.map((e) => (
        <View key={e.key} style={{ position: 'absolute', left: 0, right: 0, top: e.dimensions.top }}>
          <PlanCard
            entry={e}
            selected={selectedKey === e.key}
            dimmed={focusKey != null && focusKey !== e.key}
            focused={focusKey === e.key}
            past={now != null && e.start != null && e.start + e.durationMin * MINUTE <= now}
            countdown={focusKey === e.key ? countdown : null}
            onPress={() => onSelect(e.key)}
          />
        </View>
      ))}
      <View pointerEvents="none" style={[styles.line, { top: plan.capacity_line_px, borderColor: theme.danger }]}>
        <ThemedText type="axis" style={[styles.lineLabel, { color: theme.text2, backgroundColor: theme.bg, fontFamily: FontFamily[800] }]}>
          {capacityLabel(plan.capacityMinutes)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', left: 0, right: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  lineLabel: { position: 'absolute', right: 0, top: -9, paddingHorizontal: 6 },
});
