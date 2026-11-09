import { apiRequest } from '@/lib/api';

export type ConversationStatus =
  | 'WAITING_FOR_TECHNICIAN'
  | 'NEGOTIATING'
  | 'AGREED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ConversationParty {
  id: string;
  fullName: string;
  phoneNumber?: string;
  role?: string;
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
  notes?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED' | 'EXPIRED';
  offeredById: string;
  offeredByRole?: string;
  createdAt: string;
  respondedAt?: string | null;
}

export interface ConversationMessageItem {
  id: string;
  conversationId: string;
  senderId?: string;
  sender?: {
    id: string;
    fullName: string;
    role: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
  };
  type: 'REQUEST_DETAILS' | 'MESSAGE' | 'PRICE_OFFER' | 'ACCEPTANCE' | 'DECLINE';
  text: string;
  offer?: PriceOfferItem | null;
  createdAt: string;
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
