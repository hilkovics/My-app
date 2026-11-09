import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, Spacing } from '@/constants/theme';
import type { PlanEntry } from '@/features/plan/layout';
import { fmtMinutes } from '@/features/focus/stats';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';
import { fmtTime } from '@/lib/dates';

import { ThemedText } from '../themed-text';
import { ENERGY_ICON, ENERGY_LABEL, entryStyle } from './energy-style';

/**
 * One block of the day. Its height comes from `dimensions` and is strictly proportional to the
 * duration; entries up to 15 minutes are thin strips without padding. Text is only drawn where it fits.
 */
export function PlanCard({
  entry,
  selected,
  dimmed,
  focused,
  countdown,
  onPress,
}: {
  entry: PlanEntry;
  selected?: boolean;
  /** Focus mode: everything but the active card is dimmed. */
  dimmed?: boolean;
  focused?: boolean;
  /** Remaining time of the running timer (focus mode). */
  countdown?: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const st = entryStyle(entry, theme);
  const h = entry.dimensions.height;
  const compact = entry.dimensions.compact;
  const showTitle = h >= 18;
  const showMeta = h >= 42;
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
        { height: h },
        compact ? styles.compact : styles.padded,
        selected && { borderColor: theme.text, borderWidth: Math.max(2, entry.visual_intensity.border_width) },
        focused && { shadowColor: theme.accent, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8, borderColor: theme.accent },
        dimmed && { opacity: 0.12 },
      ]}>
      {showTitle ? (
        <View style={styles.row}>
          <ThemedText type="small" numberOfLines={1} style={[styles.title, { color: st.text }, compact && styles.compactText, entry.done && styles.done]}>
            {icon ? `${icon} ` : ''}
            {entry.overflow ? '⚠ ' : ''}
            {entry.title || t.common.untitled}
          </ThemedText>
          {focused && countdown ? (
            <ThemedText type="smallBold" style={{ color: st.text }}>
              {countdown}
            </ThemedText>
          ) : compact ? (
            <ThemedText type="small" style={[styles.compactText, { color: st.muted }]}>
              {fmtMinutes(entry.durationMin)}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {showMeta ? (
        <ThemedText type="small" numberOfLines={1} style={{ color: st.muted }}>
          {meta.join(' · ')}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 6, overflow: 'hidden', justifyContent: 'center' },
  padded: { paddingHorizontal: Spacing.two, paddingVertical: 2 },
  compact: { paddingHorizontal: 6, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, fontFamily: FontFamily[700] },
  compactText: { fontSize: 11, lineHeight: 14 },
  done: { textDecorationLine: 'line-through' },
});
