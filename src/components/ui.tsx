import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, FontFamily, Layout, Motion, Opacity, Radius, Shadow, Spacing, Type } from '@/constants/theme';
import { useStatusBarZone } from '@/hooks/use-status-bar';
import { useTheme } from '@/hooks/use-theme';
import { hexA, onColor } from '@/lib/color';

import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';

// ---------------------------------------------------------------- Screen

/**
 * Tab-root screen shell: safe area, 32/40 title with two round header buttons (or a full-bleed `hero`
 * zone instead of the title row), scrollable content with 16 px side padding, optional FAB.
 */
export function Screen({
  title,
  subtitle,
  actions,
  children,
  scroll = true,
  fab,
  tabBarInset = true,
  hero,
  gap = 18,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  fab?: ReactNode;
  tabBarInset?: boolean;
  /** Full-bleed zone rendered above the content (it must handle the top safe area itself). */
  hero?: ReactNode;
  gap?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  useStatusBarZone(hero ? 'accent' : 'bg');
  const bottom = (tabBarInset ? BottomTabInset : 0) + Spacing.five + 64;

  const titleRow =
    !hero && title ? (
      <View style={[styles.titleRow, { paddingTop: insets.top + Spacing.two }]}>
        <View style={styles.flex}>
          <ThemedText type="screenTitle" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="meta" themeColor="text2">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.row}>{actions}</View>
      </View>
    ) : null;

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <View style={styles.center}>
        {scroll ? (
          <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {hero}
            {titleRow}
            <View style={{ paddingHorizontal: Layout.screenPaddingX, gap, paddingTop: hero ? Layout.sectionGap : Spacing.two }}>{children}</View>
          </ScrollView>
        ) : (
          <>
            {hero}
            {titleRow}
            <View style={[styles.flex, { paddingBottom: tabBarInset ? BottomTabInset : 0 }]}>{children}</View>
          </>
        )}
      </View>
      {fab ? <View style={[styles.fab, { bottom: (tabBarInset ? BottomTabInset : 0) + Layout.fabOffset.bottom }]}>{fab}</View> : null}
    </View>
  );
}

/** The search and settings buttons of a tab header. */
export function HeaderButtons({ search = true, onAccent = false }: { search?: boolean; onAccent?: boolean }) {
  const theme = useTheme();
  const variant = onAccent ? 'ghost' : 'surface';
  const color = onAccent ? theme.onAccent : undefined;
  return (
    <>
      {search ? <IconButton name="search" label="Hľadať" variant={variant} color={color} onPress={() => router.push('/search')} /> : null}
      <IconButton name="settings" label="Nastavenia" variant={variant} color={color} onPress={() => router.push('/settings')} />
    </>
  );
}

// ---------------------------------------------------------------- Layout

