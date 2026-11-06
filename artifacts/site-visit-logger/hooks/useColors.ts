import colors, { type ColorTheme } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * (light or dark, driven by user preference or system setting) plus
 * scheme-independent values like `radius`.
 */
export function useColors(): ColorTheme & { radius: number } {
  const { resolvedTheme } = useTheme();
  const palette = resolvedTheme === 'dark' ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
