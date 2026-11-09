import { NativeTabs } from 'expo-router/native-tabs';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

import { TAB_ICONS } from './icon';

export const TABS = [
  { name: 'index', label: t.tabs.today, icon: TAB_ICONS.today },
  { name: 'calendar', label: t.tabs.calendar, icon: TAB_ICONS.calendar },
  { name: 'tasks', label: t.tabs.tasks, icon: TAB_ICONS.task },
  { name: 'notes', label: t.tabs.notes, icon: TAB_ICONS.note },
  { name: 'progress', label: t.tabs.progress, icon: TAB_ICONS.chart },
] as const;

/** Native bottom tabs in the Impulz colours: selected = mark, others = text2, 10 px labels. */
export default function AppTabs() {
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.tabBg}
      indicatorColor={theme.markSoft}
      tintColor={theme.mark}
      shadowColor={theme.border}
      iconColor={{ default: theme.text2, selected: theme.mark }}
      labelStyle={{
        default: { color: theme.text2, fontFamily: FontFamily[600], fontSize: 10 },
        selected: { color: theme.mark, fontFamily: FontFamily[800], fontSize: 10 },
      }}>
      {TABS.map((tab) => {
        const filled = 'iosFilled' in tab.icon ? tab.icon.iosFilled : tab.icon.ios;
        return (
          <NativeTabs.Trigger key={tab.name} name={tab.name}>
            <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf={{ default: tab.icon.ios, selected: filled }} md={tab.icon.md} />
          </NativeTabs.Trigger>
        );
      })}
    </NativeTabs>
  );
}
