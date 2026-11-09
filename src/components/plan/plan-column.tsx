import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { DayPlan } from '@/features/plan/layout';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

import { ThemedText } from '../themed-text';
import { PlanCard } from './plan-card';

/**
 * The day as a column of cards stacked in order, each as tall as its duration. The red line marks
 * where the day's capacity ends: blocks beyond it spill over and get a warning border.
 */
export function PlanColumn({
  plan,
  selectedKey,
  focusKey,
  countdown,
  onSelect,
}: {
  plan: DayPlan;
  selectedKey: string | null;
  focusKey: string | null;
  countdown: string | null;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  const total = Math.max(plan.content_height_px, plan.capacity_line_px);
  return (
    <View style={[styles.column, { height: total + 8, borderColor: theme.border }]}>
      {plan.entries.map((e) => (
        <View key={e.key} style={{ position: 'absolute', left: 0, right: 0, top: e.dimensions.top }}>
          <PlanCard
            entry={e}
            selected={selectedKey === e.key}
            dimmed={focusKey != null && focusKey !== e.key}
            focused={focusKey === e.key}
            countdown={focusKey === e.key ? countdown : null}
            onPress={() => onSelect(e.key)}
          />
        </View>
      ))}
      <View pointerEvents="none" style={[styles.line, { top: plan.capacity_line_px, borderColor: theme.danger }]}>
        <ThemedText type="small" style={[styles.lineLabel, { color: theme.danger, backgroundColor: theme.background }]}>
          {t.plan.capacityLine}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'relative', borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 0, marginTop: Spacing.one },
  line: { position: 'absolute', left: 0, right: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  lineLabel: { position: 'absolute', right: 0, top: -9, fontSize: 11, lineHeight: 14, paddingHorizontal: 4 },
});
