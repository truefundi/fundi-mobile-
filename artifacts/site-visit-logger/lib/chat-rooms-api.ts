import { apiRequest, apiUpload } from '@/lib/api';

/**
 * Client for the job chat endpoints (`/api/v1/chat/rooms`).
 *
 * Job chat is the general messaging channel between a customer and the
 * technician currently assigned to a job. It is intentionally separate from
 * the structured price negotiation in `/api/v1/conversations`
 * (see `lib/conversations-api.ts`).
 *
 * Types mirror `ChatService.roomResponse` / `ChatService.messageResponse` in
 * the backend. Every function throws on failure so callers can surface
 * loading, error and retry states instead of silently rendering empty data.
 */

export type ChatRoomStatus = 'ACTIVE' | 'DISABLED' | 'COMPLETED';
export type ChatMemberRole = 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
export type ChatSenderRole = 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' | 'SYSTEM';
export type ChatMessageType = 'TEXT' | 'VOICE_NOTE' | 'FILE' | 'IMAGE' | 'VIDEO' | 'SYSTEM';
export type ChatMediaType = Exclude<ChatMessageType, 'TEXT' | 'SYSTEM'>;

/** Job statuses in which the backend accepts new chat messages. */
export const CHAT_WRITABLE_JOB_STATUSES = ['ASSIGNED', 'PAUSED'] as const;
export const CHAT_TEXT_MAX_LENGTH = 4000;

export interface ChatParticipant {
  id: string;
  fullName: string;
}

export interface ChatRoomJobSummary {
  id: string;
  status: string;
  cooperationStatus: string;
  description: string;
  service: string | null;
  customer: ChatParticipant;
  technician: ChatParticipant | null;
}

export interface ChatRoomMember {
  userId: string;
  role: ChatMemberRole;
  blockedAt: string | null;
}

export interface BackendChatRoom {
  id: string;
  jobId: string;
  status: ChatRoomStatus;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
  updatedAt: string;
  job: ChatRoomJobSummary;
  assignment: { id: string; endedAt: string | null };
  members: ChatRoomMember[];
  currentMember?: { blockedAt: string | null; archivedAt: string | null };
}

export interface ChatReadReceipt {
  userId: string;
  readAt: string;
}

export interface BackendChatMessage {
  id: string;
  roomId: string;
  senderId: string | null;
  senderRole: ChatSenderRole;
  type: ChatMessageType;
  text: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  downloadUrl: string | null;
  downloadPath: string | null;
  isTombstone: boolean;
  isBlocked: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  readBy: ChatReadReceipt[];
  readByOtherSide: boolean;
  readByViewer: boolean;
}

export interface ChatMessagePage {
  items: BackendChatMessage[];
  nextCursor: string | null;
}

export interface ChatReadResult {
  userId: string;
  messageId: string;
  readAt: string;
  count: number;
}

const ROOMS = '/api/v1/chat/rooms';

export function listChatRooms(): Promise<BackendChatRoom[]> {
  return apiRequest<BackendChatRoom[]>(ROOMS, { authenticated: true });
}

export function getChatRoom(roomId: string): Promise<BackendChatRoom> {
  return apiRequest<BackendChatRoom>(`${ROOMS}/${roomId}`, { authenticated: true });
}

/** Returns one page of messages, newest first (backend order). */
export function listChatRoomMessages(
  roomId: string,
  limit = 50,
  beforeMessageId?: string,
): Promise<ChatMessagePage> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (beforeMessageId) query.append('beforeMessageId', beforeMessageId);
  return apiRequest<ChatMessagePage>(`${ROOMS}/${roomId}/messages?${query.toString()}`, {
    authenticated: true,
  });
}

export function sendChatRoomText(roomId: string, text: string): Promise<BackendChatMessage> {
  return apiRequest<BackendChatMessage>(`${ROOMS}/${roomId}/messages`, {
    method: 'POST',
    authenticated: true,
    body: { text },
  });
}

