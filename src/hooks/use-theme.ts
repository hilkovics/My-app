import { Themes, type Theme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The active theme: colours plus the derived alpha mixes. Follows the system setting. */
export function useTheme(): Theme {
  return Themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
