import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';
import { useChat, type ChatThread } from '@/context/ChatContext';
import { useFundi } from '@/context/FundiContext';
import { AppHeader } from '@/components/ui/AppHeader';
import { PageHeading } from '@/components/ui/PageHeading';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { extractFirstName } from '@/lib/cancellation';
import { ProfileAvatar, computeParticipantInitials } from '@/components/ui/ProfileAvatar';

export { computeParticipantInitials as getParticipantInitial };

/**
 * Smart relative timestamp for the conversation preview row.
 */
function formatChatTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

type ConversationPreview = {
  thread: ChatThread;
  name: string;
  avatarInitial: string;
  avatarUri?: string;
  knownInitials?: string;
  snippet: string;
  timeLabel: string;
  unreadCount: number;
  isSos: boolean;
  navigatesToSelectTechnician: boolean;
  selectTechnicianParams?: {
    jobId?: string;
    category?: string;
    service?: string;
    description?: string;
    problem?: string;
    location?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
  };
};

function getConversationPreview(
  thread: ChatThread,
  currentUserId?: string,
  currentUserRole: 'client' | 'technician' = 'client',
  currentUserName?: string,
  getJob?: (id: string) => any,
): ConversationPreview {
  const isMe = (senderId?: string, senderRole?: string) =>
    Boolean((senderId && currentUserId && senderId === currentUserId) || (senderRole && senderRole === currentUserRole));

  const associatedJob = thread.jobId && getJob ? getJob(thread.jobId) : undefined;
  const displayName =
    (thread.otherParticipantName && thread.otherParticipantName.trim()) ||
    associatedJob?.technician?.name ||
    thread.technicianName ||
    thread.clientName ||
    'Specialist';
  const otherFirstName = extractFirstName(displayName);

  // Determine SOS status for clean badge
  const isSos = Boolean(
    thread.messages.some((m) => m.serviceRequest?.type === 'SOS') ||
    associatedJob?.type === 'SOS' ||
    thread.jobId?.toLowerCase().includes('sos')
  );

  // Person avatar URL only (repair job photos of damaged pipes must not be used as profile avatars)
  const avatarUri = (associatedJob?.technician as any)?.avatarUrl || (associatedJob?.technician as any)?.photoUri || undefined;
  const knownInitials = associatedJob?.technician?.initials || undefined;
  const avatarInitial = computeParticipantInitials(displayName, knownInitials);

  // Smart Last Message Preview Logic
  const sortedMessages = [...thread.messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const lastMsg = sortedMessages[sortedMessages.length - 1];

  const latestRequest = [...thread.messages]
    .filter((m) => m.serviceRequest)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.serviceRequest;

  const requestStatus = latestRequest?.status;
  const isCancelled = requestStatus === 'CANCELLED';
  const isDeclined = requestStatus === 'DECLINED';

  let snippet = '';
  let navigatesToSelectTechnician = false;
  let selectTechnicianParams: ConversationPreview['selectTechnicianParams'];

  if (isDeclined) {
    const declinedByMe =
      isMe(latestRequest?.cancelledById) ||
      thread.cancelledByRole === currentUserRole ||
      (thread.cancelledByName && currentUserName && thread.cancelledByName.trim().toLowerCase() === currentUserName.trim().toLowerCase());
    snippet = declinedByMe ? 'Request declined by you' : `Request declined by ${otherFirstName}`;
    navigatesToSelectTechnician = true;
    if (latestRequest) {
      selectTechnicianParams = {
        category: latestRequest.serviceName,
        service: latestRequest.serviceName,
        description: latestRequest.problem,
        problem: latestRequest.problem,
        location: latestRequest.address,
        address: latestRequest.address,
        ...(latestRequest.latitude !== undefined ? { latitude: String(latestRequest.latitude) } : {}),
        ...(latestRequest.longitude !== undefined ? { longitude: String(latestRequest.longitude) } : {}),
      };
    }
  } else if (isCancelled) {
    const cancelledByMe =
      isMe(latestRequest?.cancelledById) ||
      thread.cancelledByRole === currentUserRole ||
      (thread.cancelledByName && currentUserName && thread.cancelledByName.trim().toLowerCase() === currentUserName.trim().toLowerCase());
    snippet = cancelledByMe ? 'Request cancelled by you' : `Request cancelled by ${otherFirstName}`;
    navigatesToSelectTechnician = true;
    if (latestRequest) {
      selectTechnicianParams = {
        category: latestRequest.serviceName,
        service: latestRequest.serviceName,
        description: latestRequest.problem,
        problem: latestRequest.problem,
        location: latestRequest.address,
        address: latestRequest.address,
        ...(latestRequest.latitude !== undefined ? { latitude: String(latestRequest.latitude) } : {}),
        ...(latestRequest.longitude !== undefined ? { longitude: String(latestRequest.longitude) } : {}),
      };
    }
  } else if (lastMsg?.priceOffer) {
    // Offer preview: display currency/money and offered value
    const offer = lastMsg.priceOffer;
    const currency = offer.currency || 'RWF';
    const amountStr = `${currency} ${offer.amount.toLocaleString()}`;
    if (offer.status === 'ACCEPTED') {
      snippet = `Offer accepted: ${amountStr}`;
    } else if (offer.status === 'DECLINED') {
      snippet = `Offer declined: ${amountStr}`;
    } else {
      const isMyOffer = isMe(lastMsg.senderId, lastMsg.senderRole);
      snippet = isMyOffer ? `Offer sent: ${amountStr}` : `Offer received: ${amountStr}`;
    }
  } else if (lastMsg?.serviceRequest) {
    // Job details preview: render concise job summary description
    const req = lastMsg.serviceRequest;
    const serviceName = req.serviceName || 'Service';
    const desc = req.problem?.trim();
    snippet = desc ? `Job details: ${serviceName} · ${desc}` : `Job details: ${serviceName}`;
  } else if (lastMsg) {
    // Regular text message or photo
    if (lastMsg.imageUri && !lastMsg.text) {
      snippet = isMe(lastMsg.senderId, lastMsg.senderRole) ? 'You sent a photo' : 'Sent a photo';
    } else {
      const prefix = isMe(lastMsg.senderId, lastMsg.senderRole) ? 'You: ' : '';
      snippet = `${prefix}${lastMsg.text.trim()}`;
    }
  } else if (thread.agreedPrice) {
    snippet = `Agreed price: RWF ${thread.agreedPrice.toLocaleString()}`;
  } else {
    snippet = thread.lastMessage || 'Conversation started';
  }

  // Safe truncation so message previews don't break the layout
  const MAX_SAFE_LENGTH = 55;
  if (snippet.length > MAX_SAFE_LENGTH) {
    snippet = `${snippet.slice(0, MAX_SAFE_LENGTH).trim()}...`;
  }

  // Calculate unread count
  const unreadCount =
    typeof thread.unreadCount === 'number'
      ? thread.unreadCount
      : thread.messages.filter((m) => !isMe(m.senderId, m.senderRole) && m.read === false).length;

  return {
    thread,
    name: displayName,
    avatarInitial,
    avatarUri,
    snippet,
    timeLabel: formatChatTime(thread.lastMessageTime),
    unreadCount,
    isSos,
    navigatesToSelectTechnician,
    selectTechnicianParams,
  };
}

export default function ChatTabScreen() {
  const colors = useColors();
  const bottomPadding = useTabScreenPadding();
  const router = useRouter();
  const { threadId: requestedThreadId } = useLocalSearchParams<{ threadId?: string }>();
  const { account } = useAuth();
  const { threads } = useChat();
  const { getJob } = useFundi();

  const userRole = account?.role === 'TECHNICIAN' ? 'technician' : 'client';

  // If a threadId is passed into the tab screen, redirect immediately to the dedicated chat screen
  useEffect(() => {
    if (requestedThreadId) {
      router.replace({
        pathname: `/chat/${requestedThreadId}` as any,
      });
    }
  }, [requestedThreadId, router]);

  const sortedThreads = useMemo(() => {
    return [...threads].sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
    );
  }, [threads]);

  const threadPreviews = useMemo(() => {
    return sortedThreads.map((thread) =>
      getConversationPreview(thread, account?.id, userRole, account?.name, getJob),
    );
  }, [sortedThreads, account?.id, userRole, account?.name, getJob]);

  const handlePreviewPress = (preview: ConversationPreview) => {
    if (preview.navigatesToSelectTechnician && preview.selectTechnicianParams) {
      router.push({
        pathname: '/select-technician',
        params: preview.selectTechnicianParams,
      });
      return;
    }
    router.push({
      pathname: `/chat/${preview.thread.id}` as any,
      params: { requestId: preview.thread.jobId },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          { paddingTop: Platform.OS === 'web' ? 24 : 16, paddingBottom: bottomPadding + 20 },
        ]}
      >
        <PageHeading
          eyebrow="Negotiation"
          title="Service Chats"
          subtitle="Settle service pricing and review requests directly with clients and specialists."
        />

        {sortedThreads.length === 0 ? (
          <View style={[styles.emptyContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
              <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No conversations yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              When you connect with a technician or receive service requests, your price settlement chats will show up here.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {threadPreviews.map((preview) => (
              <Pressable
                key={preview.thread.id}
                onPress={() => handlePreviewPress(preview)}
                style={({ pressed }) => [
                  styles.threadCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {/* Circular Profile Avatar with fallback to initial letter */}
                <ProfileAvatar
                  uri={preview.avatarUri}
                  name={preview.name}
                  knownInitials={preview.knownInitials}
                  size={48}
                  testID={`avatar-${preview.thread.id}`}
                />

                {/* Main Content: Name, Smart Snippet, SOS Label beneath */}
                <View style={styles.cardContent}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.previewName, { color: colors.foreground }]} numberOfLines={1} ellipsizeMode="tail">
                      {preview.name}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.previewSnippet,
                      {
                        color: preview.unreadCount > 0 ? colors.foreground : colors.mutedForeground,
                        fontFamily: preview.unreadCount > 0 ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      },
                    ]}
                  >
                    {preview.snippet}
                  </Text>
                  {preview.isSos && (
                    <View style={styles.sosTagRow}>
                      <View style={styles.sosTag} testID={`sos-tag-${preview.thread.id}`}>
                        <View style={styles.sosDot} />
                        <Text style={styles.sosTagText}>SOS Priority</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Right Meta Column: Timestamp & Unread Badge Directly Underneath */}
                <View style={styles.metaCol}>
                  <Text style={[styles.previewTime, { color: colors.mutedForeground }]}>
                    {preview.timeLabel}
                  </Text>
                  {preview.unreadCount > 0 ? (
                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]} testID={`unread-badge-${preview.thread.id}`}>
                      <Text style={[styles.unreadBadgeText, { color: colors.primaryForeground }]}>
                        {preview.unreadCount > 99 ? '99+' : preview.unreadCount}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.metaSpacer} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  emptyContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listWrap: {
    gap: 10,
    marginTop: 16,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatarBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarInitial: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  previewName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    flexShrink: 1,
  },
  sosTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sosTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  sosDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ef4444',
  },
  sosTagText: {
    color: '#ef4444',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  previewSnippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginLeft: 10,
    paddingVertical: 2,
  },
  previewTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  unreadBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textAlign: 'center',
  },
  metaSpacer: {
    height: 20,
    marginTop: 4,
  },
});
