import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';
import { useNotifications } from '@/context/NotificationContext';
import type { BookingFee, JobStatus, RequestLifecycleStatus, RequestType, ServiceRequest } from '@/constants/jobs';
import type { Coordinates } from '@/lib/location';

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
  cancelledByRole?: 'client' | 'technician';
  cancelledByName?: string;
  cancelledById?: string;
};

type ChatContextValue = {
  threads: ChatThread[];
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  sendMessage: (threadId: string, text: string, imageUri?: string) => Promise<void>;
  updateRequestStatus: (threadId: string, requestId: string, status: RequestLifecycleStatus, reason?: string) => Promise<void>;
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

function recipientPhones(thread: ChatThread): string[] {
  return [thread.clientPhone, thread.technicianPhone].filter((phone): phone is string => !!phone);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const { getJob, acceptOffer, cancelJob, findAnotherTechnician } = useFundi();
  const { addNotification } = useNotifications();
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
            const messages = thread.messages.map((message) => {
              if (!message.serviceRequest) return message;
              const oldStatus = message.serviceRequest.status as string;
              const status: RequestLifecycleStatus =
                oldStatus === 'PENDING' ? 'PENDING_RESPONSE' :
                oldStatus === 'COMPLETED' ? 'ACCEPTED' :
                oldStatus as RequestLifecycleStatus;
              return {
                ...message,
                serviceRequest: { ...message.serviceRequest, status },
              };
            });
            const hadCompletedRequest = thread.messages.some(
              (message) => (message.serviceRequest?.status as string | undefined) === 'COMPLETED',
            );
            if (thread.clientPhone === account?.phone) {
              return {
                ...thread,
                messages,
                isEnded: thread.isEnded || hadCompletedRequest,
                otherParticipantName: thread.technicianName ?? thread.otherParticipantName,
                otherParticipantRole: 'technician' as const,
              };
            }
            if (thread.technicianPhone === account?.phone) {
              return {
                ...thread,
                messages,
                isEnded: thread.isEnded || hadCompletedRequest,
                otherParticipantName: thread.clientName ?? thread.otherParticipantName,
                otherParticipantRole: 'client' as const,
              };
            }
            return { ...thread, messages, isEnded: thread.isEnded || hadCompletedRequest, ownerPhone: account?.phone };
          });
        if (mounted) setThreads(owned);
      } catch (error) {
        console.error('Unable to load chat threads.', error);
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
      } catch (sharedStorageError) {
        console.warn('Shared chat storage is unavailable; using account-scoped storage.', sharedStorageError);
        try {
          await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (accountStorageError) {
          console.error('Unable to persist chat threads.', accountStorageError);
          throw accountStorageError;
        }
      }
    }
  };

  const sendMessage = useCallback(
    async (threadId: string, text: string, imageUri?: string) => {
      if (!account) return;
      const now = new Date().toISOString();
      const newMessage: ChatMessage = {
        id: 'msg-' + Date.now(),
        senderId: account.id,
        senderName: account.name,
        senderRole: account.role === 'TECHNICIAN' ? 'technician' : 'client',
        text: text || (imageUri ? 'Photo attachment' : ''),
        imageUri,
        timestamp: now,
      };

      const lastSnippet = text || (imageUri ? '📷 Photo attachment' : '');

      const updated = threads.map((thread) => {
        if (thread.id === threadId) {
          return {
            ...thread,
            lastMessage: lastSnippet,
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
    async (threadId: string, requestId: string, status: RequestLifecycleStatus, reason?: string) => {
      const now = new Date().toISOString();
      const sourceThread = threads.find((thread) => thread.id === threadId);
      const sourceRequest = sourceThread?.messages.find((message) => message.serviceRequest?.id === requestId)?.serviceRequest;
      if (!sourceThread || !sourceRequest) throw new Error('This service request is no longer available.');
      if (sourceThread.isAccepted || sourceRequest.status === 'ACCEPTED') {
        if (status !== 'CANCELLED') return;
      }
      if (sourceThread.isEnded) return;
      if (sourceRequest.status === status) return;
      if (status === 'DECLINED' && !reason?.trim()) throw new Error('Provide a reason for declining this request.');

      const reasonText = reason?.trim();
      const initiatorRole: 'technician' | 'client' = account?.role === 'TECHNICIAN' ? 'technician' : 'client';
      const initiatorName = account?.name ?? (initiatorRole === 'technician' ? 'Technician' : 'Client');
      const initiatorId = account?.id;
      const cancelledRole: 'technician' | 'client' | undefined = status === 'DECLINED' ? 'technician' : status === 'CANCELLED' ? initiatorRole : undefined;
      const cancelledName = status === 'DECLINED' ? (initiatorRole === 'technician' ? initiatorName : sourceThread.technicianName ?? 'Technician') : status === 'CANCELLED' ? initiatorName : undefined;
      const cancelledId = status === 'DECLINED' ? (initiatorRole === 'technician' ? initiatorId : undefined) : status === 'CANCELLED' ? initiatorId : undefined;

      const allowedTransitions: Record<RequestLifecycleStatus, RequestLifecycleStatus[]> = {
        REQUEST_RECEIVED: ['OFFER_MADE', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
        PENDING_RESPONSE: ['OFFER_MADE', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
        OFFER_MADE: ['OFFER_MADE', 'ACCEPTED', 'DECLINED', 'CANCELLED'],
        ACCEPTED: ['CANCELLED', 'DISPATCHED', 'ACTIVE'],
        PAYMENT_PENDING: ['CANCELLED', 'DISPATCHED', 'ACTIVE'],
        DISPATCHED: ['CANCELLED', 'ACTIVE'],
        ACTIVE: ['CANCELLED'],
        DECLINED: [],
        CANCELLED: [],
      };
      if (!allowedTransitions[sourceRequest.status].includes(status)) return;
      const statusText =
        status === 'ACCEPTED' ? 'The technician accepted this service request.' :
        status === 'DECLINED' ? `The technician declined this request${reasonText ? `: ${reasonText}` : '.'}` :
        status === 'CANCELLED' ? (initiatorRole === 'client' ? 'The client cancelled this service request.' : 'The technician cancelled this service request.') :
        status === 'OFFER_MADE' ? 'A service offer was made.' :
        'The request is waiting for a technician response.';
      const updated: ChatThread[] = threads.map((thread) => {
        if (thread.id !== threadId) return thread;
        const updatedMessages: ChatMessage[] = thread.messages.map((message) =>
          message.serviceRequest?.id === requestId
            ? {
                ...message,
                serviceRequest: {
                  ...message.serviceRequest,
                  status,
                  ...(status === 'DECLINED' && reasonText ? { declineReason: reasonText } : {}),
                  ...(cancelledRole ? { cancelledByRole: cancelledRole, cancelledByName: cancelledName, cancelledById: cancelledId } : {}),
                },
              }
            : message,
        );
        const newMsg: ChatMessage = {
          id: `msg-status-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderRole: initiatorRole,
          cancelledByRole: cancelledRole,
          cancelledByName: cancelledName,
          cancelledById: cancelledId,
          text: statusText,
          timestamp: now,
        };
        return {
          ...thread,
          isAccepted: status === 'ACCEPTED' ? true : status === 'CANCELLED' || status === 'DECLINED' ? false : thread.isAccepted,
          isEnded: status === 'CANCELLED' || status === 'DECLINED' ? true : status === 'ACCEPTED' ? false : thread.isEnded,
          ...(cancelledRole ? { cancelledByRole: cancelledRole, cancelledByName: cancelledName, cancelledById: cancelledId } : {}),
          lastMessage: statusText,
          lastMessageTime: now,
          messages: [
            ...updatedMessages,
            newMsg,
          ],
        };
      });
      await persistThreads(updated);

      const jobId = sourceThread.jobId;
      const relatedJob = jobId ? getJob(jobId) : undefined;
      const updatesJob = !!relatedJob && relatedJob.status === 'OFFERED' &&
        (status === 'ACCEPTED' || status === 'DECLINED');
      const cancelsJob = !!relatedJob && ['REQUESTED', 'MATCHING', 'OFFERED'].includes(relatedJob.status) &&
        status === 'CANCELLED';
      if ((updatesJob || cancelsJob) && jobId) {
        if (status === 'ACCEPTED') acceptOffer(jobId);
        else if (status === 'DECLINED') findAnotherTechnician(jobId);
        else if (cancelsJob) {
          const job = getJob(jobId);
          if (job && job.status !== 'CANCELLED') cancelJob(jobId, recipientPhones(sourceThread));
        }
      }

      const title =
        status === 'ACCEPTED' ? 'Technician accepted your request' :
        status === 'DECLINED' ? 'Technician declined your request' :
        status === 'CANCELLED' ? 'Request cancelled' :
        status === 'OFFER_MADE' ? 'Technician sent an offer' :
        'Request is awaiting a response';
      if (!(updatesJob && status === 'ACCEPTED') && !cancelsJob) {
        addNotification({
          id: `request-${threadId}-${Date.now()}`,
          jobId: sourceThread.jobId,
          threadId,
          status,
          service: sourceRequest.serviceName,
          title,
          text: statusText,
          at: now,
          recipientPhones: recipientPhones(sourceThread),
        });
      }
    },
    [acceptOffer, account?.role, addNotification, cancelJob, findAnotherTechnician, getJob, threads],
  );

  const sendPriceOffer = useCallback(
    async (threadId: string, amount: number, notes?: string, senderRoleOverride?: 'client' | 'technician') => {
      if (!account) return;
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an offer amount greater than zero.');
      const sourceThread = threads.find((thread) => thread.id === threadId);
      if (!sourceThread) throw new Error('This conversation is no longer available.');
      if (
        sourceThread.messages.some((message) => message.priceOffer?.status === 'ACCEPTED')
      ) {
        throw new Error('An offer has already been accepted. No further offers can be made.');
      }
      if (sourceThread.isEnded) throw new Error('This request has ended and cannot receive new offers.');

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
            messages: updatedMessages.map((message) =>
              message.serviceRequest
                ? { ...message, serviceRequest: { ...message.serviceRequest, status: 'OFFER_MADE' as const } }
                : message,
            ).concat(newMessage),
          };
        }
        return thread;
      });

      await persistThreads(updated);
      const request = sourceThread.messages.find((message) => message.serviceRequest)?.serviceRequest;
      addNotification({
        id: `request-${threadId}-${Date.now()}`,
        jobId: sourceThread.jobId,
        threadId,
        status: 'OFFER_MADE',
        service: request?.serviceName ?? (sourceThread.jobId ? getJob(sourceThread.jobId)?.service : undefined) ?? 'Service offer',
        title: 'A service offer was made',
        text: `A service offer of RWF ${amount.toLocaleString()} is ready to review.`,
        at: now,
        recipientPhones: recipientPhones(sourceThread),
      });
    },
    [account, addNotification, getJob, threads],
  );

  const respondToOffer = useCallback(
    async (threadId: string, offerId: string, status: 'ACCEPTED' | 'DECLINED') => {
      const now = new Date().toISOString();
      const sourceThread = threads.find((thread) => thread.id === threadId);
      const sourceOffer = sourceThread?.messages.find((message) => message.priceOffer?.id === offerId)?.priceOffer;
      if (!sourceThread || !sourceOffer || sourceOffer.status !== 'PENDING') return;
      if (
        status === 'ACCEPTED' &&
        sourceThread.messages.some((message) => message.priceOffer?.status === 'ACCEPTED')
      ) return;

      const updated = threads.map((thread) => {
        if (thread.id === threadId) {
          const targetAmount = sourceOffer.amount;
          const updatedMessages = thread.messages.map((msg) => {
            if (msg.priceOffer && msg.priceOffer.id === offerId) {
              return {
                ...msg,
                priceOffer: { ...msg.priceOffer, status },
              };
            }
            if (status === 'ACCEPTED' && msg.serviceRequest) {
              return { ...msg, serviceRequest: { ...msg.serviceRequest, status: 'ACCEPTED' as const } };
            }
            return msg;
          });

          return {
            ...thread,
            isAccepted: status === 'ACCEPTED' ? true : thread.isAccepted,
            isEnded: status === 'ACCEPTED' ? false : thread.isEnded,
            agreedPrice: status === 'ACCEPTED' ? targetAmount : thread.agreedPrice,
            lastMessage: status === 'ACCEPTED' ? `Offer accepted: RWF ${targetAmount.toLocaleString()}` : 'Offer declined',
            lastMessageTime: now,
            messages: updatedMessages,
          };
        }
        return thread;
      });

      await persistThreads(updated);
      if (status === 'ACCEPTED') {
        const request = sourceThread.messages.find((message) => message.serviceRequest)?.serviceRequest;
        addNotification({
          id: `request-${threadId}-${Date.now()}`,
          jobId: sourceThread.jobId,
          threadId,
          status: 'ACCEPTED',
          service: request?.serviceName ?? (sourceThread.jobId ? getJob(sourceThread.jobId)?.service : undefined) ?? 'Service offer',
          title: 'Service offer accepted',
          text: `The service offer of RWF ${sourceOffer.amount.toLocaleString()} was accepted.`,
          at: now,
          recipientPhones: recipientPhones(sourceThread),
        });
      }
    },
    [addNotification, getJob, threads],
  );

  const acceptRequestThread = useCallback(
    async (threadId: string) => {
      const request = threads
        .find((thread) => thread.id === threadId)
        ?.messages.find((message) => message.serviceRequest)?.serviceRequest;
      if (request) {
        await updateRequestStatus(threadId, request.id, 'ACCEPTED');
        return;
      }
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
    [threads, updateRequestStatus],
  );

  const endRequestThread = useCallback(
    async (threadId: string) => {
      const now = new Date().toISOString();
      const initiatorRole: 'technician' | 'client' = account?.role === 'TECHNICIAN' ? 'technician' : 'client';
      const initiatorName = account?.name ?? (initiatorRole === 'technician' ? 'Technician' : 'Client');
      const initiatorId = account?.id;
      const updated: ChatThread[] = threads.map((item) =>
        item.id === threadId
          ? {
              ...item,
              isEnded: true,
              cancelledByRole: initiatorRole,
              cancelledByName: initiatorName,
              cancelledById: initiatorId,
              lastMessage: 'The client ended this service request.',
              lastMessageTime: now,
              messages: [
                ...item.messages,
                {
                  id: `msg-ended-${Date.now()}`,
                  senderId: 'system',
                  senderName: 'System',
                  senderRole: initiatorRole,
                  cancelledByRole: initiatorRole,
                  cancelledByName: initiatorName,
                  cancelledById: initiatorId,
                  text: 'The client ended this service request.',
                  timestamp: now,
                },
              ],
            }
          : item,
      );
      await persistThreads(updated);
    },
    [account, threads],
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
        ? threads.find((thread) => thread.jobId === jobId && !thread.isEnded)
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
        isAccepted: requestDetails?.status === 'ACCEPTED',
        isEnded: false,
        otherParticipantName: otherName,
        otherParticipantRole: role,
        lastMessage: requestDetails ? `Service request: ${requestDetails.serviceName}` : 'Conversation started.',
        lastMessageTime: now,
        messages: [initialMessage],
      };

      void persistThreads([...threads, newThread]).catch((error: unknown) => {
        console.error('Unable to persist the new chat thread.', error);
      });
      if (requestDetails?.status === 'REQUEST_RECEIVED' || requestDetails?.status === 'PENDING_RESPONSE') {
        addNotification({
          id: `request-${newThreadId}-pending`,
          jobId,
          threadId: newThreadId,
          status: requestDetails.status,
          service: requestDetails.serviceName,
          title: 'Request received by technician',
          text: 'Your request is waiting in the selected technician’s chat.',
          at: now,
          recipientPhones: recipientPhones(newThread),
        });
      }
      return newThreadId;
    },
    [threads, account, addNotification],
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