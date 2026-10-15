import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Coordinates } from '@/lib/location';

export type ServiceRequestDetails = {
  id: string;
  serviceName: string;
  problem: string;
  address: string;
  landmark?: string;
  distance?: string;
  latitude?: number;
  longitude?: number;
  thumbnailUri?: string;
  photos: string[];
  videos: string[];
  createdAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
};

export type ServiceOffer = {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'ACCEPTED' | 'COUNTERED' | 'DECLINED' | 'SUPERSEDED';
  senderRole: 'client' | 'technician';
  notes?: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'technician';
  text: string;
  timestamp: string;
  serviceRequest?: ServiceRequestDetails;
  priceOffer?: ServiceOffer;
};

export type ChatThread = {
  id: string;
  jobId?: string;
  ownerPhone?: string;
  clientPhone?: string;
  technicianPhone?: string;
  clientName?: string;
  technicianName?: string;
  technicianLocation?: Coordinates;
  isAccepted?: boolean;
  isEnded?: boolean;
  otherParticipantName: string;
  otherParticipantRole: 'client' | 'technician';
  lastMessage: string;
  lastMessageTime: string;
  agreedPrice?: number;
  messages: ChatMessage[];
};

type ChatContextValue = {
  threads: ChatThread[];
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  sendMessage: (threadId: string, text: string) => Promise<void>;
  updateRequestStatus: (threadId: string, requestId: string, status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED') => Promise<void>;
  sendPriceOffer: (threadId: string, amount: number, notes?: string, senderRole?: 'client' | 'technician') => Promise<void>;
  respondToOffer: (threadId: string, offerId: string, status: 'ACCEPTED' | 'DECLINED') => Promise<void>;
  acceptRequestThread: (threadId: string) => Promise<void>;
  endRequestThread: (threadId: string) => Promise<void>;
  createOrGetThread: (
    otherName: string,
    role: 'client' | 'technician',
    jobId?: string,
    requestDetails?: ServiceRequestDetails,
    otherPhone?: string,
    technicianLocation?: Coordinates,
  ) => string;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const CHAT_STORAGE_KEY = '@fundi/chats';

export function ChatProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const storageKey = account ? `${CHAT_STORAGE_KEY}/${account.phone}` : null;

  useEffect(() => {
    if (!storageKey) {
      setThreads([]);
      return;
    }
    let mounted = true;
    setThreads([]);
    const loadThreads = async () => {
      try {
        const sharedRaw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        const raw = sharedRaw ?? (await AsyncStorage.getItem(storageKey));
        const parsed = raw ? (JSON.parse(raw) as ChatThread[]) : [];
        const stored = sharedRaw === null
          ? parsed.map((thread) => ({ ...thread, ownerPhone: account?.phone }))
          : parsed;
        const owned = stored
          .filter(
            (thread) =>
              thread.clientPhone === account?.phone ||
              thread.technicianPhone === account?.phone ||
              thread.ownerPhone === account?.phone,
          )
          .map((thread) => {
            if (thread.clientPhone === account?.phone) {
              return {
                ...thread,
                otherParticipantName: thread.technicianName ?? thread.otherParticipantName,
                otherParticipantRole: 'technician' as const,
              };
            }
            if (thread.technicianPhone === account?.phone) {
              return {
                ...thread,
                otherParticipantName: thread.clientName ?? thread.otherParticipantName,
                otherParticipantRole: 'client' as const,
              };
            }
            return { ...thread, ownerPhone: account?.phone };
          });
        if (mounted) setThreads(owned);
      } catch {
        if (mounted) setThreads([]);
      }
    };
    void loadThreads();
    return () => {
      mounted = false;
    };
  }, [storageKey, account?.phone]);

  const persistThreads = async (updated: ChatThread[]) => {
    setThreads(updated);
    if (storageKey && account) {
      try {
        const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        const allThreads = raw ? (JSON.parse(raw) as ChatThread[]) : [];
        const updatedById = new Map(updated.map((thread) => [thread.id, thread]));
        const merged = allThreads.map((thread) => updatedById.get(thread.id) ?? thread);
        const knownIds = new Set(allThreads.map((thread) => thread.id));
        for (const thread of updated) {
          if (!knownIds.has(thread.id)) merged.push(thread);
        }
        await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      }
    }
  };

  const sendMessage = useCallback(
    async (threadId: string, text: string) => {
      if (!account) return;
      const now = new Date().toISOString();
      const newMessage: ChatMessage = {
        id: 'msg-' + Date.now(),
        senderId: account.id,
        senderName: account.name,
        senderRole: account.role === 'TECHNICIAN' ? 'technician' : 'client',
        text,
        timestamp: now,
      };

      const updated = threads.map((thread) => {
        if (thread.id === threadId) {
          return {
            ...thread,
            lastMessage: text,
            lastMessageTime: now,
            messages: [...thread.messages, newMessage],
          };
        }
        return thread;
      });

      await persistThreads(updated);
    },
    [account, threads],
  );

  const updateRequestStatus = useCallback(
    async (threadId: string, requestId: string, status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED') => {
      const now = new Date().toISOString();
      const updated = threads.map((thread) => {
        if (thread.id === threadId) {
          const updatedMessages = thread.messages.map((msg) => {
            if (msg.serviceRequest && msg.serviceRequest.id === requestId) {
              return {
                ...msg,
                serviceRequest: {
                  ...msg.serviceRequest,
                  status,
                },
              };
            }
            return msg;
          });
          return {
            ...thread,
            isAccepted: status === 'ACCEPTED' ? true : thread.isAccepted,
            isEnded:
              status === 'COMPLETED' || status === 'CANCELLED' || status === 'DECLINED'
                ? true
                : thread.isEnded,
            lastMessage: `Request status updated to ${status}`,
            lastMessageTime: now,
            messages: updatedMessages,
          };
        }
        return thread;
      });
      await persistThreads(updated);
    },
    [threads],
  );

  const sendPriceOffer = useCallback(
    async (threadId: string, amount: number, notes?: string, senderRoleOverride?: 'client' | 'technician') => {
      if (!account) return;
      const now = new Date().toISOString();
      const senderRole = senderRoleOverride ?? (account.role === 'TECHNICIAN' ? 'technician' : 'client');
      
      const newOffer: ServiceOffer = {
        id: 'offer-' + Date.now(),
        amount,
        currency: 'RWF',
        status: 'PENDING',
        senderRole,
        notes,
        createdAt: now,
      };

      const newMessage: ChatMessage = {
        id: 'msg-offer-' + Date.now(),
        senderId: account.id,
        senderName: account.name,
        senderRole,
        text: `Proposed service cost: RWF ${amount.toLocaleString()}`,
        timestamp: now,
        priceOffer: newOffer,
      };

      const updated = threads.map((thread) => {
        if (thread.id === threadId) {
          // Supersede previous pending offers
          const updatedMessages = thread.messages.map((msg) => {
            if (msg.priceOffer && msg.priceOffer.status === 'PENDING') {
              return {
                ...msg,
                priceOffer: { ...msg.priceOffer, status: 'SUPERSEDED' as const },
              };
            }
            return msg;
          });

          return {
            ...thread,
            lastMessage: `Service offer: RWF ${amount.toLocaleString()}`,
            lastMessageTime: now,
            messages: [...updatedMessages, newMessage],
          };
        }
        return thread;
      });

      await persistThreads(updated);
    },
    [account, threads],
  );

  const respondToOffer = useCallback(
    async (threadId: string, offerId: string, status: 'ACCEPTED' | 'DECLINED') => {
      const now = new Date().toISOString();
      let agreedPriceVal: number | undefined = undefined;

      const updated = threads.map((thread) => {
        if (thread.id === threadId) {
          let targetAmount = 0;
          const updatedMessages = thread.messages.map((msg) => {
            if (msg.priceOffer && msg.priceOffer.id === offerId) {
              targetAmount = msg.priceOffer.amount;
              if (status === 'ACCEPTED') {
                agreedPriceVal = targetAmount;
              }
              return {
                ...msg,
                priceOffer: { ...msg.priceOffer, status },
              };
            }
            return msg;
          });

          return {
            ...thread,
            agreedPrice: status === 'ACCEPTED' ? targetAmount : thread.agreedPrice,
            lastMessage: status === 'ACCEPTED' ? `Offer accepted: RWF ${targetAmount.toLocaleString()}` : 'Offer declined',
            lastMessageTime: now,
            messages: updatedMessages,
          };
        }
        return thread;
      });

      await persistThreads(updated);
    },
    [threads],
  );

  const acceptRequestThread = useCallback(
    async (threadId: string) => {
      const now = new Date().toISOString();
      const updated = threads.map((item) =>
        item.id === threadId
          ? {
              ...item,
              isAccepted: true,
              lastMessage: 'Request accepted.',
              lastMessageTime: now,
              messages: [
                ...item.messages,
                {
                  id: `msg-accepted-${Date.now()}`,
                  senderId: 'system',
                  senderName: 'System',
                  senderRole: 'technician' as const,
                  text: 'The technician accepted this service request.',
                  timestamp: now,
                },
              ],
            }
          : item,
      );
      await persistThreads(updated);
    },
    [threads],
  );

  const endRequestThread = useCallback(
    async (threadId: string) => {
      const now = new Date().toISOString();
      const updated = threads.map((item) =>
        item.id === threadId
          ? {
              ...item,
              isEnded: true,
              lastMessage: 'Request ended by the client.',
              lastMessageTime: now,
              messages: [
                ...item.messages,
                {
                  id: `msg-ended-${Date.now()}`,
                  senderId: 'system',
                  senderName: 'System',
                  senderRole: 'client' as const,
                  text: 'The client ended this service request.',
                  timestamp: now,
                },
              ],
            }
          : item,
      );
      await persistThreads(updated);
    },
    [threads],
  );

  const createOrGetThread = useCallback(
    (
      otherName: string,
      role: 'client' | 'technician',
      jobId?: string,
      requestDetails?: ServiceRequestDetails,
      otherPhone?: string,
      technicianLocation?: Coordinates,
    ) => {
      const existing = jobId
        ? threads.find((thread) => thread.jobId === jobId)
        : threads.find((thread) => thread.otherParticipantName === otherName);
      if (existing) return existing.id;

      const newThreadId = 'thread-' + Date.now();
      const now = new Date().toISOString();

      const initialMessage: ChatMessage = requestDetails ? {
        id: 'msg-req-' + Date.now(),
        senderId: account?.id ?? 'client',
        senderName: account?.name ?? 'Client',
        senderRole: 'client',
        text: `Service request submitted for ${requestDetails.serviceName}`,
        timestamp: now,
        serviceRequest: requestDetails,
      } : {
        id: 'msg-init-' + Date.now(),
        senderId: 'system',
        senderName: 'System',
        senderRole: 'client',
        text: 'Connected successfully. You can now chat and settle the service price.',
        timestamp: now,
      };

      const newThread: ChatThread = {
        id: newThreadId,
        jobId,
        ownerPhone: account?.phone,
        clientPhone: account?.role === 'TECHNICIAN' ? otherPhone : account?.phone,
        technicianPhone: account?.role === 'TECHNICIAN' ? account.phone : otherPhone,
        clientName: account?.role === 'TECHNICIAN' ? otherName : account?.name,
        technicianName: account?.role === 'TECHNICIAN' ? account.name : otherName,
        technicianLocation,
        isAccepted: false,
        isEnded: false,
        otherParticipantName: otherName,
        otherParticipantRole: role,
        lastMessage: requestDetails ? `Service request: ${requestDetails.serviceName}` : 'Conversation started.',
        lastMessageTime: now,
        messages: [initialMessage],
      };

      void persistThreads([...threads, newThread]);
      return newThreadId;
    },
    [threads, account],
  );

  const value = useMemo(
    () => ({
      threads,
      activeThreadId,
      setActiveThreadId,
      sendMessage,
      updateRequestStatus,
      sendPriceOffer,
      respondToOffer,
      acceptRequestThread,
      endRequestThread,
      createOrGetThread,
    }),
    [threads, activeThreadId, sendMessage, updateRequestStatus, sendPriceOffer, respondToOffer, acceptRequestThread, endRequestThread, createOrGetThread],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside ChatProvider');
  return context;
}