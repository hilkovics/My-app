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
  note: { ios: 'note.text', md: 'sticky_note_2' },
  task: { ios: 'checklist', md: 'checklist' },
  habit: { ios: 'flame', md: 'local_fire_department' },
  today: { ios: 'sun.max', md: 'wb_sunny', iosFilled: 'sun.max.fill' },
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
  arrowBack: { ios: 'arrow.left', md: 'arrow_back' },
  checkCircle: { ios: 'checkmark.circle.fill', md: 'check_circle' },
  info: { ios: 'info.circle.fill', md: 'info' },
  warning: { ios: 'exclamationmark.triangle.fill', md: 'warning' },
  error: { ios: 'exclamationmark.circle.fill', md: 'error' },
  celebration: { ios: 'sparkles', md: 'celebration' },
  addCircle: { ios: 'plus.circle', md: 'add_circle' },
  send: { ios: 'paperplane.fill', md: 'send' },
  expandMore: { ios: 'chevron.down', md: 'expand_more' },
  expandLess: { ios: 'chevron.up', md: 'expand_less' },
  edit: { ios: 'pencil', md: 'edit' },
  undo: { ios: 'arrow.uturn.backward', md: 'undo' },
  chart: { ios: 'chart.bar', md: 'bar_chart', iosFilled: 'chart.bar.fill' },
} as const satisfies Record<string, { ios: SFSymbol; md: AndroidSymbol; iosFilled?: SFSymbol }>;

export type IconName = keyof typeof ICONS;

/**
 * App icon. `filled` selects the filled SF Symbol where one is defined (iOS); Android and web use the
 * Material Symbol of the same name (the symbol font has no fill axis here).
 */
export function Icon({ name, size = 20, color, filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean }) {
  const theme = useTheme();
  const def = ICONS[name] as { ios: SFSymbol; md: AndroidSymbol; iosFilled?: SFSymbol };
  return (
    <SymbolView
      name={{ ios: filled && def.iosFilled ? def.iosFilled : def.ios, android: def.md, web: def.md }}
      size={size}
      tintColor={color ?? theme.text}
    />
  );
}

export const TAB_ICONS = ICONS;
