/**
 * Price negotiation threads backed by `/api/v1/conversations`.
 *
 * This context only covers the structured pre-assignment negotiation
 * (request card, technician accept/decline, price offers). General job chat
 * between a customer and the assigned technician lives in `/api/v1/chat/rooms`
 * and is handled by `hooks/useChatRooms.ts` and `hooks/useChatRoom.ts`.
 *
 * All state is fetched from the backend; nothing is persisted locally.
 */
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';
import type { BookingFee, RequestLifecycleStatus, RequestType } from '@/constants/jobs';
import type { Coordinates } from '@/lib/location';
import {
  acceptJobRequestInConversation,
  acceptPriceOffer as apiAcceptPriceOffer,
  declineJobRequestInConversation,
  declinePriceOffer as apiDeclinePriceOffer,
  listConversations,
  openJobConversation,
  sendConversationMessage,
  sendPriceOffer as apiSendPriceOffer,
  type BackendConversation,
} from '@/lib/conversations-api';

export type { ServiceRequest } from '@/constants/jobs';

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
  status: RequestLifecycleStatus;
  type?: RequestType;
  bookingFee?: BookingFee;
  chatId?: string;
  declineReason?: string;
  cancelledByRole?: 'client' | 'technician';
  cancelledByName?: string;
  cancelledById?: string;
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
  imageUri?: string;
  serviceRequest?: ServiceRequestDetails;
  priceOffer?: ServiceOffer;
  cancelledByRole?: 'client' | 'technician';
  cancelledByName?: string;
  cancelledById?: string;
  read?: boolean;
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
  otherParticipantAvatarUrl?: string;
  lastMessage: string;
  lastMessageTime: string;
  agreedPrice?: number;
  unreadCount?: number;
  messages: ChatMessage[];
  cancelledByRole?: 'client' | 'technician';
  cancelledByName?: string;
  cancelledById?: string;
};

export function mapBackendConversationToThread(
  conv: BackendConversation,
  currentUserRole?: string,
): ChatThread {
  const isTechnician = currentUserRole === 'TECHNICIAN';
  const otherName = isTechnician
    ? conv.customer?.fullName || 'Client'
    : (conv.technician?.fullName || 'Technician');
  const otherAvatar = isTechnician
    ? conv.customer?.avatarUrl || conv.customer?.profilePictureUrl
    : conv.technician?.avatarUrl || conv.technician?.profilePictureUrl;
  const otherRole: 'client' | 'technician' = isTechnician ? 'client' : 'technician';

  const mappedMessages: ChatMessage[] = conv.messages.map((m) => {
    let priceOffer: ServiceOffer | undefined = undefined;
    if (m.type === 'PRICE_OFFER' && m.offer) {
      priceOffer = {
        id: m.offer.id,
        amount: m.offer.amount,
        currency: m.offer.currency,
        status: m.offer.status as any,
        senderRole: m.offer.senderRole === 'TECHNICIAN' ? 'technician' : 'client',
        notes: m.offer.notes ?? undefined,
        createdAt: m.offer.createdAt,
      };
    }

    let serviceRequest: ServiceRequestDetails | undefined = undefined;
    if (m.type === 'SERVICE_REQUEST' && conv.request) {
      serviceRequest = {
        id: conv.jobId,
        serviceName: conv.request.service || 'Service Request',
        problem: conv.request.description,
        address: conv.request.locationAddress,
        latitude: conv.request.latitude,
        longitude: conv.request.longitude,
        photos: [],
        videos: [],
        createdAt: m.createdAt,
        status: conv.status === 'PENDING' ? 'REQUEST_RECEIVED' : conv.status === 'DECLINED' ? 'DECLINED' : 'ACCEPTED',
        type: 'STANDARD',
      };
    }

    const senderRole = m.senderRole === 'TECHNICIAN' ? 'technician' : 'client';
    const senderParty = m.senderRole === 'TECHNICIAN' ? conv.technician : m.senderRole === 'CUSTOMER' ? conv.customer : null;

    return {
      id: m.id,
      senderId: m.senderId ?? 'system',
      senderName: senderParty?.fullName || (m.senderRole === 'SYSTEM' ? 'System' : senderRole === 'technician' ? 'Technician' : 'Client'),
      senderRole,
      text: m.text ?? '',
      timestamp: m.createdAt,
      priceOffer,
      serviceRequest,
      cancelledByRole: conv.status === 'DECLINED' ? 'technician' : undefined,
      cancelledByName: conv.declinedById ? (isTechnician ? 'Client' : 'Technician') : undefined,
    };
  });

  const lastMsg = mappedMessages[mappedMessages.length - 1];

  return {
    id: conv.id,
    jobId: conv.jobId,
    clientName: conv.customer?.fullName,
    clientPhone: conv.customer?.phoneNumber,
    technicianName: conv.technician?.fullName,
    technicianPhone: conv.technician?.phoneNumber,
    isAccepted: conv.status === 'AGREED' || conv.status === 'NEGOTIATING',
    isEnded: conv.status === 'DECLINED' || conv.status === 'EXPIRED',
    otherParticipantName: otherName,
    otherParticipantRole: otherRole,
    otherParticipantAvatarUrl: otherAvatar,
    lastMessage: lastMsg?.text || (conv.status === 'PENDING' ? 'Waiting for technician to accept' : 'Conversation active'),
    lastMessageTime: conv.lastMessageAt || conv.startedAt,
    agreedPrice: conv.agreedAmount ?? undefined,
    messages: mappedMessages,
    cancelledByRole: conv.status === 'DECLINED' ? 'technician' : undefined,
  };
}

