import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { FontFamily, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';

const TABS: { name: string; href: '/' | '/calendar' | '/tasks' | '/notes' | '/progress'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: t.tabs.today, icon: 'today' },
  { name: 'calendar', href: '/calendar', label: t.tabs.calendar, icon: 'calendar' },
  { name: 'tasks', href: '/tasks', label: t.tabs.tasks, icon: 'task' },
  { name: 'notes', href: '/notes', label: t.tabs.notes, icon: 'note' },
  { name: 'progress', href: '/progress', label: t.tabs.progress, icon: 'chart' },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <BottomBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </BottomBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, icon, ref: _ref, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.mark : theme.text2;
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={24} color={color} filled={isFocused} />
      <ThemedText type="tabLabel" style={{ color, fontFamily: isFocused ? FontFamily[800] : FontFamily[600] }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

function BottomBar(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={[styles.bar, { backgroundColor: theme.tabBg, borderColor: theme.border }]}>
      <View style={styles.inner}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  inner: { flexDirection: 'row', width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.one },
});
