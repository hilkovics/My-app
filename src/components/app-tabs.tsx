import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { t } from '@/i18n/sk';

import { TAB_ICONS } from './icon';

export const TABS = [
  { name: 'index', label: t.tabs.today, icon: TAB_ICONS.today },
  { name: 'calendar', label: t.tabs.calendar, icon: TAB_ICONS.calendar },
  { name: 'tasks', label: t.tabs.tasks, icon: TAB_ICONS.task },
  { name: 'notes', label: t.tabs.notes, icon: TAB_ICONS.note },
  { name: 'focus', label: t.tabs.focus, icon: TAB_ICONS.timer },
] as const;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ selected: { color: colors.text } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.icon.ios} md={tab.icon.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
