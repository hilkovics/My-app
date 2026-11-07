import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { StatsPanel } from '@/components/focus/stats-panel';
import { TimerPanel } from '@/components/focus/timer-panel';
import { HabitsList } from '@/components/habits-list';
import { IconButton, Screen, Segmented } from '@/components/ui';
import { t } from '@/i18n/sk';

type Section = 'timer' | 'stats' | 'habits';

/** Focus tab: deep-work timer, its statistics, and habits (all about tracking progress). */
export default function FocusScreen() {
  const params = useLocalSearchParams<{ section?: Section }>();
  const [section, setSection] = useState<Section>(params.section ?? 'timer');

  return (
    <Screen
      title={t.tabs.focus}
      actions={<IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />}>
      <Segmented<Section>
        value={section}
        onChange={setSection}
        options={[
          { value: 'timer', label: t.focus.timer },
          { value: 'stats', label: t.focus.stats },
          { value: 'habits', label: t.tabs.habits },
        ]}
      />
      {section === 'timer' ? <TimerPanel /> : section === 'stats' ? <StatsPanel /> : <HabitsList />}
    </Screen>
  );
}
