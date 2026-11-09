import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Button, HeaderButtons } from '@/components/ui';
import { FontFamily, Layout, Radius } from '@/constants/theme';
import { fmtMinutes, hm } from '@/features/focus/stats';
import { burnoutNote, heroCopy } from '@/features/plan/hero';
import type { DayPlan } from '@/features/plan/layout';
import { useTheme } from '@/hooks/use-theme';
import { fmtDatePill, fmtTime } from '@/lib/dates';

import { DayStrip } from './day-strip';

/**
 * Full-bleed accent zone of the Dnes tab: date pill + header icons, motivational headline by capacity,
 * the planned load as a big number, the day strip, a burnout chip (only with ≥ 3 deep blocks in a row)
 * and the button that opens Plán dňa.
 */
export function TodayHero({ plan, now }: { plan: DayPlan | null; now: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const copy = plan ? heroCopy(plan) : null;
  const note = plan ? burnoutNote(plan, fmtTime) : null;
  return (
    <View
      style={[
        styles.zone,
        { backgroundColor: theme.accent, paddingTop: insets.top + 8 },
      ]}>
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={[styles.pill, { backgroundColor: theme.heroChip }]}>
            <ThemedText type="label" style={{ color: theme.onAccent, letterSpacing: 0.6, fontSize: 13 }}>
              {fmtDatePill(now)}
            </ThemedText>
          </View>
          <View style={styles.icons}>
            <HeaderButtons onAccent />
          </View>
        </View>

        {copy ? (
          <ThemedText type="heroHeadline" style={{ color: theme.onAccent }} accessibilityRole="header">
            {copy.headline}
          </ThemedText>
        ) : null}

        {plan ? (
          <View style={styles.big}>
            <ThemedText type="numberHero" tabular style={{ color: theme.onAccent }} accessibilityLabel={fmtMinutes(plan.plannedMinutes)}>
              {hm(plan.plannedMinutes)}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.onAccent, opacity: 0.85, fontFamily: FontFamily[700] }}>
              z {fmtMinutes(plan.capacityMinutes)} naplánované
            </ThemedText>
          </View>
        ) : null}

        {plan ? <DayStrip entries={plan.entries} now={now} /> : null}

        {note ? (
          <View style={[styles.chip, { backgroundColor: theme.heroChip }]}>
            <Icon name="warning" size={20} color={theme.onAccent} filled />
            <ThemedText type="bodySmall" style={{ color: theme.onAccent, flex: 1, fontFamily: FontFamily[700] }}>
              {note}
            </ThemedText>
          </View>
        ) : null}

        <Button variant="onAccent" label="Otvoriť plán dňa →" onPress={() => router.push('/plan')} style={styles.open} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { borderBottomLeftRadius: Radius.heroBottom, borderBottomRightRadius: Radius.heroBottom, paddingBottom: 22, paddingHorizontal: Layout.screenPaddingX + 4 },
  inner: { width: '100%', maxWidth: Layout.contentMaxWidth, alignSelf: 'center', gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: -8 },
  pill: { height: 32, paddingHorizontal: 14, borderRadius: Radius.pill, justifyContent: 'center' },
  big: { gap: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.tile },
  open: { height: 48, alignSelf: 'stretch' },
});
