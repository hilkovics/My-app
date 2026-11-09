import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { StatsPanel } from '@/components/focus/stats-panel';
import { TimerPanel } from '@/components/focus/timer-panel';
import { ActivitiesPanel } from '@/components/activities/activities-panel';
import { GoalsPanel } from '@/components/goals/goals-panel';
import { IconButton, Screen, Segmented } from '@/components/ui';
import { t } from '@/i18n/sk';

type Section = 'activities' | 'goals' | 'focus' | 'stats';

/** Progress tab: activities (incl. former habits), the deep-work timer and its statistics. */
export default function ProgressScreen() {
  const params = useLocalSearchParams<{ section?: Section }>();
  const [section, setSection] = useState<Section>(params.section ?? 'activities');

  return (
    <Screen
      title={t.tabs.progress}
      actions={<IconButton name="settings" label={t.common.settings} onPress={() => router.push('/settings')} />}>
      <Segmented<Section>
        value={section}
        onChange={setSection}
        options={[
          { value: 'activities', label: t.activities.section },
          { value: 'goals', label: t.goals.section },
          { value: 'focus', label: t.tabs.focus },
          { value: 'stats', label: t.focus.stats },
        ]}
      />
      {section === 'activities' ? <ActivitiesPanel /> : section === 'goals' ? <GoalsPanel /> : section === 'focus' ? <TimerPanel /> : <StatsPanel />}
    </Screen>
  );
}
