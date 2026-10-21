import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { jobsKey, LEGACY_JOBS_KEY } from '@/constants/storage';
import type { JobStatus, RequestLifecycleStatus } from '@/constants/jobs';
import { useAuth } from '@/context/AuthContext';

export type AppNotification = {
  id: string;
  jobId?: string;
  threadId?: string;
  status: JobStatus | RequestLifecycleStatus;
  service: string;
  title: string;
  text: string;
  at: string;
  read: boolean;
  recipientPhones?: string[];
};

type NewNotification = Omit<AppNotification, 'read'> & { read?: boolean };

type NotificationContextValue = {
  notifications: AppNotification[];
  isHydrated: boolean;
  unreadCount: number;
  addNotification: (notification: NewNotification) => void;
  linkJobThread: (jobId: string, threadId: string) => void;
  toggleRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const NOTIFICATIONS_KEY = '@fundi/notifications';

type LegacyJob = {
  id: string;
  service: string;
  chatThreadId?: string;
  events?: Array<{
    id: string;
    status: JobStatus;
    title: string;
    text: string;
    at: string;
  }>;
};

function parseNotifications(raw: string | null): AppNotification[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Stored notifications are not a list.');
  return parsed.filter(
    (item): item is AppNotification =>
      !!item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.status === 'string' &&
      typeof item.service === 'string' &&
      typeof item.title === 'string' &&
      typeof item.text === 'string' &&
      typeof item.at === 'string',
  ).map((item) => ({ ...item, read: item.read === true }));
}

async function loadNotifications(phone: string): Promise<AppNotification[]> {
  const key = `${NOTIFICATIONS_KEY}/${phone}`;
  const stored = await AsyncStorage.getItem(key);
  if (stored !== null) return parseNotifications(stored);

  const jobsRaw = (await AsyncStorage.getItem(jobsKey(phone))) ?? (await AsyncStorage.getItem(LEGACY_JOBS_KEY));
  if (!jobsRaw) return [];
  const jobs: unknown = JSON.parse(jobsRaw);
  if (!Array.isArray(jobs)) throw new Error('Stored jobs are not a list.');
  return (jobs as LegacyJob[]).flatMap((job) =>
    (job.events ?? []).map((event) => ({
      ...event,
      jobId: job.id,
      threadId: job.chatThreadId,
      service: job.service,
      read: false,
    })),
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadFailedKey, setLoadFailedKey] = useState<string | null>(null);
  const queued = useRef<{ key: string | null; items: AppNotification[] }>({ key: null, items: [] });
  const storageKey = account ? `${NOTIFICATIONS_KEY}/${account.phone}` : null;
  const isHydrated = storageKey === null || loadedKey === storageKey;

  useEffect(() => {
    if (!storageKey || !account) {
      setNotifications([]);
      setLoadedKey(null);
      setLoadFailedKey(null);
      return;
    }
    let mounted = true;
    if (queued.current.key !== storageKey) queued.current = { key: storageKey, items: [] };
    setLoadedKey(null);
    setLoadFailedKey(null);
    loadNotifications(account.phone)
      .then((stored) => {
        if (!mounted) return;
        const pending = queued.current.key === storageKey ? queued.current.items : [];
        setNotifications([...pending, ...stored.filter((item) => !pending.some((queuedItem) => queuedItem.id === item.id))]);
        queued.current = { key: storageKey, items: [] };
        setLoadedKey(storageKey);
        setLoadFailedKey(null);
      })
      .catch((error: unknown) => {
        console.error('Unable to load notifications.', error);
        if (mounted) {
          setNotifications([]);
          setLoadedKey(storageKey);
          setLoadFailedKey(storageKey);
        }
      });
    return () => {
      mounted = false;
    };
  }, [account, storageKey]);

  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey || loadFailedKey === storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(notifications)).catch((error: unknown) => {
      console.error('Unable to persist notifications.', error);
    });
  }, [loadedKey, loadFailedKey, notifications, storageKey]);

  const addNotification = useCallback((notification: NewNotification) => {
    const item = { ...notification, read: notification.read ?? false };
    if (storageKey && loadedKey !== storageKey) {
      if (queued.current.key !== storageKey) queued.current = { key: storageKey, items: [] };
      queued.current.items = [item, ...queued.current.items.filter((existing) => existing.id !== item.id)];
      return;
    }
    setNotifications((current) => [
      item,
      ...current.filter((existing) => existing.id !== notification.id),
    ]);

    const otherRecipients = [...new Set(notification.recipientPhones ?? [])].filter(
      (phone) => phone !== account?.phone,
    );
    void Promise.all(
      otherRecipients.map(async (phone) => {
        const recipientKey = `${NOTIFICATIONS_KEY}/${phone}`;
        try {
          const stored = parseNotifications(await AsyncStorage.getItem(recipientKey));
          await AsyncStorage.setItem(
            recipientKey,
            JSON.stringify([item, ...stored.filter((existing) => existing.id !== item.id)]),
          );
        } catch (error) {
          console.error(`Unable to persist notification for ${phone}.`, error);
        }
      }),
    );
  }, [account?.phone, loadedKey, storageKey]);

  const linkJobThread = useCallback((jobId: string, threadId: string) => {
    setNotifications((current) =>
      current.map((item) => (item.jobId === jobId && !item.threadId ? { ...item, threadId } : item)),
    );
  }, []);

  const toggleRead = useCallback((id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: !item.read } : item)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      isHydrated,
      unreadCount: notifications.filter((item) => !item.read).length,
      addNotification,
      linkJobThread,
      toggleRead,
      markAllRead,
      deleteNotification,
    }),
    [notifications, isHydrated, addNotification, linkJobThread, toggleRead, markAllRead, deleteNotification],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
