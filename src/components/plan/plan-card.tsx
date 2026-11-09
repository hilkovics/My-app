import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Radius, Viz } from '@/constants/theme';
import type { PlanEntry } from '@/features/plan/layout';
import { fmtMinutes } from '@/features/focus/stats';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtTime } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { ENERGY_ICON, ENERGY_LABEL, entryStyle } from './energy-style';

/**
 * One block of the day. Its height comes from `dimensions` (strictly proportional to the duration,
 * 80 px per hour) minus the 3 px gap; below 30 px it is a thin strip (12 px title, no padding), the
 * second line appears from 42 px. Past blocks of today are at 45 %.
 */
export function PlanCard({
  entry,
  selected,
  dimmed,
  focused,
  past,
  countdown,
  onPress,
}: {
  entry: PlanEntry;
  selected?: boolean;
  /** Focus mode: everything but the active card is dimmed. */
  dimmed?: boolean;
  focused?: boolean;
  /** Already over (today only). */
  past?: boolean;
  /** Remaining time of the running timer (focus mode). */
  countdown?: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const st = entryStyle(entry, theme);
  const h = Math.max(1, entry.dimensions.height - Viz.schedule.gap);
  const thin = h < Viz.schedule.thinBelowPx;
  const showMeta = h >= Viz.schedule.showSecondLineFromPx;
  const end = entry.start != null ? entry.start + entry.durationMin * 60_000 : null;
  const meta = [
    entry.start != null ? `${fmtTime(entry.start)}–${fmtTime(end!)}` : t.plan.noSpot,
    `${entry.guessed ? '~' : ''}${fmtMinutes(entry.durationMin)}`,
    entry.guessed ? t.plan.guessed : null,
    entry.tentative ? t.plan.tentative : null,
  ].filter(Boolean);
  const icon = ENERGY_ICON[entry.visual_intensity.energy];
  const label = `${entry.title}, ${meta.join(', ')}, ${ENERGY_LABEL[entry.energy]}${entry.overflow ? `, ${t.plan.over}` : ''}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={dimmed}
      style={[
        styles.card,
        st.box,
        { height: h, opacity: dimmed ? 0.12 : past ? 0.45 : 1 },
        thin ? styles.thin : styles.padded,
        selected && { borderColor: theme.text, borderWidth: 2 },
        focused && { borderColor: theme.accent, borderWidth: 2 },
      ]}>
      <View style={styles.row}>
        <ThemedText
          numberOfLines={1}
          style={[
            styles.title,
            { color: st.text },
            thin && styles.thinText,
            entry.done && styles.done,
          ]}>
          {entry.overflow ? '⚠ ' : ''}
          {icon ? `${icon} ` : ''}
          {entry.title || t.common.untitled}
        </ThemedText>
        {focused && countdown ? (
          <ThemedText type="bodySmall" tabular style={{ color: st.text, fontFamily: FontFamily[800] }}>
            {countdown}
          </ThemedText>
        ) : thin ? (
          <ThemedText type="axis" tabular style={[styles.thinText, { color: st.muted }]}>
            {fmtMinutes(entry.durationMin)}
          </ThemedText>
        ) : null}
      </View>
      {showMeta ? (
        <ThemedText type="meta" tabular numberOfLines={1} style={{ color: st.muted, opacity: 0.9 }}>
          {meta.join(' · ')}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.planBlock, overflow: 'hidden', justifyContent: 'center' },
  padded: { paddingHorizontal: 14, paddingVertical: 4 },
  thin: { paddingHorizontal: 10, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: FontFamily[800], fontSize: 15, lineHeight: 20 },
  thinText: { fontSize: 12, lineHeight: 15 },
  done: { textDecorationLine: 'line-through' },
});
