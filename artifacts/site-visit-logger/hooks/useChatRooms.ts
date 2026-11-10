import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useChatSocketStatus } from '@/hooks/useChatSocketStatus';
import {
  listChatRoomMessages,
  listChatRooms,
  type BackendChatMessage,
  type BackendChatRoom,
} from '@/lib/chat-rooms-api';
import { joinChatRoom, onChatEvent, type ChatSocketStatus } from '@/lib/chat-socket';

/** Messages fetched per room to derive the preview and unread badge. */
const PREVIEW_PAGE_SIZE = 50;
/** REST refresh interval while the realtime socket is unavailable. */
const OFFLINE_POLL_MS = 30_000;

export type ChatRoomSummary = {
  room: BackendChatRoom;
  lastMessage: BackendChatMessage | null;
  unreadCount: number;
  /** True when every fetched message was unread, so the real count may be higher. */
  unreadCapped: boolean;
  /** Timestamp used for ordering and the row's time label. */
  activityAt: string;
};

export function isIncomingUnread(message: BackendChatMessage, viewerId?: string): boolean {
  return Boolean(
    viewerId &&
      message.senderId &&
      message.senderId !== viewerId &&
      !message.readByViewer &&
      !message.isTombstone &&
      !message.isBlocked,
  );
}

function summarize(
  room: BackendChatRoom,
  messages: BackendChatMessage[] | null,
  hasMore: boolean,
  viewerId?: string,
): ChatRoomSummary {
  const lastMessage = messages?.[0] ?? null;
  const unreadCount = messages ? messages.filter((m) => isIncomingUnread(m, viewerId)).length : 0;
  return {
    room,
    lastMessage,
    unreadCount,
    unreadCapped: hasMore && unreadCount === (messages?.length ?? 0),
    activityAt: lastMessage?.createdAt ?? room.updatedAt,
  };
}

function sortSummaries(list: ChatRoomSummary[]): ChatRoomSummary[] {
  return [...list].sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime());
}

/**
 * Loads the signed-in member's job chat rooms with last-message previews and
 * unread counts, keeps them live over the chat socket, and falls back to
 * periodic REST refreshes while the socket is down.
 */
export function useChatRooms() {
  const { account } = useAuth();
  const viewerId = account?.id;
  const socketStatus: ChatSocketStatus = useChatSocketStatus(Boolean(account));
  const [summaries, setSummaries] = useState<ChatRoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
      if (!account) {
        setSummaries([]);
        setIsLoading(false);
        return;
      }
      const seq = ++requestSeq.current;
      if (mode === 'initial' && !hasLoaded.current) setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      try {
        const rooms = await listChatRooms();
        const pages = await Promise.allSettled(
          rooms.map((room) => listChatRoomMessages(room.id, PREVIEW_PAGE_SIZE)),
        );
        if (seq !== requestSeq.current) return;
        setSummaries(
          sortSummaries(
            rooms.map((room, index) => {
              const page = pages[index];
              return page.status === 'fulfilled'
                ? summarize(room, page.value.items, Boolean(page.value.nextCursor), viewerId)
                : summarize(room, null, false, viewerId);
            }),
          ),
        );
        setError(null);
        hasLoaded.current = true;
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(err instanceof Error ? err.message : 'Unable to load your chats.');
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [account, viewerId],
  );

  // Refresh whenever the tab gains focus so read receipts from the room screen are reflected.
  useFocusEffect(
    useCallback(() => {
      void load(hasLoaded.current ? 'silent' : 'initial');
    }, [load]),
  );

  // Catch up after a reconnect, and poll while realtime delivery is unavailable.
  const previousStatus = useRef(socketStatus);
  useEffect(() => {
    if (socketStatus === 'connected' && previousStatus.current !== 'connected' && hasLoaded.current) {
      void load('silent');
    }
    previousStatus.current = socketStatus;
    if (socketStatus === 'connected' || !account) return;
    const timer = setInterval(() => void load('silent'), OFFLINE_POLL_MS);
    return () => clearInterval(timer);
  }, [socketStatus, account, load]);

  // Subscribe to every visible room so new messages update previews in real time.
  const roomIds = useMemo(() => summaries.map((s) => s.room.id).sort().join(','), [summaries]);
  useEffect(() => {
    if (!roomIds) return;
    const leaves = roomIds.split(',').map((roomId) => joinChatRoom(roomId));
    return () => leaves.forEach((leave) => leave());
  }, [roomIds]);

  useEffect(() => {
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const reloadSoon = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void load('silent'), 400);
    };

    const offNew = onChatEvent('chat:message:new', (message: BackendChatMessage) => {
      setSummaries((current) => {
        const index = current.findIndex((s) => s.room.id === message.roomId);
        if (index < 0) {
          reloadSoon();
          return current;
        }
        const existing = current[index];
        if (existing.lastMessage?.id === message.id) return current;
        const next = [...current];
        next[index] = {
          ...existing,
          lastMessage: message,
          activityAt: message.createdAt,
          unreadCount: existing.unreadCount + (isIncomingUnread(message, viewerId) ? 1 : 0),
        };
        return sortSummaries(next);
      });
    });
    const replace = (message: BackendChatMessage) =>
      setSummaries((current) =>
        current.map((s) =>
          s.lastMessage?.id === message.id ? { ...s, lastMessage: message } : s,
        ),
      );
    const offUpdated = onChatEvent('chat:message:updated', replace);
    const offDeleted = onChatEvent('chat:message:deleted', replace);
    const offModerated = onChatEvent('chat:message:moderated', replace);
    const offRead = onChatEvent('chat:message:read', (receipt: { userId: string }) => {
      if (receipt?.userId === viewerId) reloadSoon();
    });
    const offRoom = onChatEvent('chat:room:updated', reloadSoon);
    const offJob = onChatEvent('chat:job:updated', reloadSoon);
    const offMember = onChatEvent('chat:member:moderated', reloadSoon);
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      offNew();
      offUpdated();
      offDeleted();
      offModerated();
      offRead();
      offRoom();
      offJob();
      offMember();
    };
  }, [load, viewerId]);

  const totalUnread = useMemo(
    () => summaries.reduce((sum, s) => sum + s.unreadCount, 0),
    [summaries],
  );

  return {
    summaries,
    totalUnread,
    isLoading,
    isRefreshing,
    error,
    socketStatus,
    refresh: () => load('refresh'),
  };
}
