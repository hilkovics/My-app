// "Impulz" design tokens (from the design handoff `tokens.json`). Light = Indigo, dark = Nočné indigo.
// All colours, sizes and radii come from here; derived alpha colours are built in one place (buildTheme).
import '@/global.css';

import { Platform } from 'react-native';

import { hexA } from '@/lib/color';

export const Colors = {
  light: {
    bg: '#F6F6FD',
    surface: '#FFFFFF',
    surface2: '#E7E6FA',
    text: '#15142B',
    text2: '#5C5A78',
    border: '#E1E0F3',
    accent: '#4F46E5',
    accentPressed: '#3F37C9',
    onAccent: '#FFFFFF',
    mark: '#4F46E5',
    onMark: '#FFFFFF',
    ink: '#15142B',
    onInk: '#F6F6FD',
    track: '#E9E8F8',
    tabBg: '#FFFFFF',
    success: '#2E9E5B',
    warning: '#C9820A',
    danger: '#D93636',
    dangerText: '#B42323',
    toastAction: '#A9A3FF',
    scrim: 'rgba(0,0,0,0.35)',
  },
  dark: {
    bg: '#0C0B1A',
    surface: '#161527',
    surface2: '#221F38',
    text: '#F1F0FA',
    text2: '#A3A0C0',
    border: '#2A2742',
    accent: '#8B83FF',
    accentPressed: '#736AF0',
    onAccent: '#0E0C26',
    mark: '#8B83FF',
    onMark: '#0E0C26',
    ink: '#F1F0FA',
    onInk: '#0C0B1A',
    track: '#221F38',
    tabBg: '#110F21',
    success: '#4CC27E',
    warning: '#E8A93A',
    danger: '#F06262',
    dangerText: '#F58A8A',
    toastAction: '#4F46E5',
    scrim: 'rgba(0,0,0,0.55)',
  },
} as const;

export type ThemeMode = keyof typeof Colors;
export type BaseColors = (typeof Colors)[ThemeMode];

/** Opacities from the design tokens. */
export const Opacity = {
  past: 0.45,
  pastRing: 0.3,
  focusDim: 0.12,
  archived: 0.5,
  disabled: 0.6,
  iconDisabled: 0.35,
} as const;

/** The colours plus the derived alpha mixes ("derived" in tokens.json). Built once per mode. */
export function buildTheme(mode: ThemeMode) {
  const c = Colors[mode];
  return {
    ...c,
    mode,
    heroChip: hexA(c.onAccent, 0.14),
    inkTrack: hexA(c.onInk, 0.22),
    meterTrack: hexA(c.mark, 0.16),
    markSoft: hexA(c.mark, 0.12),
    successSoft: hexA(c.success, 0.16),
    warningSoft: hexA(c.warning, 0.16),
    dangerSoft: hexA(c.danger, 0.14),
    routineFill: hexA(c.mark, 0.16),
    routineFillRing: hexA(c.mark, 0.5),
    routineBorder: hexA(c.mark, 0.55),
    pauseFill: hexA(c.success, 0.18),
    pauseFillRing: hexA(c.success, 0.55),
    sleepArc: hexA(c.text2, 0.28),
  };
}

export type Theme = ReturnType<typeof buildTheme>;
export const Themes: Record<ThemeMode, Theme> = { light: buildTheme('light'), dark: buildTheme('dark') };

/** Keys usable as a text colour. */
export type ThemeColor = keyof BaseColors;

/** Item colours users can pick. */
export const ITEM_COLORS = ['#2F6FEB', '#2E9E5B', '#D93636', '#C9820A', '#8B5CF6', '#0EA5A4', '#DB2777', '#6B7280'];

/**
 * Categorical palette for activities, projects, events and charts (validated for colour-vision
 * deficiency on adjacent pairs; order matters). Colour belongs to the entity, never to its rank.
 */
export const ACTIVITY_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
} as const;

/** Colour of the folded "Ostatné" series (the 9th item). */
export const OTHER_COLOR = { light: '#8a8f98', dark: '#6b7079' } as const;

/** Sequential indigo ramp for the year map, levels 1–4 (level 0 = surface2). */
export const HEAT_STEPS = {
  light: ['#C9C6F5', '#9690EE', '#5F55DE', '#3A2FB0'],
  dark: ['#2E2A78', '#4A42B8', '#7068EC', '#AEA8FF'],
} as const;

// ---------------------------------------------------------------- Type

