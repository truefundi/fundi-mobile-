import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChatSocketStatus } from '@/hooks/useChatSocketStatus';
import { ApiRequestError } from '@/lib/api';
import {
  CHAT_TEXT_MAX_LENGTH,
  getChatRoom,
  isChatRoomWritable,
  listChatRoomMessages,
  listChatRooms,
  markChatRoomRead,
  pickRoomForJob,
  sendChatRoomMedia,
  sendChatRoomText,
  type BackendChatMessage,
  type BackendChatRoom,
  type ChatMediaType,
  type ChatReadResult,
} from '@/lib/chat-rooms-api';
import { emitTyping, joinChatRoom, onChatEvent } from '@/lib/chat-socket';

const PAGE_SIZE = 50;
/** REST refresh interval while the realtime socket is unavailable. */
const OFFLINE_POLL_MS = 6_000;
/** How often a job without a chat room yet re-checks for one. */
const ROOM_WAIT_POLL_MS = 8_000;
const TYPING_TIMEOUT_MS = 5_000;

export type ChatDeliveryState = 'sending' | 'failed';

/** A message in the timeline: either confirmed by the server or still pending locally. */
export type ChatTimelineMessage = BackendChatMessage & {
  /** Present only for optimistic messages that the server has not confirmed yet. */
  delivery?: ChatDeliveryState;
  /** Local file preview for pending media uploads. */
  localUri?: string;
  /** Last send error for failed messages. */
  deliveryError?: string;
};

export type ChatRoomResolution = 'resolving' | 'found' | 'not-found' | 'error';