export function sendChatRoomMedia(
  roomId: string,
  type: ChatMediaType,
  file: { uri: string; name?: string; mimeType?: string },
  durationSeconds?: number,
): Promise<BackendChatMessage> {
  const formData = new FormData();
  formData.append('type', type);
  if (durationSeconds) formData.append('durationSeconds', String(durationSeconds));
  formData.append('file', {
    uri: file.uri,
    name: file.name || `upload_${Date.now()}`,
    type:
      file.mimeType ||
      (type === 'IMAGE' ? 'image/jpeg' : type === 'VIDEO' ? 'video/mp4' : 'application/octet-stream'),
  } as unknown as Blob);
  return apiUpload<BackendChatMessage>(`${ROOMS}/${roomId}/messages/media`, formData);
}

export function markChatRoomRead(roomId: string, messageId: string): Promise<ChatReadResult> {
  return apiRequest<ChatReadResult>(`${ROOMS}/${roomId}/read`, {
    method: 'POST',
    authenticated: true,
    body: { messageId },
  });
}

// ── Job actions scoped to the room's current assignment ───────────────────
// Each returns the updated job (shape of `BackendJob` in lib/jobs-api.ts),
// except a technician cancellation, which returns `{ message }` because it
// goes to administrator review.

export type JobProgressValue = 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/** Confirms cooperation for the caller's side (after the price is agreed). */
export function confirmRoomCooperation<T = unknown>(roomId: string): Promise<T> {
  return apiRequest<T>(`${ROOMS}/${roomId}/cooperation/confirm`, { method: 'POST', authenticated: true });
}

/** Pulls out of the assignment. Allowed for either side before mutual cooperation confirmation. */
export function denyRoomPartnership<T = unknown>(roomId: string, reason: string): Promise<T> {
  return apiRequest<T>(`${ROOMS}/${roomId}/cooperation/deny`, {
    method: 'POST',
    authenticated: true,
    body: { reason },
  });
}

/** Customer: cancels the job immediately. Technician: submits a cancellation for admin review. */
export function cancelJobFromRoom<T = unknown>(roomId: string, reason: string): Promise<T> {
  return apiRequest<T>(`${ROOMS}/${roomId}/cancel`, {
    method: 'POST',
    authenticated: true,
    body: { reason },
  });
}

/** Records the caller's progress on the job (PENDING → STARTED → IN_PROGRESS → COMPLETED). */
export function updateRoomProgress<T = unknown>(roomId: string, status: JobProgressValue): Promise<T> {
  return apiRequest<T>(`${ROOMS}/${roomId}/progress`, {
    method: 'PATCH',
    authenticated: true,
    body: { status },
  });
}

/** Whether the backend would accept a new message in this room right now. */
export function isChatRoomWritable(room: BackendChatRoom): boolean {
  return (
    room.status === 'ACTIVE' &&
    !room.assignment.endedAt &&
    !room.currentMember?.blockedAt &&
    (CHAT_WRITABLE_JOB_STATUSES as readonly string[]).includes(room.job.status)
  );
}

/** Picks the room for the job's current assignment, falling back to the newest one. */
export function pickRoomForJob(rooms: BackendChatRoom[], jobId: string): BackendChatRoom | undefined {
  const forJob = rooms
    .filter((room) => room.jobId === jobId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return forJob.find((room) => !room.assignment.endedAt && room.status === 'ACTIVE') ?? forJob[0];
}

/** Short human-readable preview for a message, used in lists and notifications. */
export function describeChatMessage(message: BackendChatMessage): string {
  if (message.isTombstone) return 'Message deleted';
  if (message.isBlocked) return 'Message removed by a moderator';
  switch (message.type) {
    case 'IMAGE':
      return 'Photo';
    case 'VIDEO':
      return 'Video';
    case 'VOICE_NOTE':
      return 'Voice note';
    case 'FILE':
      return message.fileName ? `Document · ${message.fileName}` : 'Document';
    default:
      return message.text?.trim() || 'Message';
  }
}
