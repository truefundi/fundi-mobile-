import { apiRequest, apiUpload } from '@/lib/api';

export interface ChatRoomMember {
  userId: string;
  role: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
  unreadCount?: number;
}

export interface ChatRoomJobSummary {
  id: string;
  status: string;
  cooperationStatus: string;
  description: string;
  service?: string | null;
  customer: {
    id: string;
    fullName: string;
    phoneNumber?: string;
  };
  technician?: {
    id: string;
    fullName: string;
    phoneNumber?: string;
  } | null;
}

export interface BackendChatRoom {
  id: string;
  jobId: string;
  status: 'ACTIVE' | 'DISABLED' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
  job: ChatRoomJobSummary;
  members: ChatRoomMember[];
}

export interface BackendChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderRole: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
  senderName?: string;
  type: 'TEXT' | 'VOICE_NOTE' | 'FILE' | 'IMAGE' | 'VIDEO' | 'SYSTEM';
  text?: string | null;
  mediaUrl?: string | null;
  mediaSizeBytes?: number | null;
  mediaMimeType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listChatRooms(): Promise<BackendChatRoom[]> {
  try {
    return await apiRequest<BackendChatRoom[]>('/api/v1/chat/rooms', {
      authenticated: true,
    });
  } catch {
    return [];
  }
}

export async function getChatRoom(roomId: string): Promise<BackendChatRoom | null> {
  try {
    return await apiRequest<BackendChatRoom>(`/api/v1/chat/rooms/${roomId}`, {
      authenticated: true,
    });
  } catch {
    return null;
  }
}

export async function listChatRoomMessages(
  roomId: string,
  limit = 50,
  beforeMessageId?: string,
): Promise<BackendChatMessage[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (beforeMessageId) query.append('beforeMessageId', beforeMessageId);

  try {
    return await apiRequest<BackendChatMessage[]>(`/api/v1/chat/rooms/${roomId}/messages?${query.toString()}`, {
      authenticated: true,
    });
  } catch {
    return [];
  }
}

export async function sendChatRoomText(roomId: string, text: string): Promise<BackendChatMessage> {
  return apiRequest<BackendChatMessage>(`/api/v1/chat/rooms/${roomId}/messages`, {
    method: 'POST',
    authenticated: true,
    body: { text },
  });
}

export async function sendChatRoomMedia(
  roomId: string,
  type: 'IMAGE' | 'VIDEO' | 'FILE' | 'VOICE_NOTE',
  fileUri: string,
  fileName?: string,
  mimeType?: string,
  durationSeconds?: number,
): Promise<BackendChatMessage> {
  const formData = new FormData();
  formData.append('type', type);
  if (durationSeconds) formData.append('durationSeconds', String(durationSeconds));

  formData.append('file', {
    uri: fileUri,
    name: fileName || `upload_${Date.now()}`,
    type: mimeType || (type === 'IMAGE' ? 'image/jpeg' : type === 'VIDEO' ? 'video/mp4' : 'application/octet-stream'),
  } as any);

  return apiUpload<BackendChatMessage>(`/api/v1/chat/rooms/${roomId}/messages/media`, formData);
}

export async function markChatRoomRead(roomId: string, messageId: string): Promise<{ success: boolean }> {
  try {
    return await apiRequest<{ success: boolean }>(`/api/v1/chat/rooms/${roomId}/read`, {
      method: 'POST',
      authenticated: true,
      body: { messageId },
    });
  } catch {
    return { success: false };
  }
}
