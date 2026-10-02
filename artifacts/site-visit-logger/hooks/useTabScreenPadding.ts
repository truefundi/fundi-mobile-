import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom padding for a tab screen's scroll content.
 *
 * The tab bar floats over the screen (position: absolute), so the last rows of
 * every tab need enough room to scroll clear of it — not just the safe area.
 */
export function useTabScreenPadding(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? 108 : insets.bottom + 92;
}