export function Section({ title, right, children, gap = 10 }: { title?: string; right?: ReactNode; children: ReactNode; gap?: number }) {
  return (
    <View style={{ gap }}>
      {title || right ? (
        <View style={styles.sectionHeader}>
          {title ? (
            <ThemedText type="section" style={styles.flex} numberOfLines={1} accessibilityRole="header">
              {title}
            </ThemedText>
          ) : (
            <View style={styles.flex} />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Text link in the accent colour (e.g. "Kalendár" next to a section title). 44 px tall hit area. */
export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.link}>
      <ThemedText type="button" tabular style={{ color: theme.mark }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export type CardTone = 'default' | 'warning' | 'ink' | 'muted' | 'success' | 'danger';

/** Surface card: radius 20, padding 16, 1 px border. Tones: warning (soft fill, no border), ink (inverted), muted (50 %), success/danger (outlined). */
export function Card({ children, style, tone = 'default' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: CardTone }) {
  const theme = useTheme();
  const toneStyle: ViewStyle =
    tone === 'warning'
      ? { backgroundColor: theme.warningSoft, borderWidth: 0 }
      : tone === 'ink'
        ? { backgroundColor: theme.ink, borderWidth: 0 }
        : tone === 'muted'
          ? { opacity: Opacity.archived }
          : tone === 'success'
            ? { backgroundColor: theme.successSoft, borderColor: theme.success, borderWidth: 2 }
            : tone === 'danger'
              ? { borderColor: theme.danger, borderWidth: 2 }
              : {};
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, toneStyle, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Empty({ text }: { text: string }) {
  return (
    <ThemedText type="bodySmall" themeColor="text2" style={styles.empty}>
      {text}
    </ThemedText>
  );
}

// ---------------------------------------------------------------- Buttons

export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'outline' | 'inkOutline' | 'heroOutline' | 'dashed' | 'danger' | 'dangerSoft' | 'ghost' | 'onAccent';

/**
 * Pill button. primary = accent, ink = inverted, secondary = surface2, outline = 2 px border,
 * dashed = dashed outline ("+ Nová aktivita"), inkOutline = outline on an ink card, heroOutline = outline in an accent hero zone, danger / dangerSoft, ghost = text button in the accent colour,
 * onAccent = for hero zones.
 * Sizes: default 52, small 36, hero 64. Pressed scales to 0.97; focus shows a 3 + 3 px ring.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconFilled = true,
  disabled,
  small,
  hero,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconFilled?: boolean;
  disabled?: boolean;
  small?: boolean;
  hero?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const base: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border?: string; dashed?: boolean }> = {
    primary: { bg: theme.accent, pressed: theme.accentPressed, fg: theme.onAccent },
    ink: { bg: theme.ink, pressed: theme.ink, fg: theme.onInk },
    secondary: { bg: theme.surface2, pressed: theme.surface2, fg: theme.text },
    outline: { bg: 'transparent', pressed: 'transparent', fg: theme.text, border: theme.border },
    inkOutline: { bg: 'transparent', pressed: 'transparent', fg: theme.onInk, border: hexA(theme.onInk, 0.5) },
    heroOutline: { bg: 'transparent', pressed: 'transparent', fg: theme.onAccent, border: theme.onAccent },
    dashed: { bg: 'transparent', pressed: 'transparent', fg: theme.text, border: theme.text2, dashed: true },
    danger: { bg: theme.danger, pressed: theme.danger, fg: '#FFFFFF' },
    dangerSoft: { bg: theme.dangerSoft, pressed: theme.dangerSoft, fg: theme.dangerText },
    ghost: { bg: 'transparent', pressed: 'transparent', fg: theme.mark },
    onAccent: { bg: theme.onAccent, pressed: theme.onAccent, fg: theme.accent },
  };
  const v = base[variant];
  const fg = disabled && variant === 'primary' ? theme.text2 : v.fg;
  const height = hero ? 64 : small ? 36 : 52;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hitSlop={small ? { top: 4, bottom: 4 } : undefined}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          borderRadius: height / 2,
          paddingHorizontal: small ? 14 : hero ? 28 : 22,
          backgroundColor: disabled && variant === 'primary' ? theme.surface2 : pressed ? v.pressed : v.bg,
          borderColor: v.border,
          borderWidth: v.border ? (v.dashed ? 1.5 : 2) : 0,
          borderStyle: v.dashed ? 'dashed' : 'solid',
          opacity: disabled ? Opacity.disabled : 1,
          transform: [{ scale: pressed && !disabled ? Motion.pressScale : 1 }],
        },
        focused && { boxShadow: `0 0 0 3px ${theme.bg}, 0 0 0 6px ${theme.text}` },
        style,
      ]}>
      {icon ? <Icon name={icon} size={small ? 18 : hero ? 30 : 22} color={fg} filled={iconFilled} /> : null}
      <ThemedText type={small ? 'meta' : 'button'} style={[{ color: fg }, small && { fontFamily: FontFamily[800] }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Square entity tile (project / activity / goal): emoji on the entity colour, radius 14. */
export function EntityTile({ icon, color, size = 48 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: Radius.tile, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ThemedText style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{icon}</ThemedText>
    </View>
  );
}

/** 44 × 44 round icon button. ghost = bare, surface = card fill + border, surface2 = soft fill. */
export function IconButton({
  name,
  onPress,
  label,
  color,
  size = 22,
  variant = 'ghost',
  disabled,
  filled,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  variant?: 'ghost' | 'surface' | 'surface2';
  disabled?: boolean;
  filled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'surface' && { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
        variant === 'surface2' && { backgroundColor: theme.surface2 },
        { opacity: disabled ? Opacity.iconDisabled : 1, transform: [{ scale: pressed && !disabled ? Motion.pressScaleRound : 1 }] },
      ]}>
      <Icon name={name} size={size} color={color ?? theme.text} filled={filled} />
    </Pressable>
  );
}

/** Rounded-square floating action button (60 × 60, ink). */
export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fabButton, Shadow.fab, { backgroundColor: theme.ink, transform: [{ scale: pressed ? Motion.pressScaleRound : 1 }] }]}>
      <Icon name="add" size={32} color={theme.onInk} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Chips and switches

/**
 * Pill chip, 38 tall (44 with the hit slop). Selected = ink fill. `soft` = tinted (projects),
 * `dashed` = dashed outline (unscheduled tasks), `count` follows the label at 70 %.
 * With `color` a selected chip takes that colour instead of ink.
 */
export function Chip({
  label,
  selected,
  onPress,
  color,
  soft,
  dashed,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string | null;
  soft?: boolean;
  dashed?: boolean;
  count?: number | string;
}) {
  const theme = useTheme();
  const fill = selected ? (color ?? theme.ink) : soft ? theme.markSoft : theme.surface;
  const fg = selected ? (color ? onColor(color) : theme.onInk) : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={count != null ? `${label} ${count}` : label}
      accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 3, bottom: 3 }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: fill,
          borderColor: dashed ? theme.text2 : selected || soft ? 'transparent' : theme.border,
          borderWidth: dashed ? 1.5 : selected || soft ? 0 : 1,
          borderStyle: dashed ? 'dashed' : 'solid',
          transform: [{ scale: pressed ? Motion.pressScale : 1 }],
        },
      ]}>
      <ThemedText type="meta" style={[{ color: fg, fontFamily: FontFamily[800] }]} numberOfLines={1}>
        {label}
        {count != null ? <ThemedText type="meta" style={{ color: fg, opacity: 0.7, fontFamily: FontFamily[800] }}>{`  ${count}`}</ThemedText> : null}
      </ThemedText>
    </Pressable>
  );
}

