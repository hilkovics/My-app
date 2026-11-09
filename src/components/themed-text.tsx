import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { FontFamily, Fonts, Type, tabularNums, type ThemeColor, type TypeName, type TypeStyle } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Text variants. The new scale names come from the design (`Type`); the old names stay so existing
 * screens keep working: default → body, small → bodySmall, smallBold → bodySmall bold,
 * subtitle → screenTitle, title → planTitle.
 */
export type ThemedTextType = TypeName | 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
  /** Tabular figures: use for every time, duration and counter. */
  tabular?: boolean;
};

const ALIAS: Record<string, TypeName> = {
  default: 'body',
  small: 'bodySmall',
  smallBold: 'bodySmall',
  subtitle: 'screenTitle',
  title: 'planTitle',
  link: 'bodySmall',
  linkPrimary: 'bodySmall',
};

function styleFor(name: ThemedTextType): TextStyle {
  if (name === 'code') return { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18 };
  const s: TypeStyle = Type[ALIAS[name] ?? (name as TypeName)];
  const weight = name === 'smallBold' ? 800 : s.weight;
  return {
    fontFamily: FontFamily[weight],
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    ...(s.letterSpacing != null ? { letterSpacing: s.letterSpacing } : null),
    ...(s.uppercase ? { textTransform: 'uppercase' as const } : null),
  };
}

const styles = StyleSheet.create(
  Object.fromEntries(
    (['default', 'title', 'small', 'smallBold', 'subtitle', 'link', 'linkPrimary', 'code', ...Object.keys(Type)] as ThemedTextType[]).map((k) => [k, styleFor(k)]),
  ) as Record<string, TextStyle>,
);

export function ThemedText({ style, type = 'default', themeColor, tabular, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = type === 'linkPrimary' ? theme.mark : theme[themeColor ?? 'text'];
  return <Text style={[{ color }, styles[type], tabular && tabularNums, style]} {...rest} />;
}
