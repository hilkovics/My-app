import { type ReactNode } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';

/** Tab screen shell: safe area, own header, scrollable content, optional floating button. */
export function Screen({
  title,
  subtitle,
  actions,
  children,
  scroll = true,
  fab,
  tabBarInset = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  fab?: ReactNode;
  tabBarInset?: boolean;
}) {
  const theme = useTheme();
  const bottom = tabBarInset ? BottomTabInset + Spacing.five : Spacing.five;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.row}>{actions}</View>
        </View>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, { paddingBottom: bottom + 56 }]}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, { paddingBottom: tabBarInset ? BottomTabInset : 0 }]}>{children}</View>
        )}
      </View>
      {fab ? <View style={[styles.fab, { bottom: bottom - Spacing.two }]}>{fab}</View> : null}
    </SafeAreaView>
  );
}

export function Section({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {title}
          </ThemedText>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
}) {
  const theme = useTheme();
  const bg =
    variant === 'primary'
      ? theme.accent
      : variant === 'danger'
        ? theme.danger
        : variant === 'secondary'
          ? theme.backgroundSelected
          : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? theme.accentText : variant === 'ghost' ? theme.accent : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}>
      {icon ? <Icon name={icon} size={small ? 14 : 16} color={fg} /> : null}
      <ThemedText type={small ? 'small' : 'default'} style={{ color: fg, fontWeight: 600 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  color,
  size = 22,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fabButton, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
      <Icon name="add" size={28} color={theme.accentText} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string | null;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? (color ?? theme.accent) : theme.backgroundElement,
          borderColor: color ?? theme.border,
        },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.accentText : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: theme.background }]}>
            <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'} style={active && { fontWeight: 700 }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Checkbox({
  checked,
  onPress,
  color,
  label,
}: {
  checked: boolean;
  onPress: () => void;
  color?: string | null;
  label?: string;
}) {
  const theme = useTheme();
  const c = color ?? theme.accent;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={[styles.checkbox, { borderColor: c, backgroundColor: checked ? c : 'transparent' }]}>
      {checked ? <Icon name="check" size={14} color={theme.accentText} /> : null}
    </Pressable>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps & { big?: boolean }) {
  const theme = useTheme();
  const { big, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...rest}
      style={[
        styles.input,
        big && styles.inputBig,
        props.multiline && styles.inputMultiline,
        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}
    />
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
      {text}
    </ThemedText>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 12 },
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  buttonSmall: { paddingHorizontal: Spacing.two + 2, paddingVertical: 6 },
  iconButton: { padding: Spacing.one },
  fab: { position: 'absolute', right: Spacing.four },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  chip: {
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmented: { flexDirection: 'row', borderRadius: Radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: Radius.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: Spacing.one },
  input: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputBig: { fontSize: 20, fontWeight: 600 },
  inputMultiline: { minHeight: 140, textAlignVertical: 'top' },
  empty: { paddingVertical: Spacing.two },
});
