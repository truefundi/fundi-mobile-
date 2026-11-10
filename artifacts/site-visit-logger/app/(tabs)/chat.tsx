import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';
import { useChat, type ChatThread } from '@/context/ChatContext';
import { useFundi } from '@/context/FundiContext';
import { useAuth } from '@/context/AuthContext';
import { useWork } from '@/context/WorkContext';
import { AppHeader } from '@/components/ui/AppHeader';
import { PageHeading } from '@/components/ui/PageHeading';
import { ProfileAvatar, computeParticipantInitials } from '@/components/ui/ProfileAvatar';
import { getServiceIcon } from '@/lib/categories-api';
import { describeChatMessage } from '@/lib/chat-rooms-api';
import { useChatRooms, type ChatRoomSummary } from '@/hooks/useChatRooms';

export { computeParticipantInitials as getParticipantInitial };

/** Smart relative timestamp for a conversation row. */
function formatChatTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  if (diffDays <= 0) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function truncate(text: string, max = 55) {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

type RowModel = {
  key: string;
  name: string;
  avatarUri?: string;
  serviceName?: string;
  snippet: string;
  timeLabel: string;
  unreadLabel: string | null;
  statusTag?: { label: string; tone: 'muted' | 'warning' | 'sos' };
  onPress: () => void;
};

const ROOM_STATUS_TAG: Record<string, RowModel['statusTag']> = {
  COMPLETED: { label: 'Completed', tone: 'muted' },
  DISABLED: { label: 'Chat closed', tone: 'warning' },
};

export default function ChatTabScreen() {
  const colors = useColors();
  const bottomPadding = useTabScreenPadding();
  const router = useRouter();
  const { threadId: requestedThreadId } = useLocalSearchParams<{ threadId?: string }>();
  const { account } = useAuth();
  const { getJob, jobs } = useFundi();
  const { threads, refreshConversations, error: negotiationError } = useChat();
  const rooms = useChatRooms();
  const isTechnician = account?.role === 'TECHNICIAN';
  const { technicianOffers, refreshJobs } = useWork();

  // Re-render periodically so request countdowns stay current and expired ones drop off.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isTechnician) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [isTechnician]);

  // Technicians: client requests routed to them and waiting for an answer land here first.
  const requestRows = useMemo<RowModel[]>(() => {
    if (!isTechnician) return [];
    return technicianOffers
      .filter((offer) => offer.status === 'OFFERED' && (!offer.expiresAt || new Date(offer.expiresAt).getTime() > now))
      .map((offer) => {
        const msLeft = offer.expiresAt ? new Date(offer.expiresAt).getTime() - now : null;
        const minutesLeft = msLeft !== null ? Math.max(1, Math.ceil(msLeft / 60_000)) : null;
        return {
          key: `request-${offer.id}`,
          name: offer.customer?.fullName?.trim() || 'New client',
          avatarUri: offer.customer?.profilePictureUrl ?? undefined,
          serviceName: offer.job.service,
          snippet: truncate(`Request: ${offer.job.description}`),
          timeLabel: formatChatTime(offer.offeredAt ?? offer.job.createdAt),
          unreadLabel: 'New',
          statusTag: {
            label: minutesLeft ? `Respond within ${minutesLeft} min` : 'Awaiting your reply',
            tone: 'warning' as const,
          },
          onPress: () => router.push({ pathname: '/chat/[id]', params: { id: offer.job.id, requestId: offer.job.id } }),
        };
      });
  }, [isTechnician, technicianOffers, now, router]);

  // Deep links into the tab with a thread id open the conversation directly.
  useEffect(() => {
    if (requestedThreadId) {
      router.replace({ pathname: '/chat/[id]', params: { id: requestedThreadId } });
    }
  }, [requestedThreadId, router]);

  const roomJobIds = useMemo(() => new Set(rooms.summaries.map((s) => s.room.jobId)), [rooms.summaries]);

  const roomRows = useMemo<RowModel[]>(
    () =>
      rooms.summaries.map((summary: ChatRoomSummary) => {
        const { room, lastMessage } = summary;
        const other = isTechnician ? room.job.customer : room.job.technician;
        const name = other?.fullName?.trim() || (isTechnician ? 'Client' : 'Technician');
        const job = getJob(room.jobId);
        const avatarUri = !isTechnician
          ? job?.technician?.avatarUrl || job?.technician?.photoUri || undefined
          : undefined;
        let snippet: string;
        if (lastMessage) {
          const mine = lastMessage.senderId === account?.id;
          snippet = `${mine ? 'You: ' : ''}${describeChatMessage(lastMessage)}`;
        } else {
          snippet = room.job.description ? `Job: ${room.job.description}` : 'Say hello to start coordinating';
        }
        // Negotiation state for the same job, shown as a cue on the row.
        const negotiation = threads.find((t) => t.jobId === room.jobId);
        const pendingOffer = negotiation?.messages.find((m) => m.priceOffer?.status === 'PENDING')?.priceOffer;
        const negotiationTag: RowModel['statusTag'] = negotiation?.agreedPrice
          ? { label: `Agreed RWF ${negotiation.agreedPrice.toLocaleString()}`, tone: 'muted' }
          : pendingOffer
            ? { label: `Offer RWF ${pendingOffer.amount.toLocaleString()}`, tone: 'warning' }
            : negotiation && !negotiation.isAccepted && !negotiation.isEnded
              ? { label: 'Awaiting acceptance', tone: 'warning' }
              : undefined;
        const statusTag =
          ROOM_STATUS_TAG[room.status] ??
          (room.assignment.endedAt ? { label: 'Reassigned', tone: 'warning' as const } : undefined) ??
          (job?.type === 'SOS' ? { label: 'SOS Priority', tone: 'sos' as const } : undefined) ??
          negotiationTag;
        return {
          key: `room-${room.id}`,
          name,
          avatarUri,
          serviceName: room.job.service ?? undefined,
          snippet: truncate(snippet),
          timeLabel: formatChatTime(summary.activityAt),
          unreadLabel: summary.unreadCount > 0
            ? summary.unreadCapped || summary.unreadCount > 99 ? '99+' : String(summary.unreadCount)
            : null,
          statusTag,
          onPress: () => router.push({ pathname: '/chat/[id]', params: { id: room.id } }),
        };
      }),
    [rooms.summaries, threads, isTechnician, getJob, account?.id, router],
  );

  // Negotiations whose job has no chat room yet (once assigned, the job chat takes over).
  const negotiationRows = useMemo<RowModel[]>(
    () =>
      threads
        .filter((t: ChatThread) => !t.jobId || !roomJobIds.has(t.jobId))
        .map((thread) => {
          const request = thread.messages.find((m) => m.serviceRequest)?.serviceRequest;
          const lastOffer = [...thread.messages].reverse().find((m) => m.priceOffer)?.priceOffer;
          let snippet = thread.lastMessage;
          if (thread.isEnded) snippet = 'Request closed';
          else if (thread.agreedPrice) snippet = `Agreed price: RWF ${thread.agreedPrice.toLocaleString()}`;
          else if (lastOffer?.status === 'PENDING') snippet = `Offer pending: ${lastOffer.currency} ${lastOffer.amount.toLocaleString()}`;
          return {
            key: `neg-${thread.id}`,
            name: thread.otherParticipantName || 'Specialist',
            avatarUri: thread.otherParticipantAvatarUrl,
            serviceName: request?.serviceName,
            snippet: truncate(snippet || 'Negotiation started'),
            timeLabel: formatChatTime(thread.lastMessageTime),
            unreadLabel: null,
            statusTag: thread.isEnded ? { label: 'Closed', tone: 'muted' as const } : { label: 'Pricing', tone: 'warning' as const },
            onPress: () => router.push({ pathname: '/chat/[id]', params: { id: thread.id, requestId: thread.jobId } }),
          };
        }),
    [threads, roomJobIds, router],
  );

  // Clients: paid requests that are routed to a technician but not accepted yet.
  const sentRequestRows = useMemo<RowModel[]>(() => {
    if (isTechnician) return [];
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return jobs
      .filter(
        (job) =>
          UUID.test(job.id) &&
          job.bookingFee?.status === 'PAID' &&
          (job.status === 'OFFERED' || job.status === 'REQUESTED') &&
          !roomJobIds.has(job.id),
      )
      .map((job) => {
        const delivered = job.status === 'OFFERED';
        return {
          key: `sent-${job.id}`,
          name: job.routedTechnician?.name || job.technician?.name || `${job.service} request`,
          avatarUri: job.routedTechnician?.avatarUrl ?? job.technician?.avatarUrl,
          serviceName: job.service,
          snippet: delivered
            ? 'Request delivered · waiting for them to accept'
            : job.routedTechnician
              ? 'Declined or timed out · choose a technician'
              : 'Not sent yet · choose a technician',
          timeLabel: formatChatTime(job.statusSince || job.createdAt),
          unreadLabel: null,
          statusTag: delivered
            ? { label: 'Awaiting reply', tone: 'warning' as const }
            : { label: 'Action needed', tone: 'sos' as const },
          onPress: () => router.push({ pathname: '/chat/[id]', params: { id: job.id, requestId: job.id } }),
        };
      });
  }, [isTechnician, jobs, roomJobIds, router]);

  const onRefresh = () => {
    void rooms.refresh();
    void refreshConversations();
    if (isTechnician) void refreshJobs();
  };

  const tagColors = (tone: 'muted' | 'warning' | 'sos') =>
    tone === 'sos'
      ? { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', fg: '#ef4444' }
      : tone === 'warning'
        ? { bg: colors.warning + '14', border: colors.warning + '40', fg: colors.warning }
        : { bg: colors.muted + '40', border: colors.border, fg: colors.mutedForeground };

  const renderRow = (row: RowModel) => (
    <Pressable
      key={row.key}
      onPress={row.onPress}
      testID={row.key}
      style={({ pressed }) => [
        styles.threadCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.avatarWrap}>
        <ProfileAvatar uri={row.avatarUri} name={row.name} size={48} testID={`avatar-${row.key}`} />
        {row.serviceName ? (
          <View style={[styles.avatarServiceBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={getServiceIcon(row.serviceName) as any} size={11} color={colors.primary} />
          </View>
        ) : null}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.nameRow}>
          <Text style={[styles.previewName, { color: colors.foreground }]} numberOfLines={1}>{row.name}</Text>
          {row.serviceName ? (
            <View style={[styles.serviceTag, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.serviceTagText, { color: colors.primary }]} numberOfLines={1}>{row.serviceName}</Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.previewSnippet,
            {
              color: row.unreadLabel ? colors.foreground : colors.mutedForeground,
              fontFamily: row.unreadLabel ? 'Inter_600SemiBold' : 'Inter_400Regular',
            },
          ]}
        >
          {row.snippet}
        </Text>
        {row.statusTag ? (
          <View style={styles.tagRow}>
            {(() => {
              const c = tagColors(row.statusTag.tone);
              return (
                <View style={[styles.statusTag, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <Text style={[styles.statusTagText, { color: c.fg }]}>{row.statusTag.label}</Text>
                </View>
              );
            })()}
          </View>
        ) : null}
      </View>
      <View style={styles.metaCol}>
        <Text style={[styles.previewTime, { color: colors.mutedForeground }]}>{row.timeLabel}</Text>
        {row.unreadLabel ? (
          <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]} testID={`unread-badge-${row.key}`}>
            <Text style={[styles.unreadBadgeText, { color: colors.primaryForeground }]}>{row.unreadLabel}</Text>
          </View>
        ) : (
          <View style={styles.metaSpacer} />
        )}
      </View>
    </Pressable>
  );

  const nothingYet =
    !rooms.isLoading &&
    roomRows.length === 0 &&
    negotiationRows.length === 0 &&
    requestRows.length === 0 &&
    sentRequestRows.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Platform.OS === 'web' ? 24 : 16, paddingBottom: bottomPadding + 20 },
        ]}
        refreshControl={
          <RefreshControl refreshing={rooms.isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <PageHeading
          eyebrow="Messages"
          title="Chats"
          subtitle={
            isTechnician
              ? 'Coordinate with clients on your assigned jobs and settle pricing.'
              : 'Message your assigned technician and settle the repair price.'
          }
        />

        {rooms.socketStatus === 'disconnected' && !rooms.isLoading ? (
          <View style={[styles.inlineBanner, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '40' }]}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
            <Text style={[styles.inlineBannerText, { color: colors.foreground }]}>
              Live updates paused. Reconnecting…
            </Text>
          </View>
        ) : null}

        {rooms.error && !rooms.summaries.length ? (
          <View style={[styles.emptyContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.destructive} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn't load your chats</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{rooms.error}</Text>
            <Pressable onPress={onRefresh} style={[styles.retryBtn, { borderColor: colors.primary }]}>
              <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {rooms.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {requestRows.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
              New requests ({requestRows.length})
            </Text>
            <View style={styles.listWrap}>{requestRows.map(renderRow)}</View>
          </>
        ) : null}

        {sentRequestRows.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Sent requests</Text>
            <View style={styles.listWrap}>{sentRequestRows.map(renderRow)}</View>
          </>
        ) : null}

        {roomRows.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Job chats</Text>
            <View style={styles.listWrap}>{roomRows.map(renderRow)}</View>
          </>
        ) : null}

        {negotiationRows.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Other requests</Text>
            <View style={styles.listWrap}>{negotiationRows.map(renderRow)}</View>
          </>
        ) : null}
        {negotiationError && !threads.length ? (
          <Text style={[styles.sectionError, { color: colors.mutedForeground }]}>
            Negotiations unavailable: {negotiationError}
          </Text>
        ) : null}

        {nothingYet && !rooms.error ? (
          <View style={[styles.emptyContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
              <Ionicons name="chatbubbles-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No conversations yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {isTechnician
                ? 'When a client sends you a request, it arrives here. Stay online to receive requests.'
                : 'Once you send a request to a technician, your conversation with them shows up here.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  inlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  inlineBannerText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 20,
  },
  sectionError: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 12 },
  emptyContainer: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 24 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginBottom: 6, marginTop: 6 },
  emptySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryBtn: { marginTop: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  listWrap: { gap: 10, marginTop: 10 },
  threadCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1 },
  avatarWrap: { position: 'relative' },
  avatarServiceBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  previewName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, flexShrink: 1 },
  serviceTag: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, flexShrink: 0, maxWidth: 120 },
  serviceTagText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  previewSnippet: { fontSize: 13, lineHeight: 18 },
  tagRow: { flexDirection: 'row', marginTop: 4 },
  statusTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 },
  statusTagText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
  metaCol: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', marginLeft: 10, paddingVertical: 2 },
  previewTime: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  unreadBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, textAlign: 'center' },
  metaSpacer: { height: 20, marginTop: 4 },
});
