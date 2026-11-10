import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth-session';

/**
 * Shared Socket.IO connection to the backend `/events` namespace.
 *
 * The backend uses it to push account-level events, notably `job:offer` to a
 * technician the moment a client routes a request to them, and
 * `notification:new` to any user. It authenticates with the stored access
 * token on every (re)connect; an unauthenticated socket simply receives
 * nothing, so callers must keep a polling fallback.
 */

type Listener = (payload: any) => void;

let socket: Socket | null = null;
let users = 0;
let appStateSub: { remove: () => void } | null = null;
const listeners = new Map<string, Set<Listener>>();

function handleAppState(next: AppStateStatus) {
  if (next === 'active' && users && socket && !socket.connected) socket.connect();
}

function ensureSocket(): Socket | null {
  if (socket) return socket;
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!base) return null;
  socket = io(`${base}/events`, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
    auth: (cb) => {
      getAccessToken()
        .then((accessToken) => cb({ accessToken: accessToken ?? '' }))
        .catch(() => cb({ accessToken: '' }));
    },
  });
  socket.onAny((event: string, payload: unknown) => {
    listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn(`Events socket listener for ${event} failed.`, error);
      }
    });
  });
  return socket;
}

/** Starts (or reuses) the shared connection. Call the returned function to release it. */
export function acquireEventsSocket(): () => void {
  users += 1;
  const current = ensureSocket();
  if (!appStateSub) appStateSub = AppState.addEventListener('change', handleAppState);
  if (current && !current.connected) current.connect();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users = Math.max(0, users - 1);
    if (users === 0) {
      appStateSub?.remove();
      appStateSub = null;
      socket?.disconnect();
    }
  };
}

export function onAppEvent(event: string, listener: Listener): () => void {
  const set = listeners.get(event) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(event, set);
  return () => {
    set.delete(listener);
    if (!set.size) listeners.delete(event);
  };
}
