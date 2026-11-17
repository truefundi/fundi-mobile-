import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoNotifications from 'expo-notifications';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markJobNotificationsRead,
  markNotificationRead,
  type ServerNotification,
} from '@/lib/notifications-api';

/**
 * One entry in the notification feed. Every update about the same job is
 * folded into a single entry (newest update on top, with a count), so a busy
 * job reads like one conversation instead of a stream of separate alerts.
 * Notifications that are not about a job stand on their own.
 */
export type NotificationGroup = {
  key: string;
  jobId?: string;
  latest: ServerNotification;
  items: ServerNotification[];
  unread: number;
};

type NotificationContextValue = {
  groups: NotificationGroup[];
  /** Entries with at least one unread update. */
  unreadCount: number;
  isHydrated: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  /** Marks everything in the entry as read. */
  markGroupRead: (group: NotificationGroup) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

/** How often the feed is refreshed while the app is open. */
const POLL_MS = 30_000;
/** The old on-device log that recorded every local status change. */
const LEGACY_KEY = '@fundi/notifications';

export function groupNotifications(items: ServerNotification[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  // Newest first, so the first item seen for a job is its latest update.
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const item of sorted) {
    const jobId = typeof item.data?.jobId === 'string' ? item.data.jobId : undefined;
    const key = jobId ? `job:${jobId}` : `n:${item.id}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(item);
      if (!item.readAt) group.unread += 1;
    } else {
      groups.set(key, { key, jobId, latest: item, items: [item], unread: item.readAt ? 0 : 1 });
    }
  }
  return [...groups.values()];
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [items, setItems] = useState<ServerNotification[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const accountId = account?.id ?? null;
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;

  const refresh = useCallback(async () => {
    const forAccount = currentAccount.current;
    if (!forAccount) return;
    try {
      const fresh = await fetchNotifications();
      if (currentAccount.current !== forAccount) return;
      setItems(fresh);
      setLoadError(null);
    } catch (error) {
      if (currentAccount.current === forAccount) {
        setLoadError(error instanceof Error ? error.message : 'Could not load notifications.');
      }
    } finally {
      if (currentAccount.current === forAccount) setLoadedFor(forAccount);
    }
  }, []);

  // Load on sign-in, clear on sign-out, and drop the old on-device log.
  useEffect(() => {
    setItems([]);
    setLoadedFor(null);
    setLoadError(null);
    if (!accountId) return;
    if (account?.phone) void AsyncStorage.removeItem(`${LEGACY_KEY}/${account.phone}`).catch(() => undefined);
    void refresh();
  }, [accountId, account?.phone, refresh]);

  // Keep the feed current while the app is in the foreground.
  useEffect(() => {
    if (!accountId) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    // A push arriving while the app is open means the feed changed.
    const received =
      Platform.OS === 'web' ? null : ExpoNotifications.addNotificationReceivedListener(() => void refresh());
    return () => {
      clearInterval(timer);
      appState.remove();
      received?.remove();
    };
  }, [accountId, refresh]);

  const markGroupRead = useCallback((group: NotificationGroup) => {
    if (!group.unread) return;
    const ids = new Set(group.items.filter((item) => !item.readAt).map((item) => item.id));
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => (ids.has(item.id) ? { ...item, readAt: now } : item)));
    const request = group.jobId
      ? markJobNotificationsRead(group.jobId)
      : Promise.all([...ids].map((id) => markNotificationRead(id)));
    void request.catch(() => void refresh());
  }, [refresh]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => (item.readAt ? item : { ...item, readAt: now })));
    void markAllNotificationsRead().catch(() => void refresh());
  }, [refresh]);

  const groups = useMemo(() => groupNotifications(items), [items]);

  const value = useMemo(
    () => ({
      groups,
      unreadCount: groups.filter((group) => group.unread > 0).length,
      isHydrated: !accountId || loadedFor === accountId,
      loadError,
      refresh,
      markGroupRead,
      markAllRead,
    }),
    [groups, accountId, loadedFor, loadError, refresh, markGroupRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