function byCreatedAt(a: BackendChatMessage, b: BackendChatMessage) {
  const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

/** Merges server messages into the timeline by id, keeping pending messages at the end. */
function mergeMessages(
  current: ChatTimelineMessage[],
  incoming: BackendChatMessage[],
): ChatTimelineMessage[] {
  if (!incoming.length) return current;
  const confirmed = new Map<string, ChatTimelineMessage>();
  const pending: ChatTimelineMessage[] = [];
  for (const message of current) {
    if (message.delivery) pending.push(message);
    else confirmed.set(message.id, message);
  }
  for (const message of incoming) {
    // The socket echo of our own send can beat the REST response; drop the matching optimistic copy.
    if (!confirmed.has(message.id)) {
      const echoIndex = pending.findIndex(
        (p) =>
          p.delivery === 'sending' &&
          p.senderId === message.senderId &&
          p.type === message.type &&
          (message.type === 'TEXT' ? p.text === message.text : p.fileName === message.fileName),
      );
      if (echoIndex >= 0) pending.splice(echoIndex, 1);
    }
    confirmed.set(message.id, message);
  }
  return [...[...confirmed.values()].sort(byCreatedAt), ...pending];
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

let localSeq = 0;
function localId() {
  localSeq += 1;
  return `local-${Date.now()}-${localSeq}`;
}

/**
 * Drives one job chat room: resolves the room from a room id or job id, loads
 * and paginates history, sends text/media with optimistic updates, keeps the
 * timeline live over the chat socket, marks incoming messages as read and
 * falls back to REST polling while the socket is disconnected.
 */
export function useChatRoom(routeId?: string, jobIdHint?: string) {
  const { account } = useAuth();
  const viewerId = account?.id;
  const socketStatus = useChatSocketStatus(Boolean(account));

  const [resolution, setResolution] = useState<ChatRoomResolution>('resolving');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [room, setRoom] = useState<BackendChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatTimelineMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [resolveAttempt, setResolveAttempt] = useState(0);

  const roomId = room?.id;
  const roomJobId = useRef<string | undefined>(undefined);
  roomJobId.current = room?.jobId;
  const requests = useRef(new Map<string, () => Promise<BackendChatMessage>>());
  const lastReadRequested = useRef<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ── Resolve the room and load the newest page ───────────────────────────
  // The ids identify one job's chat. Learning more about the same job (e.g. a
  // job hint arriving after the route id) must not reset the screen, and a job
  // without a room yet keeps checking quietly so the room appears in place once
  // a technician is assigned.
  const candidates = useMemo(
    () => [...new Set([routeId, jobIdHint].filter((value): value is string => Boolean(value)))],
    [routeId, jobIdHint],
  );
  const candidateKey = candidates.join('|');
  const currentRoom = useRef<BackendChatRoom | null>(null);
  currentRoom.current = room;
  const resolvedOnce = useRef(false);
  const resolveSeq = useRef(0);

  const resolve = useCallback(
    async (mode: 'initial' | 'silent') => {
      if (!account || !candidates.length) return;
      const seq = ++resolveSeq.current;
      if (mode === 'initial' && !resolvedOnce.current) {
        setResolution('resolving');
        setResolveError(null);
      }
      try {
        const rooms = await listChatRooms();
        const match =
          rooms.find((r) => candidates.includes(r.id)) ??
          candidates.map((jobId) => pickRoomForJob(rooms, jobId)).find(Boolean);
        if (seq !== resolveSeq.current || !mounted.current) return;
        if (!match) {
          // Keep a room we already show (a transient miss must not blank the chat).
          if (!currentRoom.current) {
            setRoom(null);
            setResolution('not-found');
          }
          resolvedOnce.current = true;
          return;
        }
        if (currentRoom.current?.id === match.id) {
          setRoom(match);
          setResolution('found');
          resolvedOnce.current = true;
          return;
        }
        const page = await listChatRoomMessages(match.id, PAGE_SIZE);
        if (seq !== resolveSeq.current || !mounted.current) return;
        setRoom(match);
        setMessages(mergeMessages([], page.items));
        setNextCursor(page.nextCursor);
        setHistoryError(null);
        lastReadRequested.current = null;
        setResolution('found');
        resolvedOnce.current = true;
      } catch (error) {
        if (seq !== resolveSeq.current || !mounted.current) return;
        if (!resolvedOnce.current) {
          setResolveError(errorMessage(error, 'Unable to open this chat.'));
          setResolution('error');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account, candidateKey],
  );

  useEffect(() => {
    // Already showing this job's room: nothing to resolve.
    const shown = currentRoom.current;
    if (shown && candidates.some((id) => id === shown.id || id === shown.jobId)) return;
    void resolve('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolve, resolveAttempt]);

  // No room yet (request not accepted): pick it up as soon as the job changes.
  useEffect(() => {
    if (resolution !== 'not-found') return;
    const offJob = onChatEvent('chat:job:updated', (payload: { id?: string }) => {
      if (!payload?.id || candidates.includes(payload.id)) void resolve('silent');
    });
    const timer = setInterval(() => void resolve('silent'), ROOM_WAIT_POLL_MS);
    return () => {
      offJob();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, resolve]);

  const retryResolve = useCallback(() => setResolveAttempt((n) => n + 1), []);

  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const fresh = await getChatRoom(roomId);
      if (mounted.current) setRoom(fresh);
    } catch {
      // Keep the last known room state; the next poll or event retries.
    }
  }, [roomId]);

  /** Fetches the newest page and merges it (used for catch-up and polling). */
  const syncLatest = useCallback(async () => {
    if (!roomId) return;
    try {
      const page = await listChatRoomMessages(roomId, PAGE_SIZE);
      if (!mounted.current) return;
      setMessages((current) => mergeMessages(current, page.items));
      setHistoryError(null);
    } catch (error) {
      if (mounted.current) setHistoryError(errorMessage(error, 'Unable to refresh messages.'));
    }
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    if (!roomId || !nextCursor || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const page = await listChatRoomMessages(roomId, PAGE_SIZE, nextCursor);
      if (!mounted.current) return;
      setMessages((current) => mergeMessages(current, page.items));
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (mounted.current) setHistoryError(errorMessage(error, 'Unable to load earlier messages.'));
    } finally {
      if (mounted.current) setIsLoadingOlder(false);
    }
  }, [roomId, nextCursor, isLoadingOlder]);

  // ── Realtime subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const leave = joinChatRoom(roomId);
    const forRoom = <T extends { roomId?: string }>(handler: (payload: T) => void) =>
      (payload: T) => {
        if (payload?.roomId === roomId) handler(payload);
      };
    const upsert = forRoom<BackendChatMessage>((message) =>
      setMessages((current) => mergeMessages(current, [message])),
    );
    const offNew = onChatEvent('chat:message:new', forRoom<BackendChatMessage>((message) => {
      setMessages((current) => mergeMessages(current, [message]));
      if (message.senderId && message.senderId !== viewerId) setOtherTyping(false);
    }));
    const offUpdated = onChatEvent('chat:message:updated', upsert);
    const offDeleted = onChatEvent('chat:message:deleted', upsert);
    const offModerated = onChatEvent('chat:message:moderated', upsert);
    // chat:room:updated carries the room itself (keyed by id, not roomId).
    const offRoom = onChatEvent('chat:room:updated', (payload: BackendChatRoom) => {
      if (payload?.id === roomId) void refreshRoom();
    });
    // chat:job:updated carries the job; ignore updates for other joined rooms' jobs.
    const offJob = onChatEvent('chat:job:updated', (payload: { id?: string }) => {
      if (!payload?.id || payload.id === roomJobId.current) void refreshRoom();
    });
    const offMember = onChatEvent('chat:member:moderated', forRoom(() => void refreshRoom()));
    const offRead = onChatEvent('chat:message:read', (receipt: ChatReadResult) => {
      if (!receipt?.userId) return;
      setMessages((current) => {
        const target = current.find((m) => m.id === receipt.messageId);
        if (!target) return current;
        const cutoff = new Date(target.createdAt).getTime();
        return current.map((m) => {
          if (m.delivery || new Date(m.createdAt).getTime() > cutoff) return m;
          if (m.senderId === receipt.userId || m.readBy.some((r) => r.userId === receipt.userId)) return m;
          return {
            ...m,
            readBy: [...m.readBy, { userId: receipt.userId, readAt: receipt.readAt }],
            readByOtherSide: m.readByOtherSide || receipt.userId !== viewerId,
            readByViewer: m.readByViewer || receipt.userId === viewerId,
          };
        });
      });
    });
    const offTyping = onChatEvent('chat:typing', (payload: { userId?: string; active?: boolean }) => {
      if (!payload?.userId || payload.userId === viewerId) return;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      setOtherTyping(Boolean(payload.active));
      if (payload.active) {
        typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
      }
    });
    return () => {
      leave();
      offNew();
      offUpdated();
      offDeleted();
      offModerated();
      offRoom();
      offJob();
      offMember();
      offRead();
      offTyping();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [roomId, viewerId, refreshRoom]);

  // Catch up on reconnect; poll while the socket is down.
  const previousStatus = useRef(socketStatus);
  useEffect(() => {
    if (!roomId) return;
    if (socketStatus === 'connected' && previousStatus.current !== 'connected') {
      void syncLatest();
      void refreshRoom();
    }
    previousStatus.current = socketStatus;
    if (socketStatus === 'connected') return;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      void syncLatest();
      if (tick % 4 === 0) void refreshRoom();
    }, OFFLINE_POLL_MS);
    return () => clearInterval(timer);
  }, [socketStatus, roomId, syncLatest, refreshRoom]);

  // ── Read receipts ───────────────────────────────────────────────────────
  const latestIncomingUnread = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.delivery || !m.senderId || m.senderId === viewerId) continue;
      return m.readByViewer ? null : m;
    }
    return null;
  }, [messages, viewerId]);

  useEffect(() => {
    if (!roomId || !latestIncomingUnread) return;
    if (lastReadRequested.current === latestIncomingUnread.id) return;
    lastReadRequested.current = latestIncomingUnread.id;
    const targetId = latestIncomingUnread.id;
    const cutoff = new Date(latestIncomingUnread.createdAt).getTime();
    markChatRoomRead(roomId, targetId)
      .then(() => {
        if (!mounted.current) return;
        setMessages((current) =>
          current.map((m) =>
            !m.delivery && m.senderId !== viewerId && new Date(m.createdAt).getTime() <= cutoff
              ? { ...m, readByViewer: true }
              : m,
          ),
        );
      })
      .catch(() => {
        // Allow a retry on the next render cycle (e.g. after reconnecting).
        if (lastReadRequested.current === targetId) lastReadRequested.current = null;
      });
  }, [roomId, latestIncomingUnread, viewerId]);

  // ── Sending ─────────────────────────────────────────────────────────────
  const canWrite = room ? isChatRoomWritable(room) : false;

  const pendingMessage = useCallback(
    (partial: Partial<ChatTimelineMessage>): ChatTimelineMessage => ({
      id: localId(),
      roomId: roomId ?? '',
      senderId: viewerId ?? null,
      senderRole: account?.role === 'TECHNICIAN' ? 'TECHNICIAN' : 'CUSTOMER',
      type: 'TEXT',
      text: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      durationSeconds: null,
      downloadUrl: null,
      downloadPath: null,
      isTombstone: false,
      isBlocked: false,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      readBy: [],
      readByOtherSide: false,
      readByViewer: true,
      delivery: 'sending',
      ...partial,
    }),
    [roomId, viewerId, account?.role],
  );

  const deliver = useCallback(
    async (pending: ChatTimelineMessage, request: () => Promise<BackendChatMessage>) => {
      try {
        const saved = await request();
        requests.current.delete(pending.id);
        if (!mounted.current) return;
        setMessages((current) =>
          mergeMessages(
            current.filter((m) => m.id !== pending.id),
            [saved],
          ),
        );
      } catch (error) {
        if (!mounted.current) return;
        const message = errorMessage(error, 'Message not sent.');
        setMessages((current) =>
          current.map((m) =>
            m.id === pending.id ? { ...m, delivery: 'failed', deliveryError: message } : m,
          ),
        );
        // A 409 means the room is no longer writable; refresh so the UI locks.
        if (error instanceof ApiRequestError && (error.status === 409 || error.status === 403)) {
          void refreshRoom();
        }
      }
    },
    [refreshRoom],
  );

  const sendText = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!roomId || !body) return;
      if (body.length > CHAT_TEXT_MAX_LENGTH) {
        throw new Error(`Messages can be at most ${CHAT_TEXT_MAX_LENGTH} characters.`);
      }
      const pending = pendingMessage({ text: body });
      const request = () => sendChatRoomText(roomId, body);
      requests.current.set(pending.id, request);
      setMessages((current) => [...current, pending]);
      emitTyping(roomId, false);
      void deliver(pending, request);
    },
    [roomId, pendingMessage, deliver],
  );

  const sendMedia = useCallback(
    (
      type: ChatMediaType,
      file: { uri: string; name?: string; mimeType?: string; sizeBytes?: number },
      durationSeconds?: number,
    ) => {
      if (!roomId) return;
      const pending = pendingMessage({
        type,
        fileName: file.name ?? null,
        mimeType: file.mimeType ?? null,
        sizeBytes: file.sizeBytes ?? null,
        durationSeconds: durationSeconds ?? null,
        localUri: file.uri,
      });
      const request = () => sendChatRoomMedia(roomId, type, file, durationSeconds);
      requests.current.set(pending.id, request);
      setMessages((current) => [...current, pending]);
      void deliver(pending, request);
    },
    [roomId, pendingMessage, deliver],
  );

  const retryMessage = useCallback(
    (id: string) => {
      const request = requests.current.get(id);
      const pending = messages.find((m) => m.id === id);
      if (!request || !pending) return;
      setMessages((current) =>
        current.map((m) => (m.id === id ? { ...m, delivery: 'sending', deliveryError: undefined } : m)),
      );
      void deliver(pending, request);
    },
    [messages, deliver],
  );

  const discardMessage = useCallback((id: string) => {
    requests.current.delete(id);
    setMessages((current) => current.filter((m) => !(m.id === id && m.delivery)));
  }, []);

  const lastTypingEmit = useRef(0);
  const setTyping = useCallback(
    (active: boolean) => {
      if (!roomId || !canWrite) return;
      const now = Date.now();
      if (active && now - lastTypingEmit.current < 2_000) return;
      lastTypingEmit.current = active ? now : 0;
      emitTyping(roomId, active);
    },
    [roomId, canWrite],
  );

  return {
    resolution,
    resolveError,
    retryResolve,
    room,
    canWrite,
    messages,
    hasOlder: Boolean(nextCursor),
    isLoadingOlder,
    loadOlder,
    historyError,
    refresh: syncLatest,
    socketStatus,
    otherTyping,
    setTyping,
    sendText,
    sendMedia,
    retryMessage,
    discardMessage,
  };
}
