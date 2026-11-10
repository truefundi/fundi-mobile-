import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth-session';

/**
 * Shared Socket.IO connection to the backend `/chat` namespace.
 *
 * - Authenticates with the stored access token on every (re)connect.
 * - Tracks joined rooms with reference counts and re-joins them after reconnects.
 * - Retries after server-initiated disconnects (e.g. an expired token was refreshed)
 *   and when the app returns to the foreground.
 *
 * Consumers must treat the socket as best effort: when `status` is not
 * `connected`, they fall back to REST polling (see `hooks/useChatRoom.ts`).
 */

export type ChatSocketStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

type Listener = (payload: any) => void;

const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;

let socket: Socket | null = null;
let status: ChatSocketStatus = 'idle';
let users = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let appStateSub: { remove: () => void } | null = null;
const statusListeners = new Set<(status: ChatSocketStatus) => void>();
const joinedRooms = new Map<string, number>();
const eventListeners = new Map<string, Set<Listener>>();

function setStatus(next: ChatSocketStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener(next));
}

function socketUrl(): string | null {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  return base ? `${base}/chat` : null;
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry() {
  if (!users || retryTimer) return;
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS);
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (users && socket && !socket.connected) {
      setStatus('connecting');
      socket.connect();
    }
  }, delay);
}

function joinOnSocket(roomId: string) {
  socket?.emit('chat:join', { roomId });
}

function handleAppState(next: AppStateStatus) {
  if (next === 'active' && users && socket && !socket.connected) {
    clearRetry();
    retryAttempt = 0;
    setStatus('connecting');
    socket.connect();
  }
}

function ensureSocket(): Socket | null {
  if (socket) return socket;
  const url = socketUrl();
  if (!url) {
    setStatus('disconnected');
    return null;
  }

  socket = io(url, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: RETRY_BASE_MS,
    reconnectionDelayMax: RETRY_MAX_MS,
    // Called on every connection attempt so a refreshed token is picked up.
    auth: (cb) => {
      getAccessToken()
        .then((accessToken) => cb({ accessToken: accessToken ?? '' }))
        .catch(() => cb({ accessToken: '' }));
    },
  });

  socket.on('connect', () => {
    clearRetry();
    retryAttempt = 0;
    setStatus('connected');
    joinedRooms.forEach((_count, roomId) => joinOnSocket(roomId));
  });
  socket.on('disconnect', (reason) => {
    setStatus(users ? 'disconnected' : 'idle');
    // The server drops unauthenticated sockets; the client will not retry those on its own.
    if (reason === 'io server disconnect') scheduleRetry();
  });
  socket.on('connect_error', () => {
    setStatus('disconnected');
  });
  socket.onAny((event: string, payload: unknown) => {
    eventListeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn(`Chat socket listener for ${event} failed.`, error);
      }
    });
  });

  return socket;
}

/** Starts (or reuses) the shared connection. Call the returned function to release it. */
export function acquireChatSocket(): () => void {
  users += 1;
  const current = ensureSocket();
  if (!appStateSub) appStateSub = AppState.addEventListener('change', handleAppState);
  if (current && !current.connected) {
    setStatus('connecting');
    current.connect();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users = Math.max(0, users - 1);
    if (users === 0) {
      clearRetry();
      appStateSub?.remove();
      appStateSub = null;
      socket?.disconnect();
      setStatus('idle');
    }
  };
}

/** Joins a room's broadcast channel; re-joined automatically after reconnects. */
export function joinChatRoom(roomId: string): () => void {
  const count = joinedRooms.get(roomId) ?? 0;
  joinedRooms.set(roomId, count + 1);
  if (count === 0 && socket?.connected) joinOnSocket(roomId);
  let left = false;
  return () => {
    if (left) return;
    left = true;
    const remaining = (joinedRooms.get(roomId) ?? 1) - 1;
    if (remaining > 0) {
      joinedRooms.set(roomId, remaining);
      return;
    }
    joinedRooms.delete(roomId);
    if (socket?.connected) socket.emit('chat:leave', { roomId });
  };
}

export function onChatEvent(event: string, listener: Listener): () => void {
  const listeners = eventListeners.get(event) ?? new Set<Listener>();
  listeners.add(listener);
  eventListeners.set(event, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) eventListeners.delete(event);
  };
}

export function emitTyping(roomId: string, active: boolean) {
  if (socket?.connected) socket.emit('chat:typing', { roomId, active });
}

export function getChatSocketStatus(): ChatSocketStatus {
  return status;
}

export function subscribeChatSocketStatus(listener: (status: ChatSocketStatus) => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Forces a fresh connection, e.g. after the user signs in with a new token. */
export function reconnectChatSocket() {
  if (!socket || !users) return;
  clearRetry();
  retryAttempt = 0;
  socket.disconnect();
  setStatus('connecting');
  socket.connect();
}