/** 38 px colour swatch; the selected one gets a ring and a check. */
export function Swatch({ color, selected, onPress, label }: { color: string; selected?: boolean; onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={3}
      style={[styles.swatch, { backgroundColor: color }, selected && { boxShadow: `0 0 0 2px ${theme.bg}, 0 0 0 4px ${theme.text}` }]}>
      {selected ? <Icon name="check" size={20} color={onColor(color)} /> : null}
    </Pressable>
  );
}

/**
 * Segmented control. `primary` (default): ink pill, 40 tall. `filter`: nested, raised active item, 38 tall.
 * `hero`: for the accent hero zone (translucent track, onAccent active item).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'primary',
  hero,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'primary' | 'filter';
  hero?: boolean;
}) {
  const theme = useTheme();
  const filter = variant === 'filter';
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.segmented,
        { backgroundColor: hero ? theme.heroChip : theme.surface2, borderRadius: filter ? Radius.filterSeg : Radius.pill },
      ]}>
      {options.map((o) => {
        const active = o.value === value;
        const itemBg = !active ? 'transparent' : hero ? theme.onAccent : filter ? theme.surface : theme.ink;
        const itemFg = !active ? (hero ? theme.onAccent : theme.text2) : hero ? theme.accent : filter ? theme.text : theme.onInk;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              {
                height: filter ? 38 : 40,
                borderRadius: filter ? Radius.filterSeg - 3 : Radius.pill,
                backgroundColor: itemBg,
              },
              active && filter && Shadow.raisedSegment,
            ]}>
            <ThemedText type="meta" numberOfLines={1} style={{ color: itemFg, fontFamily: FontFamily[800], fontSize: filter ? 12 : options.length > 3 ? 13 : 14 }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Round task checkbox: 28 px circle inside a 52 × 52 hit area. */
