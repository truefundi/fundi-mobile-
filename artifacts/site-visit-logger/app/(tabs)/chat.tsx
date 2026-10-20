import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  type ImageStyle,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useColors } from '@/hooks/useColors';
import { useChat, type ChatMessage, type ChatThread, type ServiceRequestDetails } from '@/context/ChatContext';
import { useFundi } from '@/context/FundiContext';
import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { useWork } from '@/context/WorkContext';
import { distanceMeters, formatDistance, googleMapsUrl, canOpenMapNavigation, openMapNavigation } from '@/lib/location';
import { useRequestMediaUri } from '@/hooks/useRequestMediaUri';
import { extractFirstName, formatCancellationNotice, inferCancelledRole, isCancellationEvent } from '@/lib/cancellation';

function StableRequestImage({
  uri,
  style,
  fallbackStyle,
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  fallbackStyle: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const resolvedUri = useRequestMediaUri(uri);
  const source = useMemo(() => (resolvedUri ? { uri: resolvedUri } : null), [resolvedUri]);
  const [failed, setFailed] = useState(false);

  if (!source || failed) {
    return (
      <View style={[fallbackStyle, { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
      </View>
    );
  }

  return <Image source={source} style={style} onError={() => setFailed(true)} />;
}

function RequestVideo({ uri }: { uri: string }) {
  const resolvedUri = useRequestMediaUri(uri);
  if (!resolvedUri) return <View style={styles.videoFrame}><ActivityIndicator /></View>;
  return <ResolvedRequestVideo uri={resolvedUri} />;
}

function ResolvedRequestVideo({ uri }: { uri: string }) {
  const colors = useColors();
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
  });
  const [loading, setLoading] = useState(player.status !== 'readyToPlay');
  const [error, setError] = useState('');

  useEffect(() => {
    const subscription = player.addListener('statusChange', (event) => {
      setLoading(event.status === 'loading' || event.status === 'idle');
      setError(event.status === 'error' ? event.error?.message ?? 'This video could not be loaded.' : '');
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <View style={styles.videoFrame}>
      {error ? (
        <Text style={[styles.mediaError, { color: colors.mutedForeground }]}>{error}</Text>
      ) : (
        <>
          <VideoView
            player={player}
            style={styles.videoPlayer}
            nativeControls
            contentFit="contain"
            allowsPictureInPicture
          />
          {loading ? (
            <View style={styles.videoLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function getDateSeparatorLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Smart relative timestamp for the conversation preview row.
 * - Today: clock time (e.g. "14:35")
 * - Yesterday: "Yesterday"
 * - 2-7 days ago: weekday name (e.g. "Monday", "Wed")
 * - Older: short date (e.g. "12/10/26")
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
    // Active message flow — latest standard user message, prefixed with "You: " if sent by current user.
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { threadId: requestedThreadId } = useLocalSearchParams<{ threadId?: string }>();
  const { account } = useAuth();
  const { profile: technicianProfile } = useWork();
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    sendMessage,
    updateRequestStatus,
    sendPriceOffer,
    respondToOffer,
    endRequestThread,
  } = useChat();
  const { findAnotherTechnician, getJob } = useFundi();

  const [replyText, setReplyText] = useState('');
  const [selectedRequestModal, setSelectedRequestModal] = useState<ServiceRequestDetails | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [mapError, setMapError] = useState('');
  const [actionError, setActionError] = useState('');
  const [declineRequestTarget, setDeclineRequestTarget] = useState<{ threadId: string; requestId: string } | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const [counterOfferModal, setCounterOfferModal] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNotes, setCounterNotes] = useState('');

  const [techOfferModal, setTechOfferModal] = useState(false);
  const [techOfferAmount, setTechOfferAmount] = useState('');
  const [techOfferNotes, setTechOfferNotes] = useState('');

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const activeRequest = activeThread?.messages.find((message) => message.serviceRequest)?.serviceRequest;
  const pendingRequest = activeThread?.messages.find(
    (message) =>
      message.serviceRequest &&
      ['REQUEST_RECEIVED', 'PENDING_RESPONSE'].includes(message.serviceRequest.status),
  )?.serviceRequest;
  const hasAcceptedOffer = activeThread?.messages.some((message) => message.priceOffer?.status === 'ACCEPTED') === true;
  const userRole = account?.role === 'TECHNICIAN' ? 'technician' : 'client';

  // Sort threads by most recent lastMessageTime
  const sortedThreads = useMemo(() => {
    return [...threads].sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
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
    setActiveThreadId(preview.thread.id);
  };

  const isThreadTerminated =
    Boolean(activeThread?.isEnded) ||
    activeRequest?.status === 'CANCELLED' ||
    activeRequest?.status === 'DECLINED' ||
    Boolean(activeThread?.messages.some((m) => isCancellationEvent(m.text)));

  const terminationMsg = activeThread
    ? [...activeThread.messages].reverse().find((m) => isCancellationEvent(m.text))
    : undefined;

  const bannerCancelledRole =
    activeThread?.cancelledByRole ??
    terminationMsg?.cancelledByRole ??
    activeRequest?.cancelledByRole ??
    (activeRequest?.status === 'DECLINED' ? 'technician' : inferCancelledRole(terminationMsg ?? {}, 'client'));

  const bannerCancelledName =
    activeThread?.cancelledByName ??
    terminationMsg?.cancelledByName ??
    activeRequest?.cancelledByName;

  const bannerCancelledId =
    activeThread?.cancelledById ??
    terminationMsg?.cancelledById ??
    activeRequest?.cancelledById;

  const bannerCancellationText = activeThread
    ? formatCancellationNotice({
        cancelledByRole: bannerCancelledRole,
        cancelledByName: bannerCancelledName,
        cancelledById: bannerCancelledId,
        currentUserId: account?.id,
        currentUserRole: userRole,
        currentUserName: account?.name,
        otherParticipantName: activeThread.otherParticipantName,
      })
    : '';

  const canMakeOffer = !!activeThread && !activeThread.isEnded && !hasAcceptedOffer && !isThreadTerminated;
  const technicianLocation =
    account?.role === 'TECHNICIAN' &&
    technicianProfile?.baseLatitude !== undefined &&
    technicianProfile.baseLongitude !== undefined
      ? { latitude: technicianProfile.baseLatitude, longitude: technicianProfile.baseLongitude }
      : activeThread?.technicianLocation;

  const openRequestMap = async (target?: ServiceRequestDetails | null) => {
    const item = target ?? selectedRequestModal;
    if (!item) return;
    setMapError('');
    const success = await openMapNavigation(item);
    if (!success) {
      setMapError('Could not launch map navigation on this device.');
    }
  };

  useEffect(() => {
    if (typeof requestedThreadId === 'string') setActiveThreadId(requestedThreadId);
  }, [requestedThreadId, setActiveThreadId]);

  const closeThread = () => {
    setActiveThreadId(null);
    router.setParams({ threadId: undefined });
  };

  const handleSendText = async () => {
    if (!activeThreadId || !replyText.trim()) return;
    await sendMessage(activeThreadId, replyText.trim());
    setReplyText('');
  };

  const handleSendTechOffer = async () => {
    if (!activeThreadId || !techOfferAmount) return;
    setActionError('');
    try {
      await sendPriceOffer(activeThreadId, parseFloat(techOfferAmount), techOfferNotes);
      setTechOfferAmount('');
      setTechOfferNotes('');
      setTechOfferModal(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not send the offer.');
    }
  };

  const handleSendCounterOffer = async () => {
    if (!activeThreadId || !counterAmount) return;
    setActionError('');
    try {
      await sendPriceOffer(activeThreadId, parseFloat(counterAmount), counterNotes, 'client');
      setCounterAmount('');
      setCounterNotes('');
      setCounterOfferModal(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not send the counter offer.');
    }
  };

  const handleDeclineRequest = async () => {
    if (!declineRequestTarget || !declineReason.trim()) return;
    setActionError('');
    try {
      await updateRequestStatus(declineRequestTarget.threadId, declineRequestTarget.requestId, 'DECLINED', declineReason);
      setDeclineRequestTarget(null);
      setDeclineReason('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not decline the request.');
    }
  };

  const handleFindAnotherTechnician = async (request: ServiceRequestDetails) => {
    if (!activeThread) return;
    setActionError('');
    try {
      if (hasAcceptedOffer) {
        setActionError('Fees have already been agreed with this technician. Please contact support to change technicians.');
        return;
      }
      if (request.status !== 'DECLINED' && request.status !== 'CANCELLED') {
        await updateRequestStatus(activeThread.id, request.id, 'CANCELLED');
      }
      const jobId = activeThread.jobId;
      if (jobId) {
        findAnotherTechnician(jobId);
      }
      router.push({
        pathname: '/select-technician',
        params: {
          ...(jobId ? { jobId } : {}),
          category: request.serviceName,
          service: request.serviceName,
          description: request.problem,
          problem: request.problem,
          location: request.address,
          address: request.address,
          ...(request.latitude !== undefined ? { latitude: String(request.latitude) } : {}),
          ...(request.longitude !== undefined ? { longitude: String(request.longitude) } : {}),
        },
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not find another technician.');
    }
  };

  const handleCancelRequest = async (request: ServiceRequestDetails) => {
    if (!activeThread) return;
    setActionError('');
    try {
      await updateRequestStatus(activeThread.id, request.id, 'CANCELLED');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not cancel the request.');
    }
  };

  const groupedMessages: { dateLabel: string; messages: ChatMessage[] }[] = [];
  if (activeThread) {
    let lastDateLabel = '';
    activeThread.messages.forEach((msg) => {
      const label = getDateSeparatorLabel(msg.timestamp);
      if (label !== lastDateLabel) {
        groupedMessages.push({ dateLabel: label, messages: [msg] });
        lastDateLabel = label;
      } else {
        groupedMessages[groupedMessages.length - 1].messages.push(msg);
      }
    });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      {!activeThread ? (
        <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'web' ? 24 : 16 }]}>
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
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.chatHeader, { paddingTop: Platform.OS === 'web' ? 12 : 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to conversations"
              onPress={closeThread}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.chatHeaderTitle, { color: colors.foreground }]}>{activeThread.otherParticipantName}</Text>
              <Text style={[styles.chatHeaderSub, { color: colors.mutedForeground }]}>
                {activeThread.agreedPrice ? `Agreed Price: RWF ${activeThread.agreedPrice.toLocaleString()}` : 'Price Settlement Chat'}
              </Text>
            </View>
            {activeRequest && canOpenMapNavigation(activeRequest) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Navigate to request location"
                testID="chat-header-navigate-button"
                onPress={() => void openRequestMap(activeRequest)}
                style={({ pressed }) => [
                  styles.headerNavBtn,
                  { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Feather name="navigation" size={13} color={colors.primary} />
                <Text style={[styles.headerNavText, { color: colors.primary }]}>Navigate</Text>
              </Pressable>
            ) : null}
          </View>

          {isThreadTerminated ? (
            <View style={[styles.cancellationBanner, { backgroundColor: colors.destructive + '14', borderColor: colors.destructive + '40' }]}>
              <View style={styles.cancellationBannerTop}>
                <Ionicons name="close-circle" size={22} color={colors.destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cancellationBannerTitle, { color: colors.destructive }]}>
                    {bannerCancellationText}
                  </Text>
                  <Text style={[styles.cancellationBannerSub, { color: colors.mutedForeground }]}>
                    {userRole === 'client'
                      ? 'This service request was terminated. You can rebook with another available technician.'
                      : 'This service request was terminated.'}
                  </Text>
                </View>
              </View>
              {userRole === 'client' && (
                <View style={styles.cancellationBannerActions}>
                  <Button
                    label="Book another technician"
                    icon="person-add-outline"
                    size="small"
                    onPress={() => {
                      const req = activeRequest;
                      const job = activeThread.jobId ? getJob(activeThread.jobId) : undefined;
                      router.push({
                        pathname: '/select-technician',
                        params: {
                          ...(activeThread.jobId ? { jobId: activeThread.jobId } : {}),
                          category: req?.serviceName ?? job?.service,
                          service: req?.serviceName ?? job?.service,
                          description: req?.problem ?? job?.problem,
                          problem: req?.problem ?? job?.problem,
                          location: req?.address ?? job?.locationLabel,
                          address: req?.address ?? job?.locationLabel,
                          ...(req?.latitude !== undefined || job?.locationLatitude !== undefined
                            ? { latitude: String(req?.latitude ?? job?.locationLatitude) }
                            : {}),
                          ...(req?.longitude !== undefined || job?.locationLongitude !== undefined
                            ? { longitude: String(req?.longitude ?? job?.locationLongitude) }
                            : {}),
                        },
                      });
                    }}
                  />
                </View>
              )}
            </View>
          ) : null}

          <FlatList
            data={groupedMessages}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.messageList}
            renderItem={({ item: group }) => (
              <View>
                <View style={[styles.dateSeparatorWrap, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.dateSeparatorText, { color: colors.secondaryForeground }]}>{group.dateLabel}</Text>
                </View>

                {group.messages.map((msg) => {
                  const isMe = msg.senderId === account?.id;
                  const timeFormatted = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const serviceRequest = msg.serviceRequest;
                  const thumbnailUri = serviceRequest
                    ? serviceRequest.photos?.find((uri) => uri.trim().length > 0) ?? serviceRequest.thumbnailUri
                    : undefined;
                  const distanceLabel = serviceRequest
                    ? formatDistance(
                        distanceMeters(
                          { latitude: serviceRequest.latitude, longitude: serviceRequest.longitude },
                          technicianLocation,
                        ),
                      )
                    : null;

                  return (
                    <View key={msg.id} style={[styles.msgContainer, isMe ? styles.msgAlignRight : styles.msgAlignLeft]}>

                      {/* SERVICE REQUEST CARD */}
                      {msg.serviceRequest ? (
                        <View style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={styles.requestCardTop}>
                            {thumbnailUri ? (
                              <View style={styles.thumbnailFrame}>
                                <StableRequestImage
                                  key={thumbnailUri}
                                  uri={thumbnailUri}
                                  style={styles.requestThumb}
                                  fallbackStyle={styles.requestThumbFallback}
                                />
                              </View>
                            ) : (
                              <View style={[styles.requestThumbFallback, { backgroundColor: colors.secondary }]}>
                                <Ionicons name="construct-outline" size={22} color={colors.primary} />
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.reqTitle, { color: colors.foreground }]}>{msg.serviceRequest.serviceName} Service Request</Text>

                              <Text numberOfLines={1} style={[styles.reqLocation, { color: colors.mutedForeground }]}>
                                📍 {msg.serviceRequest.address}
                                {msg.serviceRequest.landmark ? ` · ${msg.serviceRequest.landmark}` : ''}
                                {distanceLabel ? ` · ${distanceLabel}` : ''}
                              </Text>

                              <Text numberOfLines={2} style={[styles.reqProblem, { color: colors.mutedForeground }]}>{msg.serviceRequest.problem}</Text>
                              {msg.serviceRequest.declineReason ? (
                                <Text style={[styles.reqProblem, { color: colors.destructive }]}>
                                  Reason declined: {msg.serviceRequest.declineReason}
                                </Text>
                              ) : null}

                              <View style={styles.reqCardActionRow}>
                                <Pressable onPress={() => setSelectedRequestModal(msg.serviceRequest ?? null)} style={{ paddingVertical: 4 }}>
                                  <Text style={[styles.viewDetailsLink, { color: colors.primary }]}>View Details →</Text>
                                </Pressable>
                                {canOpenMapNavigation(msg.serviceRequest) ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="Navigate to request location"
                                    testID="chat-request-navigate-button"
                                    onPress={() => void openRequestMap(msg.serviceRequest)}
                                    style={({ pressed }) => [
                                      styles.quickNavigateButton,
                                      {
                                        backgroundColor: colors.secondary,
                                        borderColor: colors.border,
                                        opacity: pressed ? 0.75 : 1,
                                      },
                                    ]}
                                  >
                                    <Feather name="navigation" size={13} color={colors.primary} />
                                    <Text style={[styles.quickNavigateText, { color: colors.primary }]}>Navigate</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </View>
                          </View>

                          {userRole === 'technician' && ['REQUEST_RECEIVED', 'PENDING_RESPONSE'].includes(msg.serviceRequest.status) && !activeThread.isEnded && (
                            <View style={styles.actionButtonRow}>
                              <Button label="Accept" size="small" onPress={() => updateRequestStatus(activeThread.id, msg.serviceRequest!.id, 'ACCEPTED')} style={{ flex: 1 }} />
                              <Button
                                label="Decline"
                                variant="outline"
                                size="small"
                                onPress={() => {
                                  setActionError('');
                                  setDeclineReason('');
                                  setDeclineRequestTarget({ threadId: activeThread.id, requestId: msg.serviceRequest!.id });
                                }}
                                style={{ flex: 1 }}
                              />
                            </View>
                          )}

                          {userRole === 'client' && (
                            <View style={styles.statusFooterRow}>
                              <View style={styles.statusIndicatorWrap}>
                                <Ionicons
                                  name={msg.serviceRequest.status === 'CANCELLED' || msg.serviceRequest.status === 'DECLINED' ? 'close-circle-outline' : 'time-outline'}
                                  size={14}
                                  color={msg.serviceRequest.status === 'CANCELLED' || msg.serviceRequest.status === 'DECLINED' ? colors.destructive : colors.warning}
                                />
                                <Text style={[styles.statusText, { color: colors.foreground }]}>
                                  Status:{' '}
                                  <Text style={{ fontWeight: '700', color: msg.serviceRequest.status === 'CANCELLED' || msg.serviceRequest.status === 'DECLINED' ? colors.destructive : colors.foreground }}>
                                    {msg.serviceRequest.status === 'CANCELLED' || msg.serviceRequest.status === 'DECLINED'
                                      ? formatCancellationNotice({
                                          cancelledByRole: msg.serviceRequest.cancelledByRole ?? inferCancelledRole(msg, 'client'),
                                          cancelledByName: msg.serviceRequest.cancelledByName,
                                          cancelledById: msg.serviceRequest.cancelledById,
                                          currentUserId: account?.id,
                                          currentUserRole: userRole,
                                          currentUserName: account?.name,
                                          otherParticipantName: activeThread.otherParticipantName,
                                        })
                                      : msg.serviceRequest.status}
                                  </Text>
                                </Text>
                              </View>
                              {msg.serviceRequest.status === 'ACCEPTED' && !activeThread.isEnded && (
                                <Pressable onPress={() => endRequestThread(activeThread.id)}>
                                  <Text style={[styles.cancelTextBtn, { color: colors.primary }]}>End Request</Text>
                                </Pressable>
                              )}
                            </View>
                          )}
                          <Text style={[styles.timestampText, { color: colors.mutedForeground }]}>{timeFormatted}</Text>
                        </View>
                      ) : msg.priceOffer ? (
                        <View style={[styles.offerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.offerCardHeader, { color: colors.mutedForeground }]}>Service Cost</Text>
                          <Text style={[styles.offerAmount, { color: colors.foreground }]}>{msg.priceOffer.currency} {msg.priceOffer.amount.toLocaleString()}</Text>
                          <Text style={[styles.offerSub, { color: colors.mutedForeground }]}>
                            {msg.priceOffer.senderRole === 'technician' ? 'Proposed by the technician' : 'Counteroffer by the client'}
                          </Text>

                          {userRole === 'client' && msg.priceOffer.status === 'PENDING' && (
                            <View style={styles.offerActionColumn}>
                              <Button
                                label="Accept Offer"
                                size="small"
                                disabled={hasAcceptedOffer}
                                onPress={() => respondToOffer(activeThread.id, msg.priceOffer!.id, 'ACCEPTED')}
                              />
                              <Button
                                label="Counter Offer"
                                variant="outline"
                                size="small"
                                disabled={!canMakeOffer}
                                onPress={() => setCounterOfferModal(true)}
                              />
                              <Pressable onPress={() => respondToOffer(activeThread.id, msg.priceOffer!.id, 'DECLINED')} style={{ alignSelf: 'center', marginTop: 6 }}>
                                <Text style={{ color: colors.destructive, fontWeight: '600', fontSize: 13 }}>Decline Offer</Text>
                              </Pressable>
                            </View>
                          )}

                          {msg.priceOffer.status !== 'PENDING' && (
                            <View style={[styles.badgeStatus, { backgroundColor: colors.secondary }]}>
                              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Offer {msg.priceOffer.status}</Text>
                            </View>
                          )}
                          {hasAcceptedOffer && msg.priceOffer.status === 'PENDING' ? (
                            <View style={[styles.badgeStatus, { backgroundColor: colors.secondary }]}>
                              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Further offers are locked</Text>
                            </View>
                          ) : null}
                          <Text style={[styles.timestampText, { color: colors.mutedForeground }]}>{timeFormatted}</Text>
                        </View>
                      ) : isCancellationEvent(msg.text) ? (
                        <View style={styles.systemBubbleRow}>
                          <View style={[styles.systemBubble, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '35' }]}>
                            <Ionicons name="close-circle-outline" size={15} color={colors.destructive} />
                            <Text style={[styles.systemBubbleText, { color: colors.destructive }]}>
                              {formatCancellationNotice({
                                cancelledByRole: msg.cancelledByRole ?? inferCancelledRole(msg, 'client'),
                                cancelledByName: msg.cancelledByName,
                                cancelledById: msg.cancelledById,
                                currentUserId: account?.id,
                                currentUserRole: userRole,
                                currentUserName: account?.name,
                                otherParticipantName: activeThread.otherParticipantName,
                              })}
                            </Text>
                            <Text style={[styles.systemBubbleTime, { color: colors.mutedForeground }]}>{timeFormatted}</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.standardBubble, { backgroundColor: isMe ? colors.primary : colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.standardText, { color: isMe ? colors.primaryForeground : colors.foreground }]}>{msg.text}</Text>
                          <Text style={[styles.timestampTextSecondary, { color: isMe ? colors.primaryForeground + '80' : colors.mutedForeground }]}>{timeFormatted}</Text>
                        </View>
                      )}

                    </View>
                  );
                })}
              </View>
            )}
          />

          {userRole === 'technician' && (
            <View style={[styles.techTopBarAction, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Button
                label={hasAcceptedOffer ? 'Offers Locked' : 'Send Service Offer'}
                size="small"
                icon="pricetag-outline"
                disabled={!canMakeOffer}
                onPress={() => setTechOfferModal(true)}
                style={{ flex: 1 }}
              />
            </View>
          )}

{userRole === 'client' && pendingRequest && !activeThread?.isEnded ? (
            <View style={[styles.pendingRequestActions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <Button
                label="Cancel Request"
                variant="danger"
                onPress={() => void handleCancelRequest(pendingRequest)}
                textColor="#ffffff"
                style={{ flex: 1, backgroundColor: colors.destructive, borderColor: colors.destructive }}
              />
              <Button
                label="Cancel & Find Another Technician"
                variant="outline"
                onPress={() => void handleFindAnotherTechnician(pendingRequest)}
                textColor={colors.accentForeground}
                style={{ flex: 1, backgroundColor: colors.accent, borderColor: colors.accent }}
              />
            </View>
          ) : null}

          {actionError ? (
            <Text accessibilityLiveRegion="polite" style={[styles.actionError, { color: colors.destructive, backgroundColor: colors.card }]}>
              {actionError}
            </Text>
          ) : null}
          {isThreadTerminated ? (
            <View style={[styles.terminatedBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 14 }]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.terminatedBarText, { color: colors.mutedForeground }]}>
                {bannerCancellationText} · Chat is closed.
              </Text>
            </View>
          ) : (
            <View style={[styles.replyBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 14 }]}>
              <TextInput
                placeholder="Type a message..."
                placeholderTextColor={colors.mutedForeground}
                value={replyText}
                onChangeText={setReplyText}
                style={[styles.replyInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              />
              <Button label="Send" size="small" onPress={handleSendText} />
            </View>
          )}
        </View>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedRequestModal && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Complete Request Details</Text>
                <Pressable onPress={() => setSelectedRequestModal(null)}>
                  <Feather name="x" size={20} color={colors.foreground} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
                <Text style={[styles.modalSub, { color: colors.primary }]}>{selectedRequestModal.serviceName} Service</Text>

                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Problem Statement:</Text>
                <Text style={[styles.modalValue, { color: colors.foreground }]}>{selectedRequestModal.problem}</Text>

                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Full Address & Landmark:</Text>
                <Text style={[styles.modalValue, { color: colors.foreground }]}>
                  {selectedRequestModal.address}
                  {selectedRequestModal.landmark ? ` (Landmark: ${selectedRequestModal.landmark})` : ''}
                  {formatDistance(
                    distanceMeters(
                      { latitude: selectedRequestModal.latitude, longitude: selectedRequestModal.longitude },
                      technicianLocation,
                    ),
                  )
                    ? ` · Distance: ${formatDistance(
                        distanceMeters(
                          { latitude: selectedRequestModal.latitude, longitude: selectedRequestModal.longitude },
                          technicianLocation,
                        ),
                      )}`
                    : ''}
                </Text>

                {canOpenMapNavigation(selectedRequestModal) ? (
                  <Button
                    label="Navigate / Show on Map"
                    variant="outline"
                    featherIcon="navigation"
                    onPress={() => void openRequestMap(selectedRequestModal)}
                  />
                ) : null}
                {mapError ? <Text style={[styles.mediaError, { color: colors.destructive }]}>{mapError}</Text> : null}

                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Created On:</Text>
                <Text style={[styles.modalValue, { color: colors.foreground }]}>{new Date(selectedRequestModal.createdAt).toLocaleString()}</Text>

                {selectedRequestModal.photos?.length > 0 && (
                  <>
                    <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Uploaded Photos Gallery:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {selectedRequestModal.photos.map((p: string, idx: number) => (
                        <Pressable key={`${p}-${idx}`} onPress={() => setPreviewImage(p)}>
                          <StableRequestImage
                            uri={p}
                            style={styles.galleryThumb}
                            fallbackStyle={styles.galleryThumbFallback}
                          />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {selectedRequestModal.videos?.length > 0 && (
                  <>
                    <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Attached Videos:</Text>
                    {selectedRequestModal.videos.map((v: string, idx: number) => (
                      <RequestVideo key={`${v}-${idx}`} uri={v} />
                    ))}
                  </>
                )}

                <Modal
                  visible={previewImage !== null}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setPreviewImage(null)}
                >
                  <Pressable style={styles.imagePreviewOverlay} onPress={() => setPreviewImage(null)}>
                    <Pressable onPress={(event) => event.stopPropagation()}>
                      {previewImage ? (
                        <StableRequestImage
                          uri={previewImage}
                          style={styles.imagePreview}
                          fallbackStyle={styles.imagePreviewFallback}
                        />
                      ) : null}
                    </Pressable>
                    <Pressable style={styles.imagePreviewClose} onPress={() => setPreviewImage(null)} accessibilityLabel="Close image preview">
                      <Feather name="x" size={24} color="#fff" />
                    </Pressable>
                  </Pressable>
                </Modal>

                <Button label="Close Details" variant="outline" onPress={() => setSelectedRequestModal(null)} style={{ marginTop: 12 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* TECHNICIAN OFFER MODAL */}
      <Modal visible={techOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Send Service Offer</Text>
            <TextInput
              placeholder="Amount in RWF (e.g. 25000)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={techOfferAmount}
              onChangeText={setTechOfferAmount}
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            />
            <TextInput
              placeholder="Optional notes or price breakdown"
              placeholderTextColor={colors.mutedForeground}
              value={techOfferNotes}
              onChangeText={setTechOfferNotes}
              multiline
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, minHeight: 70 }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Button label="Cancel" variant="outline" onPress={() => setTechOfferModal(false)} style={{ flex: 1 }} />
              <Button label="Submit Offer" onPress={handleSendTechOffer} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* CLIENT COUNTER OFFER MODAL */}
      <Modal visible={counterOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Send Counter Offer</Text>
            <TextInput
              placeholder="Proposed Amount in RWF"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={counterAmount}
              onChangeText={setCounterAmount}
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            />
            <TextInput
              placeholder="Reason or explanation for counteroffer"
              placeholderTextColor={colors.mutedForeground}
              value={counterNotes}
              onChangeText={setCounterNotes}
              multiline
              style={[styles.inputField, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, minHeight: 70 }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Button label="Cancel" variant="outline" onPress={() => setCounterOfferModal(false)} style={{ flex: 1 }} />
              <Button label="Send Counter" onPress={handleSendCounterOffer} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={declineRequestTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDeclineRequestTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Decline this request?</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Tell the client why you cannot take this job. They can use the reason to find another technician.
            </Text>
            <TextInput
              testID="request-decline-reason"
              accessibilityLabel="Reason for declining"
              placeholder="Enter your reason"
              placeholderTextColor={colors.mutedForeground}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
              style={[
                styles.inputField,
                { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, minHeight: 90 },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Button
                label="Keep request"
                variant="outline"
                onPress={() => setDeclineRequestTarget(null)}
                style={{ flex: 1 }}
              />
              <Button
                label="Decline request"
                variant="danger"
                disabled={!declineReason.trim()}
                onPress={handleDeclineRequest}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyContainer: { borderWidth: 1, borderRadius: 16, padding: 28, alignItems: 'center', marginTop: 24, gap: 10 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, textAlign: 'center' },
  emptySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  listWrap: { marginTop: 16, gap: 10 },
  threadCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 14 },
  avatarBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewName: { fontFamily: 'Inter_600SemiBold', fontSize: 16, flex: 1 },
  previewTime: { fontFamily: 'Inter_400Regular', fontSize: 12, marginLeft: 8 },
  previewSnippet: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  chatHeaderTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  chatHeaderSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  messageList: { padding: 16, gap: 12 },
  dateSeparatorWrap: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, alignSelf: 'center', marginBottom: 12, marginTop: 4 },
  dateSeparatorText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  msgContainer: { marginVertical: 4, width: '100%' },
  msgAlignRight: { alignItems: 'flex-end' },
  msgAlignLeft: { alignItems: 'flex-start' },
  requestCard: { borderWidth: 1, borderRadius: 16, padding: 14, width: '88%', maxWidth: 450, gap: 12 },
  requestCardTop: { flexDirection: 'row' },
  thumbnailFrame: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  requestThumb: { width: 64, height: 64, borderRadius: 10 },
  requestThumbFallback: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  reqTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  reqLocation: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  reqProblem: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  viewDetailsLink: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  actionButtonRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#00000010', paddingTop: 10 },
  statusFooterRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#00000010', paddingTop: 10 },
  statusIndicatorWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  cancelTextBtn: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  timestampText: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'right', marginTop: 4 },
  offerCard: { borderWidth: 1, borderRadius: 16, padding: 16, width: '85%', maxWidth: 400, gap: 8 },
  offerCardHeader: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  offerAmount: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  offerSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  offerActionColumn: { gap: 8, marginTop: 8 },
  badgeStatus: { padding: 6, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  standardBubble: { borderWidth: 1, borderRadius: 14, padding: 12, maxWidth: '80%', gap: 4 },
  standardText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  timestampTextSecondary: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'right' },
  cancellationBanner: { marginHorizontal: 16, marginTop: 10, marginBottom: 4, padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  cancellationBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancellationBannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  cancellationBannerSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  cancellationBannerActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  systemBubbleRow: { width: '100%', alignItems: 'center', marginVertical: 8 },
  systemBubble: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, maxWidth: '90%' },
  systemBubbleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  systemBubbleTime: { fontFamily: 'Inter_400Regular', fontSize: 10, marginLeft: 4 },
  terminatedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  terminatedBarText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  techTopBarAction: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, flexDirection: 'row' },
  pendingRequestActions: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, gap: 8 },
  replyBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  replyInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, height: 42, fontSize: 14 },
  actionError: { fontFamily: 'Inter_500Medium', fontSize: 12, width: '100%', marginBottom: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { borderWidth: 1, borderRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  modalSub: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  modalLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  modalValue: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  galleryThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  galleryThumbFallback: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  videoPlayer: { flex: 1 },
  videoLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000030' },
  mediaError: { fontFamily: 'Inter_400Regular', fontSize: 13, padding: 10, textAlign: 'center' },
  imagePreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  imagePreview: { width: '100%', height: '85%' },
  imagePreviewFallback: { width: '100%', height: '85%' },
  imagePreviewClose: { position: 'absolute', top: 48, right: 20, padding: 10 },
  inputField: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, marginTop: 8 },
  headerNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  headerNavText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  reqCardActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 10 },
  quickNavigateButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  quickNavigateText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});