import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/hooks/use-theme';

/** App icon names → SF Symbols (iOS) and Material Symbols (Android/web). */
const ICONS = {
  add: { ios: 'plus', md: 'add' },
  search: { ios: 'magnifyingglass', md: 'search' },
  settings: { ios: 'gearshape', md: 'settings' },
  check: { ios: 'checkmark', md: 'check' },
  close: { ios: 'xmark', md: 'close' },
  chevronLeft: { ios: 'chevron.left', md: 'chevron_left' },
  chevronRight: { ios: 'chevron.right', md: 'chevron_right' },
  calendar: { ios: 'calendar', md: 'calendar_month' },
  note: { ios: 'note.text', md: 'description' },
  task: { ios: 'checklist', md: 'checklist' },
  habit: { ios: 'flame', md: 'local_fire_department' },
  today: { ios: 'sun.max', md: 'today' },
  pin: { ios: 'pin.fill', md: 'push_pin' },
  repeat: { ios: 'repeat', md: 'repeat' },
  bell: { ios: 'bell', md: 'notifications' },
  link: { ios: 'link', md: 'link' },
  trash: { ios: 'trash', md: 'delete' },
  book: { ios: 'book', md: 'menu_book' },
  phone: { ios: 'iphone', md: 'smartphone' },
  play: { ios: 'play.fill', md: 'play_arrow' },
  pause: { ios: 'pause.fill', md: 'pause' },
  stop: { ios: 'stop.fill', md: 'stop' },
  timer: { ios: 'timer', md: 'timer' },
} as const satisfies Record<string, { ios: SFSymbol; md: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  const def = ICONS[name];
  return (
    <SymbolView
      name={{ ios: def.ios, android: def.md, web: def.md }}
      size={size}
      tintColor={color ?? theme.text}
    />
  );
}

export const TAB_ICONS = ICONS;