type ChatContextValue = {
  /** Negotiation threads from `/conversations`, newest activity first. */
  threads: ChatThread[];
  isLoading: boolean;
  error: string | null;
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  openConversation: (jobId: string) => Promise<string>;
  findThreadForJob: (jobId: string) => ChatThread | undefined;
  sendMessage: (threadId: string, text: string, imageUri?: string) => Promise<void>;
  markThreadAsRead: (threadId: string) => Promise<void>;
  updateRequestStatus: (threadId: string, requestId: string, status: RequestLifecycleStatus, reason?: string) => Promise<void>;
  sendPriceOffer: (threadId: string, amount: number, notes?: string, senderRole?: 'client' | 'technician') => Promise<void>;
  respondToOffer: (threadId: string, offerId: string, status: 'ACCEPTED' | 'DECLINED') => Promise<void>;
  acceptRequestThread: (threadId: string) => Promise<void>;
  endRequestThread: (threadId: string) => Promise<void>;
  /**
   * Returns the id to navigate to (`/chat/<id>`) for a job. Every job has
   * exactly one chat, addressed by the job id.
   */
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

function sortThreads(list: ChatThread[]): ChatThread[] {
  return [...list].sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
  );
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const { updateJob } = useFundi();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const accountId = account?.id;
  const fallbackRole = account?.role;
  // A technician can also hire, so the side comes from each conversation, not the account.
  const role = useCallback(
    (conversation: BackendConversation) =>
      accountId && conversation.customer?.id
        ? conversation.customer.id === accountId
          ? 'CUSTOMER'
          : 'TECHNICIAN'
        : fallbackRole,
    [accountId, fallbackRole],
  );

  const upsert = useCallback(
    (conversation: BackendConversation) => {
      const mapped = mapBackendConversationToThread(conversation, role(conversation));
      setThreads((current) => sortThreads([mapped, ...current.filter((t) => t.id !== mapped.id)]));
      return mapped;
    },
    [role],
  );

  const refreshConversations = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const conversations = await listConversations();
      setThreads(sortThreads(conversations.map((c) => mapBackendConversationToThread(c, role(c)))));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load negotiations.');
    } finally {
      setIsLoading(false);
    }
  }, [account, role]);

  useEffect(() => {
    setThreads([]);
    setError(null);
    if (account) void refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  const findThreadForJob = useCallback(
    (jobId: string) =>
      threads.find((t) => t.jobId === jobId && !t.isEnded) ?? threads.find((t) => t.jobId === jobId),
    [threads],
  );

  const openConversation = useCallback(
    async (jobId: string): Promise<string> => upsert(await openJobConversation(jobId)).id,
    [upsert],
  );

  const sendMessage = useCallback(
    async (threadId: string, text: string, imageUri?: string) => {
      const body = text.trim();
      if (!body) {
        if (imageUri) throw new Error('Photos can be shared in the job chat once a technician is assigned.');
        return;
      }
      upsert(await sendConversationMessage(threadId, body));
    },
    [upsert],
  );

  const markThreadAsRead = useCallback(async (threadId: string) => {
    setThreads((current) =>
      current.some((t) => t.id === threadId && t.unreadCount)
        ? current.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t))
        : current,
    );
  }, []);

  const updateRequestStatus = useCallback(
    async (threadId: string, _requestId: string, status: RequestLifecycleStatus, reason?: string) => {
      if (status === 'ACCEPTED') {
        upsert(await acceptJobRequestInConversation(threadId));
        return;
      }
      if (status === 'DECLINED') {
        const reasonText = reason?.trim();
        if (!reasonText) throw new Error('Provide a reason for declining this request.');
        upsert(await declineJobRequestInConversation(threadId, reasonText));
        return;
      }
      // Other lifecycle states are driven by the backend; just resync.
      await refreshConversations();
    },
    [upsert, refreshConversations],
  );

  const sendPriceOffer = useCallback(
    async (threadId: string, amount: number, notes?: string) => {
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an offer amount greater than zero.');
      const thread = threads.find((t) => t.id === threadId);
      if (thread?.isEnded) throw new Error('This request has ended and cannot receive new offers.');
      upsert(await apiSendPriceOffer(threadId, amount, notes?.trim() || undefined));
    },
    [threads, upsert],
  );

  const respondToOffer = useCallback(
    async (threadId: string, offerId: string, status: 'ACCEPTED' | 'DECLINED') => {
      const conversation =
        status === 'ACCEPTED'
          ? await apiAcceptPriceOffer(threadId, offerId)
          : await apiDeclinePriceOffer(threadId, offerId);
      const mapped = upsert(conversation);
      if (status === 'ACCEPTED' && mapped.jobId && mapped.agreedPrice) {
        updateJob(mapped.jobId, { agreedPrice: mapped.agreedPrice });
      }
    },
    [upsert, updateJob],
  );

  const acceptRequestThread = useCallback(
    async (threadId: string) => {
      upsert(await acceptJobRequestInConversation(threadId));
    },
    [upsert],
  );

  const endRequestThread = useCallback(
    async (threadId: string) => {
      upsert(await declineJobRequestInConversation(threadId, 'Request ended'));
    },
    [upsert],
  );

  const createOrGetThread = useCallback<ChatContextValue['createOrGetThread']>(
    (_otherName, _role, jobId) => {
      if (!jobId) return threads[0]?.jobId ?? '';
      return jobId;
    },
    [threads],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      threads,
      isLoading,
      error,
      activeThreadId,
      setActiveThreadId,
      refreshConversations,
      openConversation,
      findThreadForJob,
      sendMessage,
      markThreadAsRead,
      updateRequestStatus,
      sendPriceOffer,
      respondToOffer,
      acceptRequestThread,
      endRequestThread,
      createOrGetThread,
    }),
    [
      threads,
      isLoading,
      error,
      activeThreadId,
      refreshConversations,
      openConversation,
      findThreadForJob,
      sendMessage,
      markThreadAsRead,
      updateRequestStatus,
      sendPriceOffer,
      respondToOffer,
      acceptRequestThread,
      endRequestThread,
      createOrGetThread,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside ChatProvider');
  return context;
}