/** Manrope faces by weight (loaded in the root layout). Never combine with `fontWeight`. */
export const FontFamily = {
  500: 'Manrope_500Medium',
  600: 'Manrope_600SemiBold',
  700: 'Manrope_700Bold',
  800: 'Manrope_800ExtraBold',
} as const;
export type FontWeight = keyof typeof FontFamily;

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  weight: FontWeight;
  letterSpacing?: number;
  uppercase?: boolean;
}

/** The type scale (tokens.json `font.scale`). */
export const Type = {
  timerHero: { fontSize: 96, lineHeight: 96, weight: 800, letterSpacing: -4 },
  numberHero: { fontSize: 60, lineHeight: 60, weight: 800, letterSpacing: -2 },
  ringCenter: { fontSize: 52, lineHeight: 52, weight: 800, letterSpacing: -2 },
  timerCard: { fontSize: 48, lineHeight: 56, weight: 800, letterSpacing: -1.5 },
  planTitle: { fontSize: 34, lineHeight: 40, weight: 800, letterSpacing: -1 },
  screenTitle: { fontSize: 32, lineHeight: 40, weight: 800, letterSpacing: -1 },
  heroHeadline: { fontSize: 30, lineHeight: 36, weight: 800, letterSpacing: -0.8 },
  cardTitleL: { fontSize: 22, lineHeight: 28, weight: 800 },
  statValue: { fontSize: 22, lineHeight: 28, weight: 800 },
  section: { fontSize: 20, lineHeight: 26, weight: 800, letterSpacing: -0.3 },
  cardTitle: { fontSize: 17, lineHeight: 22, weight: 800 },
  body: { fontSize: 16, lineHeight: 22, weight: 700 },
  button: { fontSize: 15, lineHeight: 20, weight: 800 },
  bodySmall: { fontSize: 14, lineHeight: 20, weight: 600 },
  meta: { fontSize: 13, lineHeight: 18, weight: 600 },
  label: { fontSize: 12, lineHeight: 16, weight: 800, letterSpacing: 1.2, uppercase: true },
  axis: { fontSize: 11, lineHeight: 14, weight: 700 },
  tabLabel: { fontSize: 10, lineHeight: 12, weight: 600 },
} as const satisfies Record<string, TypeStyle>;

export type TypeName = keyof typeof Type;

/** Times, durations and counters line up with tabular figures. */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

export const Fonts = Platform.select({
  ios: { mono: 'ui-monospace' },
  default: { mono: 'monospace' },
  web: { mono: 'var(--font-mono)' },
});

// ---------------------------------------------------------------- Layout

/** Spacing steps used by the design (`space` in tokens.json) plus the old named steps used across the code. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  pill: 999,
  heroBottom: 32,
  sheetTop: 28,
  ringCard: 28,
  cardL: 24,
  card: 20,
  fab: 20,
  taskRow: 18,
  toast: 18,
  boardCard: 16,
  input: 16,
  planBlock: 16,
  tile: 14,
  filterSeg: 14,
  buttonSquare: 12,
  calBlockDay: 10,
  heatCell: 3,
  barTop: 4,
} as const;

export const Layout = {
  screenPaddingX: 16,
  sectionGap: 22,
  cardPadding: 16,
  listRowMinHeight: 44,
  touchTargetMin: 44,
  contentMaxWidth: 800,
  tabBarHeight: 84,
  fabOffset: { right: 20, bottom: 16 },
  fabSize: 60,
} as const;

export const Shadow = {
  fab: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  toast: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  dialog: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 16 },
  raisedSegment: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
} as const;

export const Motion = { pressScale: 0.97, pressScaleRound: 0.94, toastDurationMs: 3800 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 72 }) ?? 0;
export const MaxContentWidth = Layout.contentMaxWidth;

/** Sizes of the visualisations (tokens.json `viz`). */
export const Viz = {
  ring: { degPerHour: 15, strokeLarge: 36, sizeLarge: 300, tickPad: 18, gapPx: 2, dayProgressStroke: 3, actualStroke: 4, overOutlineStroke: 3, focusGlowExtra: 14 },
  schedule: { pxPerHour: 80, gap: 3, showSecondLineFromPx: 42, thinBelowPx: 30 },
  calendarDay: { pxPerHour: 56, slotMinutes: 30, gutter: 52, lastHour: 22 },
  calendarWeek: { pxPerHour: 36, gutter: 34, lastHour: 20 },
  dayStrip: { from: 7, to: 23, height: 34 },
  barChart: { maxBarWidth: 24, topRadius: 4, height: 160 },
  heatmap: { weeks: 53, cell: 12, gap: 2, radius: 3 },
  stackedBars: { columns: 12, barWidth: 18, segmentGap: 2, height: 150 },
} as const;
