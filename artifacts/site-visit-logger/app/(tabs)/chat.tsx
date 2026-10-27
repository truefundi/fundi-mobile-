import React, { useEffect, useMemo } from 'react';
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
import { AppHeader } from '@/components/ui/AppHeader';
import { PageHeading } from '@/components/ui/PageHeading';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { extractFirstName } from '@/lib/cancellation';

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
  snippet: string;
  timeLabel: string;
  unread: boolean;
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
): ConversationPreview {
  const isMe = (senderId?: string) => Boolean(senderId && currentUserId && senderId === currentUserId);

  const latestRequest = thread.messages
    .filter((m) => m.serviceRequest)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.serviceRequest;

  const latestOffer = thread.messages
    .filter((m) => m.priceOffer)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.priceOffer;

  const otherFirstName = extractFirstName(thread.otherParticipantName);

  let snippet = '';
  let navigatesToSelectTechnician = false;
  let selectTechnicianParams: ConversationPreview['selectTechnicianParams'];

  const requestStatus = latestRequest?.status;
  const isCancelled = requestStatus === 'CANCELLED';
  const isDeclined = requestStatus === 'DECLINED';

  if (requestStatus === 'ACCEPTED') {
    snippet = latestOffer
      ? `Offer accepted: ${latestOffer.currency} ${latestOffer.amount.toLocaleString()}`
      : `Offer accepted • ${latestRequest?.serviceName ?? ''}`;
  } else if (isDeclined) {
    const declinedByMe =
      isMe(latestRequest?.cancelledById) ||
      thread.cancelledByRole === currentUserRole ||
      (thread.cancelledByName && currentUserName && thread.cancelledByName.trim().toLowerCase() === currentUserName.trim().toLowerCase());
    snippet = declinedByMe ? 'Declined by you' : `Declined by ${otherFirstName}`;
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
    snippet = cancelledByMe ? 'Cancelled by you' : `Cancelled by ${otherFirstName}`;
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
  } else if (requestStatus === 'OFFER_MADE' && latestOffer) {
    snippet =
      currentUserRole === 'technician'
        ? `Offer sent: ${latestOffer.currency} ${latestOffer.amount.toLocaleString()}`
        : `Offer received: ${latestOffer.currency} ${latestOffer.amount.toLocaleString()}`;
  } else if (requestStatus === 'PENDING_RESPONSE') {
    snippet =
      currentUserRole === 'technician'
        ? `New request: ${latestRequest?.serviceName ?? ''}`
        : 'Waiting for technician response...';
  } else {
    // Active message flow
    const standardMessages = thread.messages.filter((m) => !m.serviceRequest && !m.priceOffer);
    const latest = standardMessages[standardMessages.length - 1];
    if (latest) {
      snippet = isMe(latest.senderId) ? `You: ${latest.text}` : latest.text;
    } else if (latestRequest) {
      snippet = `New request: ${latestRequest.serviceName}`;
    } else {
      snippet = thread.lastMessage;
    }
  }

  const unread = false;

  return {
    thread,
    name: thread.otherParticipantName,
    avatarInitial: (thread.otherParticipantName?.trim()?.[0] || '?').toUpperCase(),
    snippet,
    timeLabel: formatChatTime(thread.lastMessageTime),
    unread,
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
  const { threads, setActiveThreadId } = useChat();

  const userRole = account?.role === 'TECHNICIAN' ? 'technician' : 'client';

  // If a threadId is passed into the tab screen, redirect immediately to the dedicated chat screen
  useEffect(() => {
    if (requestedThreadId) {
      router.replace({
        pathname: `/chat/${requestedThreadId}` as any,
      });
    }
  }, [requestedThreadId, router]);

  // Ensure activeThreadId is reset when looking at the conversations list
  useEffect(() => {
    setActiveThreadId(null);
  }, [setActiveThreadId]);

  const sortedThreads = useMemo(() => {
    return [...threads].sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
    );
  }, [threads]);

  const threadPreviews = useMemo(() => {
    return sortedThreads.map((thread) =>
      getConversationPreview(thread, account?.id, userRole, account?.name),
    );
  }, [sortedThreads, account?.id, userRole, account?.name]);

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
                style={[styles.threadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                  {preview.avatarUri ? (
                    <Image source={{ uri: preview.avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>{preview.avatarInitial}</Text>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.previewRow}>
                    <Text style={[styles.previewName, { color: colors.foreground }]} numberOfLines={1}>
                      {preview.name}
                    </Text>
                    <Text style={[styles.previewTime, { color: colors.mutedForeground }]}>{preview.timeLabel}</Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.previewSnippet, { color: colors.mutedForeground }]}
                  >
                    {preview.snippet}
                  </Text>
                </View>
                {preview.unread ? (
                  <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                ) : null}
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  previewName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  previewTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  previewSnippet: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