export function Checkbox({ checked, onPress, color, label }: { checked: boolean; onPress: () => void; color?: string | null; label?: string }) {
  const theme = useTheme();
  const c = color ?? theme.mark;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.checkboxHit}>
      <View style={[styles.checkbox, { borderColor: checked ? c : theme.text2, backgroundColor: checked ? c : 'transparent' }]}>
        {checked ? <Icon name="check" size={20} color={color ? onColor(color) : theme.onMark} /> : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Forms

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="meta" themeColor="text2" style={{ fontFamily: FontFamily[700] }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

/** Text input: 52 tall, radius 16, 1 px border; focused 2 px accent; `error` shows a red border and a message. */
export function Input(props: TextInputProps & { big?: boolean; error?: string }) {
  const theme = useTheme();
  const { big, error, style, onFocus, onBlur, ...rest } = props;
  const [focused, setFocused] = useState(false);
  const bw = focused || error ? 2 : 1;
  const font = big ? Type.cardTitleL : { fontSize: 16, lineHeight: 22, weight: 600 as const };
  return (
    <View style={styles.inputWrap}>
      <TextInput
        placeholderTextColor={hexA(theme.text2, 0.8)}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          props.multiline && styles.inputMultiline,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : focused ? theme.mark : theme.border,
            borderWidth: bw,
            paddingHorizontal: 17 - bw,
            fontFamily: FontFamily[font.weight],
            fontSize: font.fontSize,
            lineHeight: font.lineHeight,
          },
          style,
        ]}
      />
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="error" size={16} color={theme.dangerText} />
          <ThemedText type="meta" style={{ color: theme.dangerText }}>
            {error}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Progress and tiles

/**
 * Progress meter, 8–10 px. `severity` colours the fill by load: mark → warning above 90 % → danger above 100 %.
 * Without it the fill is `color` (default mark). The track is the fill colour at 16 %.
 */
export function Meter({
  value,
  label,
  height = 8,
  color,
  severity,
  trackColor,
}: {
  value: number;
  label?: string;
  height?: number;
  color?: string;
  severity?: boolean;
  trackColor?: string;
}) {
  const theme = useTheme();
  const v = Math.max(0, Math.min(1, value));
  const fill = severity ? (value > 1 ? theme.danger : value > 0.9 ? theme.warning : (color ?? theme.mark)) : (color ?? theme.mark);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: trackColor ?? hexA(fill, 0.16), overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: fill }} />
    </View>
  );
}

/** Small stat card: label, big value, sub line. */
export function StatTile({ label, value, sub, onPress, children, basis }: { label: string; value: string; sub?: string; onPress?: () => void; children?: ReactNode; basis?: ViewStyle['flexBasis'] }) {
  const theme = useTheme();
  const body = (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ThemedText type="meta" themeColor="text2" style={{ fontFamily: FontFamily[700] }}>
        {label}
      </ThemedText>
      <ThemedText type="statValue" tabular>
        {value}
      </ThemedText>
      {sub ? (
        <ThemedText type="axis" themeColor="text2" style={{ fontSize: 12, fontFamily: FontFamily[600] }}>
          {sub}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`} onPress={onPress} style={[styles.flex, basis != null && { flexBasis: basis }]}>
      {body}
    </Pressable>
  ) : (
    <View style={[styles.flex, basis != null && { flexBasis: basis }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, width: '100%', maxWidth: Layout.contentMaxWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingLeft: 20, paddingRight: Layout.screenPaddingX, paddingBottom: Spacing.two },
  fab: { position: 'absolute', right: Layout.fabOffset.right },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, marginVertical: -9 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  card: { borderRadius: Radius.card, borderWidth: 1, padding: Layout.cardPadding, gap: Spacing.two },
  empty: { paddingVertical: Spacing.two },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fabButton: { width: Layout.fabSize, height: Layout.fabSize, borderRadius: Radius.fab, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', padding: 3, gap: 2 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  checkboxHit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 6 },
  inputWrap: { gap: 6 },
  input: { minHeight: 52, borderRadius: Radius.input, paddingVertical: 11, outlineStyle: 'none' as never },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tile: { borderRadius: Radius.card, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 2 },
});

