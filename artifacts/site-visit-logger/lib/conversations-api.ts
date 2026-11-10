import { apiRequest } from '@/lib/api';

/**
 * Client for the price negotiation endpoints (`/api/v1/conversations`).
 * Types mirror `ConversationsService.toResponse` in the backend.
 *
 * Backend rules worth knowing in the UI:
 * - A conversation starts PENDING until the assigned technician accepts the
 *   job request (-> NEGOTIATING) or declines it (-> DECLINED).
 * - Posting an offer supersedes the outstanding one (a counter-offer).
 * - Accepting an offer -> AGREED; declining an offer -> DECLINED (closed).
 * - Each side may post at most 3 offers, 6 in total; offers expire after 24h.
 */

export type ConversationStatus = 'PENDING' | 'NEGOTIATING' | 'AGREED' | 'DECLINED' | 'EXPIRED';
export type ConversationSender = 'CUSTOMER' | 'TECHNICIAN' | 'SYSTEM';
export type ConversationMessageType =
  | 'SERVICE_REQUEST'
  | 'TEXT'
  | 'PRICE_OFFER'
  | 'SYSTEM'
  | 'TECHNICIAN_RESPONSE';
export type PriceOfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED' | 'EXPIRED';

export const CONVERSATION_MAX_OFFERS_PER_SIDE = 3;
export const CONVERSATION_MAX_TOTAL_OFFERS = 6;
export const CONVERSATION_MAX_MESSAGE_LENGTH = 500;
export const CONVERSATION_MAX_AMOUNT = 2_000_000_000;

export interface ConversationParty {
  id: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  profilePictureUrl?: string;
}

export interface ConversationRequest {
  service: string | null;
  description: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
}

export interface PriceOfferItem {
  id: string;
  amount: number;
  currency: string;
  senderRole: 'CUSTOMER' | 'TECHNICIAN';
  status: PriceOfferStatus;
  notes: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface ConversationMessageItem {
  id: string;
  senderId: string | null;
  senderRole: ConversationSender;
  type: ConversationMessageType;
  text: string | null;
  /** SERVICE_REQUEST snapshot, or `{ decision, reason }` for TECHNICIAN_RESPONSE. */
  metadata: Record<string, unknown> | null;
  createdAt: string;
  offer: PriceOfferItem | null;
}

export interface BackendConversation {
  id: string;
  jobId: string;
  status: ConversationStatus;
  currency: string;
  agreedAmount: number | null;
  offerCount: number;
  declinedById: string | null;
  declineReason: string | null;
  startedAt: string;
  lastMessageAt: string;
  closedAt: string | null;
  request: ConversationRequest;
  customer: ConversationParty;
  technician: ConversationParty | null;
  currentOffer: PriceOfferItem | null;
  messages: ConversationMessageItem[];
}

export interface PaginatedConversations {
  data: BackendConversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** True when the technician declined the job request (as opposed to an offer). */
export function wasJobRequestDeclined(conversation: BackendConversation): boolean {
  for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
    const message = conversation.messages[i];
    if (message.type === 'TECHNICIAN_RESPONSE') return message.metadata?.decision === 'DECLINED';
  }
  return false;
}

// ─── Conversations API ───────────────────────────────────────────────────

export async function listConversations(page = 1, limit = 50): Promise<BackendConversation[]> {
  const res = await apiRequest<PaginatedConversations | BackendConversation[]>(
    `/api/v1/conversations?page=${page}&limit=${limit}`,
    { authenticated: true },
  );
  if (Array.isArray(res)) return res;
  return res.data ?? [];
}

export async function openJobConversation(jobId: string): Promise<BackendConversation> {
  return apiRequest<BackendConversation>('/api/v1/conversations', {
    method: 'POST',
    authenticated: true,
    body: { jobId },
  });
}

export async function getConversation(conversationId: string): Promise<BackendConversation> {
  return apiRequest<BackendConversation>(`/api/v1/conversations/${conversationId}`, {
    authenticated: true,
  });
}

export async function acceptJobRequestInConversation(conversationId: string): Promise<BackendConversation> {
  return apiRequest<BackendConversation>(`/api/v1/conversations/${conversationId}/job-request/accept`, {
    method: 'POST',
    authenticated: true,
  });
}

export async function declineJobRequestInConversation(
  conversationId: string,
  reason?: string,
): Promise<BackendConversation> {
  return apiRequest<BackendConversation>(`/api/v1/conversations/${conversationId}/job-request/decline`, {
    method: 'POST',
    authenticated: true,
    body: { reason },
  });
}

export async function sendConversationMessage(conversationId: string, text: string): Promise<BackendConversation> {
  return apiRequest<BackendConversation>(`/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    authenticated: true,
    body: { text },
  });
}

export async function sendPriceOffer(
  conversationId: string,
  amount: number,
  notes?: string,
): Promise<BackendConversation> {
  return apiRequest<BackendConversation>(`/api/v1/conversations/${conversationId}/offers`, {
    method: 'POST',
    authenticated: true,
    body: { amount, notes },
  });
}

export async function acceptPriceOffer(conversationId: string, offerId: string): Promise<BackendConversation> {
  return apiRequest<BackendConversation>(`/api/v1/conversations/${conversationId}/offers/${offerId}/accept`, {
    method: 'POST',
    authenticated: true,
  });
}

export async function declinePriceOffer(
  conversationId: string,
  offerId: string,
  reason?: string,
): Promise<BackendConversation> {
  return apiRequest<BackendConversation>(`/api/v1/conversations/${conversationId}/offers/${offerId}/decline`, {
    method: 'POST',
    authenticated: true,
    body: { reason },
  });
}
