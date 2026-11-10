import { useEffect, useState } from 'react';
import {
  acquireChatSocket,
  getChatSocketStatus,
  subscribeChatSocketStatus,
  type ChatSocketStatus,
} from '@/lib/chat-socket';

/**
 * Keeps the shared chat socket alive while the calling screen is mounted and
 * reports its connection status. Pass `enabled = false` to skip connecting
 * (e.g. before the user is signed in).
 */
export function useChatSocketStatus(enabled = true): ChatSocketStatus {
  const [status, setStatus] = useState<ChatSocketStatus>(getChatSocketStatus());

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeChatSocketStatus(setStatus);
    const release = acquireChatSocket();
    setStatus(getChatSocketStatus());
    return () => {
      unsubscribe();
      release();
    };
  }, [enabled]);

  return status;
}
