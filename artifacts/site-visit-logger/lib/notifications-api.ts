import { apiRequest } from '@/lib/api';

/** Kinds of notification the backend sends (`NotificationType`). */
export type NotificationKind =
  | 'JOB_OFFER'
  | 'JOB_ASSIGNED'
  | 'JOB_ACCEPTED'
  | 'JOB_COMPLETED'
  | 'JOB_CANCELLED'
  | 'CONVERSATION_MESSAGE'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'BROADCAST'
  | 'SYSTEM';

export type ServerNotification = {
  id: string;
  type: NotificationKind;
  title: string;
  body: string;
  data: { jobId?: string; conversationId?: string; [key: string]: unknown } | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationPage = { items: ServerNotification[]; total: number; limit: number; offset: number };

/** The newest notifications for the signed-in account. */
export async function fetchNotifications(limit = 100): Promise<ServerNotification[]> {
  const page = await apiRequest<NotificationPage>(`/api/v1/notifications?limit=${limit}`, { authenticated: true });
  return page.items;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest(`/api/v1/notifications/${id}/read`, { method: 'PATCH', authenticated: true });
}

/** Marks every unread notification about one job as read. */
export async function markJobNotificationsRead(jobId: string): Promise<void> {
  await apiRequest(`/api/v1/notifications/jobs/${jobId}/read`, { method: 'PATCH', authenticated: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest('/api/v1/notifications/read-all', { method: 'PATCH', authenticated: true });
}
