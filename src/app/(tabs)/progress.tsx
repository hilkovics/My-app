import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivitiesPanel } from '@/components/activities/activities-panel';
import { StatsPanel } from '@/components/focus/stats-panel';
import { TimerBody, TimerHero, useTimerState } from '@/components/focus/timer-panel';
import { GoalsPanel } from '@/components/goals/goals-panel';
import { ThemedText } from '@/components/themed-text';
import { HeaderButtons, Screen, Segmented } from '@/components/ui';
import { Layout, Radius } from '@/constants/theme';
import { isHeroPhase } from '@/features/focus/phase';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

type Section = 'activities' | 'goals' | 'focus' | 'stats';

const OPTIONS: { value: Section; label: string }[] = [
  { value: 'activities', label: t.activities.section },
  { value: 'goals', label: t.goals.section },
  { value: 'focus', label: t.tabs.focus },
  { value: 'stats', label: t.focus.stats },
];

/**
 * Progress tab: activities (incl. former habits), goals, the deep-work timer and its statistics.
 * While the timer is active (running, paused, done, break) the header, the switch and the timer
 * sit together in an accent hero zone.
 */
export default function ProgressScreen() {
  const params = useLocalSearchParams<{ section?: Section }>();
  const [section, setSection] = useState<Section>(params.section ?? 'activities');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const timer = useTimerState(section === 'focus' ? 1000 : 30_000);
  const heroOn = section === 'focus' && isHeroPhase(timer.phase);

  const hero = heroOn ? (
    <View style={[styles.zone, { backgroundColor: theme.accent, paddingTop: insets.top + 8 }]}>
      <View style={styles.inner}>
        <View style={styles.titleRow}>
          <ThemedText type="screenTitle" style={{ color: theme.onAccent, flex: 1 }} numberOfLines={1} accessibilityRole="header">
            {t.tabs.progress}
          </ThemedText>
          <HeaderButtons onAccent />
        </View>
        <Segmented<Section> value={section} onChange={setSection} options={OPTIONS} hero />
        <TimerHero s={timer} />
      </View>
    </View>
  ) : undefined;

  return (
    <Screen title={t.tabs.progress} actions={<HeaderButtons />} hero={hero}>
      {!heroOn ? <Segmented<Section> value={section} onChange={setSection} options={OPTIONS} /> : null}
      {section === 'activities' ? <ActivitiesPanel /> : section === 'goals' ? <GoalsPanel /> : section === 'focus' ? <TimerBody s={timer} /> : <StatsPanel />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  zone: { borderBottomLeftRadius: Radius.heroBottom, borderBottomRightRadius: Radius.heroBottom, paddingBottom: 24, paddingHorizontal: Layout.screenPaddingX + 4 },
  inner: { width: '100%', maxWidth: Layout.contentMaxWidth, alignSelf: 'center', gap: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginRight: -8 },
});
