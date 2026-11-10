import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { apiRequest } from '@/lib/api';

/**
 * Phone push notifications. The backend mirrors every in-app notification
 * (new job requests, offers, agreements) to the Expo push tokens registered
 * here, so a technician hears about a request while the app is closed.
 */

let registeredToken: string | null = null;

// Show alerts while the app is open too; the in-app lists refresh on their own.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function expoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/** Asks for permission, gets this device's Expo push token and registers it with the backend. */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Job requests and messages',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;

    const projectId = expoProjectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await apiRequest('/api/v1/notifications/push-tokens', {
      method: 'POST',
      authenticated: true,
      body: { token, platform: Platform.OS },
    });
    registeredToken = token;
    return token;
  } catch (error) {
    console.warn('Push notifications could not be enabled.', error);
    return null;
  }
}

/** Removes this device's token from the account; call before signing out. */
export async function unregisterPushNotifications(): Promise<void> {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  await apiRequest('/api/v1/notifications/push-tokens', {
    method: 'DELETE',
    authenticated: true,
    body: { token },
  }).catch(() => undefined);
}

/**
 * Registers the device while signed in and opens the related chat when a
 * notification is tapped (job requests open the technician's incoming
 * request; offers and agreements open the job chat).
 */
export function usePushNotifications(signedIn: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (signedIn) void registerForPushNotifications();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as Record<string, unknown> | undefined;
      const jobId = typeof data?.jobId === 'string' ? data.jobId : null;
      if (!jobId) return;
      router.push({ pathname: '/chat/[id]', params: { id: jobId, requestId: jobId } });
    };
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [signedIn, router]);
}
