import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111214',
    background: '#ffffff',
    backgroundElement: '#F2F3F5',
    backgroundSelected: '#E3E5EA',
    textSecondary: '#60646C',
    border: '#DFE1E6',
    accent: '#2F6FEB',
    accentText: '#ffffff',
    danger: '#D93636',
    success: '#2E9E5B',
    warning: '#C9820A',
  },
  dark: {
    text: '#F4F5F7',
    background: '#0B0B0C',
    backgroundElement: '#1C1D20',
    backgroundSelected: '#2C2E33',
    textSecondary: '#A4A8B0',
    border: '#2E3035',
    accent: '#5B8DEF',
    accentText: '#ffffff',
    danger: '#F06262',
    success: '#4CC27E',
    warning: '#E8A93A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Item colours users can pick. */
export const ITEM_COLORS = ['#2F6FEB', '#2E9E5B', '#D93636', '#C9820A', '#8B5CF6', '#0EA5A4', '#DB2777', '#6B7280'];

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 6, md: 10, lg: 16 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 72 }) ?? 0;
export const MaxContentWidth = 800;
