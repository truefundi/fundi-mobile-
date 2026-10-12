import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Every vibration in the app goes through here, so the Settings switch turns
 * all of them off at once. Browsers have no vibration, so web is always off.
 */
let enabled = true;

/** Set from the signed-in account's preferences (see AuthContext). */
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

const on = () => enabled && Platform.OS !== 'web';

/** A light or firmer tap, for a step done or a slide finished. */
export function vibrate(strength: 'light' | 'medium' = 'light'): Promise<void> {
  if (!on()) return Promise.resolve();
  const style = strength === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  return Haptics.impactAsync(style).catch(() => undefined);
}

/** The success, warning or error pattern. */
export function notify(kind: 'success' | 'warning' | 'error'): Promise<void> {
  if (!on()) return Promise.resolve();
  const type =
    kind === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : kind === 'warning'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;
  return Haptics.notificationAsync(type).catch(() => undefined);
}
