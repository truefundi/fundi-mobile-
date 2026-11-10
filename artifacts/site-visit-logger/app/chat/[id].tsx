import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useFundi } from '@/context/FundiContext';
import { useChatRoom, type ChatTimelineMessage } from '@/hooks/useChatRoom';
import { fetchCustomerJob } from '@/lib/jobs-api';
import { CHAT_TEXT_MAX_LENGTH, type BackendChatRoom } from '@/lib/chat-rooms-api';
import { getServiceIcon } from '@/lib/categories-api';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';

/**
 * Job chat between a customer and the technician assigned to the job
 * (`/api/v1/chat/rooms` + the `/chat` Socket.IO namespace).
 *
 * The route id may be a chat room id or a job id (with an optional
 * `requestId` job hint). When no chat room exists yet, the screen hands off to
 * the price negotiation (`/negotiation/[id]`) if one exists for the job.
 *
 * Access rules: customers can only send once the job's booking fee is PAID;
 * technicians can send as soon as they are the assigned member. The backend
 * enforces the room's own writability (active room, current assignment,
 * ASSIGNED/PAUSED job).
 */

type FeeStatus = 'checking' | 'PAID' | 'UNPAID' | 'unknown';

/** Verifies a customer's booking fee for the job, preferring backend truth over cached state. */
function useBookingFeeStatus(jobId: string | undefined, isTechnician: boolean) {
  const { getJob } = useFundi();
  const cached = jobId ? getJob(jobId) : undefined;
  const cachedPaid = cached?.bookingFee?.status === 'PAID';
  const [status, setStatus] = useState<FeeStatus>(isTechnician || cachedPaid ? 'PAID' : 'checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isTechnician || cachedPaid) {
      setStatus('PAID');
      return;
    }
    if (!jobId) return;
    let cancelled = false;
    setStatus('checking');
    fetchCustomerJob(jobId)
      .then((job) => {
        if (!cancelled) setStatus(job.bookingPayment ? 'PAID' : 'UNPAID');
      })
      .catch(() => {
        if (!cancelled) setStatus('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, isTechnician, cachedPaid, attempt]);

  return { status, amount: cached?.bookingFee?.amount, retry: () => setAttempt((n) => n + 1) };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const JOB_STATUS_TEXT: Record<string, string> = {
  OPEN: 'Awaiting assignment',
  ASSIGNED: 'Technician assigned',
  IN_PROGRESS: 'Work in progress',
  PAUSED: 'Job paused',
  COMPLETED: 'Job completed',
  CANCELLED: 'Job cancelled',
  FAILED: 'Job closed',
};

/** Explains why a room is read-only, or null when it accepts messages. */
function readOnlyReason(room: BackendChatRoom): string | null {
  if (room.currentMember?.blockedAt) return 'You can no longer send messages in this chat.';
  if (room.status === 'COMPLETED') return 'This job is complete. The chat is now read-only.';
  if (room.status === 'DISABLED') {
    return room.disabledReason ? `Chat disabled: ${room.disabledReason}` : 'This chat has been disabled.';
  }
  if (room.assignment.endedAt) return 'This technician is no longer assigned to the job.';
  if (room.job.status !== 'ASSIGNED' && room.job.status !== 'PAUSED') {
    return `${JOB_STATUS_TEXT[room.job.status] ?? 'Job closed'}. New messages are turned off.`;
  }
  return null;
}

export default function JobChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const { getJob } = useFundi();
  const { threads, findThreadForJob, isLoading: negotiationsLoading } = useChat();
  const { id: routeId, requestId, firstMessage } = useLocalSearchParams<{
    id?: string;
    requestId?: string;
    firstMessage?: string;
  }>();

  const chat = useChatRoom(routeId, requestId);
  const { room } = chat;
  const isTechnician = account?.role === 'TECHNICIAN';
  const jobId = room?.jobId ?? requestId ?? undefined;
  const fee = useBookingFeeStatus(room ? room.jobId : undefined, isTechnician);
  const localJob = jobId ? getJob(jobId) : undefined;

  const [draft, setDraft] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // ── Hand-off to negotiation when there is no chat room for this id ──────
  const negotiation = useMemo(() => {
    if (room) return room.jobId ? findThreadForJob(room.jobId) : undefined;
    const byId = threads.find((t) => t.id === routeId);
    if (byId) return byId;
    return [routeId, requestId]
      .filter((v): v is string => Boolean(v))
      .map((value) => findThreadForJob(value))
      .find(Boolean);
  }, [room, threads, routeId, requestId, findThreadForJob]);

  useEffect(() => {
    if (chat.resolution === 'not-found' && negotiation) {
      router.replace({ pathname: '/negotiation/[id]', params: { id: negotiation.id, requestId: negotiation.jobId } });
    }
  }, [chat.resolution, negotiation, router]);

  // ── Navigation guards: never return into checkout screens ───────────────
  const goToList = useCallback(() => router.replace('/(tabs)/chat'), [router]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goToList();
      return true;
    });
    return () => sub.remove();
  }, [goToList]);

  // ── Derived display state ───────────────────────────────────────────────
  const other = room ? (isTechnician ? room.job.customer : room.job.technician) : null;
  const otherName = other?.fullName || (isTechnician ? 'Client' : 'Technician');
  const otherAvatar = !isTechnician
    ? localJob?.technician?.avatarUrl || localJob?.technician?.photoUri || undefined
    : undefined;
  const otherPhone = !isTechnician ? localJob?.technician?.phone : undefined;
  const serviceName = room?.job.service || localJob?.service;
  const lockReason = room ? readOnlyReason(room) : null;
  const feeBlocksClient = !isTechnician && fee.status !== 'PAID';
  const canSend = Boolean(room && chat.canWrite && !feeBlocksClient);

  const statusLine = chat.otherTyping
    ? 'typing…'
    : room
      ? JOB_STATUS_TEXT[room.job.status] ?? room.job.status
      : '';

  const inputPlaceholder = lockReason
    ? 'Messaging is turned off'
    : feeBlocksClient
      ? fee.status === 'checking'
        ? 'Verifying booking fee…'
        : 'Pay the booking fee to message your technician'
      : 'Type a message…';

  // Inverted list: newest first.
  const timeline = useMemo(() => [...chat.messages].reverse(), [chat.messages]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!canSend) return;
    const text = draft.trim();
    if (!text) return;
    try {
      chat.sendText(text);
      setDraft('');
    } catch (err) {
      Alert.alert('Message not sent', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleChangeDraft = (value: string) => {
    setDraft(value);
    if (canSend) chat.setTyping(value.trim().length > 0);
  };

  const pickImage = async () => {
    if (!canSend) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    chat.sendMedia('IMAGE', {
      uri: asset.uri,
      name: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? undefined,
    });
  };

  const pickDocument = async () => {
    if (!canSend) return;
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    chat.sendMedia('FILE', {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? undefined,
      sizeBytes: asset.size ?? undefined,
    });
  };

  const handleAttach = () => {
    if (!canSend) return;
    Alert.alert('Share with your ' + (isTechnician ? 'client' : 'technician'), undefined, [
      { text: 'Photo', onPress: () => void pickImage() },
      { text: 'Document', onPress: () => void pickDocument() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleFailedPress = (message: ChatTimelineMessage) => {
    Alert.alert('Message not sent', message.deliveryError ?? 'The message could not be delivered.', [
      { text: 'Retry', onPress: () => chat.retryMessage(message.id) },
      { text: 'Delete', style: 'destructive', onPress: () => chat.discardMessage(message.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openAttachment = (message: ChatTimelineMessage) => {
    const url = message.downloadUrl;
    if (!url) return;
    if (message.type === 'IMAGE') {
      setPreviewUri(url);
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Unable to open attachment', 'Try again in a moment.'));
  };

  const openNegotiation = () => {
    if (!negotiation) return;
    router.push({ pathname: '/negotiation/[id]', params: { id: negotiation.id, requestId: negotiation.jobId } });
  };

  // ── Non-room states ─────────────────────────────────────────────────────
  if (chat.resolution !== 'found' || !room) {
    const waitingForHandOff = chat.resolution === 'not-found' && (negotiation || negotiationsLoading);
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <BackButton onPress={goToList} />
          <Text style={[styles.headerName, { color: colors.foreground, marginLeft: 10 }]}>Chat</Text>
        </View>
        <View style={styles.centerState}>
          {chat.resolution === 'resolving' || waitingForHandOff ? (
            <>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>Opening conversation…</Text>
            </>
          ) : chat.resolution === 'error' ? (
            <>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.centerTitle, { color: colors.foreground }]}>Can't reach chat right now</Text>
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
                {chat.resolveError ?? 'Check your connection and try again.'}
              </Text>
              <Button label="Try again" size="small" onPress={chat.retryResolve} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.centerTitle, { color: colors.foreground }]}>Chat not open yet</Text>
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
                The job chat opens once a technician is assigned to your request.
              </Text>
              {jobId ? (
                <Button
                  label="Track job"
                  size="small"
                  variant="outline"
                  icon="arrow-forward"
                  onPress={() => router.push(`/job/${jobId}` as any)}
                  style={{ marginTop: 14 }}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Message rendering ───────────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: ChatTimelineMessage; index: number }) => {
    const older = timeline[index + 1];
    const showDate = !older || new Date(older.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
    const separator = showDate ? (
      <View style={styles.dateSeparatorWrap}>
        <View style={[styles.dateSeparatorPill, { backgroundColor: colors.muted + '40' }]}>
          <Text style={[styles.dateSeparatorText, { color: colors.mutedForeground }]}>{dateLabel(item.createdAt)}</Text>
        </View>
      </View>
    ) : null;

    if (item.type === 'SYSTEM' || item.senderRole === 'SYSTEM' || item.senderRole === 'ADMIN') {
      return (
        <View>
          {separator}
          <View style={styles.systemWrap}>
            <View style={[styles.systemBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons
                name={item.senderRole === 'ADMIN' ? 'shield-checkmark-outline' : 'information-circle-outline'}
                size={14}
                color={colors.primary}
              />
              <Text style={[styles.systemText, { color: colors.secondaryForeground }]}>
                {item.senderRole === 'ADMIN' ? `Fundi support: ${item.text ?? ''}` : item.text ?? 'Update'}
              </Text>
            </View>
            <Text style={[styles.systemTime, { color: colors.mutedForeground }]}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
      );
    }

    const isMe = item.senderId === account?.id;
    const bubbleColor = isMe ? colors.primary : colors.card;
    const textColor = isMe ? colors.primaryForeground : colors.foreground;
    const metaColor = isMe ? colors.primaryForeground + 'B3' : colors.mutedForeground;
    const hidden = item.isTombstone || item.isBlocked;
    const imageUri = item.type === 'IMAGE' ? item.localUri ?? item.downloadUrl : null;

    const deliveryIcon = !isMe ? null : item.delivery === 'sending' ? (
      <Ionicons name="time-outline" size={12} color={metaColor} />
    ) : item.delivery === 'failed' ? (
      <Ionicons name="alert-circle" size={13} color={colors.destructive} />
    ) : (
      <Ionicons name={item.readByOtherSide ? 'checkmark-done' : 'checkmark'} size={13} color={metaColor} />
    );

    let content: React.ReactNode;
    if (hidden) {
      content = (
        <Text style={[styles.bubbleText, styles.hiddenText, { color: metaColor }]}>
          {item.isTombstone ? 'This message was deleted' : 'This message was removed by a moderator'}
        </Text>
      );
    } else if (imageUri) {
      content = (
        <Pressable onPress={() => openAttachment(item)} disabled={!item.downloadUrl}>
          <Image source={{ uri: imageUri }} style={styles.chatPhoto} resizeMode="cover" />
        </Pressable>
      );
    } else if (item.type === 'FILE' || item.type === 'VIDEO' || item.type === 'VOICE_NOTE') {
      const icon = item.type === 'VIDEO' ? 'video-outline' : item.type === 'VOICE_NOTE' ? 'microphone-outline' : 'file-document-outline';
      const label = item.type === 'VOICE_NOTE' ? 'Voice note' : item.fileName || (item.type === 'VIDEO' ? 'Video' : 'Document');
      const detail = item.type === 'VOICE_NOTE' && item.durationSeconds
        ? `${Math.round(item.durationSeconds)}s`
        : formatBytes(item.sizeBytes);
      content = (
        <Pressable onPress={() => openAttachment(item)} disabled={!item.downloadUrl} style={styles.attachmentRow}>
          <MaterialCommunityIcons name={icon as any} size={22} color={textColor} />
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={[styles.attachmentName, { color: textColor }]}>{label}</Text>
            {detail ? <Text style={[styles.attachmentDetail, { color: metaColor }]}>{detail}</Text> : null}
          </View>
        </Pressable>
      );
    } else {
      content = <Text style={[styles.bubbleText, { color: textColor }]}>{item.text}</Text>;
    }

    return (
      <View>
        {separator}
        <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
          <Pressable
            disabled={item.delivery !== 'failed'}
            onPress={() => handleFailedPress(item)}
            style={[
              styles.chatBubble,
              isMe ? styles.bubbleMe : [styles.bubbleOther, { borderColor: colors.border }],
              { backgroundColor: bubbleColor, opacity: item.delivery === 'sending' ? 0.7 : 1 },
            ]}
          >
            {content}
            <View style={styles.bubbleMeta}>
              {item.editedAt && !hidden ? <Text style={[styles.bubbleTime, { color: metaColor }]}>edited · </Text> : null}
              <Text style={[styles.bubbleTime, { color: metaColor }]}>{formatTime(item.createdAt)}</Text>
              {deliveryIcon}
            </View>
          </Pressable>
          {item.delivery === 'failed' ? (
            <Text style={[styles.failedText, { color: colors.destructive }]}>Not sent · tap to retry</Text>
          ) : null}
        </View>
      </View>
    );
  };

  // Rich job card shown at the start of the conversation (footer of an inverted list).
  const jobCard = (
    <View>
      {chat.hasOlder ? (
        <Pressable onPress={() => void chat.loadOlder()} style={styles.loadOlder} disabled={chat.isLoadingOlder}>
          {chat.isLoadingOlder ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.loadOlderText, { color: colors.primary }]}>Load earlier messages</Text>
          )}
        </Pressable>
      ) : null}
      <View style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.reqCardHeader}>
          <View style={[styles.reqHeaderIconTile, { backgroundColor: colors.secondary }]}>
            <MaterialCommunityIcons name={getServiceIcon(serviceName) as any} size={16} color={colors.primary} />
          </View>
          <Text style={[styles.reqCardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {serviceName ? `${serviceName} job` : 'Service job'}
          </Text>
          <View style={[styles.reqStatusBadge, { backgroundColor: (fee.status === 'PAID' ? colors.success : colors.warning) + '1A' }]}>
            <Text style={[styles.reqStatusBadgeText, { color: fee.status === 'PAID' ? colors.success : colors.warning }]}>
              {fee.status === 'PAID' ? 'Booking fee paid' : fee.status === 'checking' ? 'Checking payment' : 'Payment pending'}
            </Text>
          </View>
        </View>
        {room.job.description ? (
          <Text numberOfLines={4} style={[styles.reqProblem, { color: colors.foreground }]}>{room.job.description}</Text>
        ) : null}
        {localJob?.locationLabel ? (
          <Text numberOfLines={1} style={[styles.reqAddress, { color: colors.mutedForeground }]}>📍 {localJob.locationLabel}</Text>
        ) : null}
        <View style={[styles.reqActionRow, { borderTopColor: colors.border }]}>
          <Pressable onPress={() => router.push(`/job/${room.jobId}` as any)} style={styles.reqActionBtn}>
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.reqActionBtnText, { color: colors.primary }]}>Track job</Text>
          </Pressable>
          {negotiation ? (
            <Pressable onPress={openNegotiation} style={styles.reqActionBtn} testID="chat-open-negotiation">
              <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
              <Text style={[styles.reqActionBtnText, { color: colors.primary }]}>
                {negotiation.agreedPrice ? `Agreed RWF ${negotiation.agreedPrice.toLocaleString()}` : 'Price agreement'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <BackButton onPress={goToList} />
        <ProfileAvatar uri={otherAvatar} name={otherName} size={38} style={styles.headerAvatarWrap} testID="chat-header-avatar" />
        <View style={styles.headerInfo}>
          <Text numberOfLines={1} style={[styles.headerName, { color: colors.foreground }]}>{otherName}</Text>
          <View style={styles.headerSubRow}>
            {serviceName ? (
              <View style={[styles.headerServicePill, { backgroundColor: colors.secondary }]}>
                <MaterialCommunityIcons name={getServiceIcon(serviceName) as any} size={11} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.headerServiceText, { color: colors.primary }]}>{serviceName}</Text>
              </View>
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.headerJobStatus, { color: chat.otherTyping ? colors.primary : colors.mutedForeground }]}
            >
              {statusLine}
            </Text>
          </View>
        </View>
        <View style={styles.headerActionsRow}>
          {otherPhone ? (
            <Pressable
              accessibilityLabel="Call"
              onPress={() => Linking.openURL(`tel:${otherPhone}`)}
              style={[styles.headerIconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Ionicons name="call" size={17} color={colors.primary} />
            </Pressable>
          ) : null}
          {negotiation ? (
            <Pressable
              accessibilityLabel="Price agreement"
              testID="chat-header-negotiation-button"
              onPress={openNegotiation}
              style={[styles.headerIconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Ionicons name="pricetag" size={17} color={colors.primary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="Job details"
            testID="chat-header-job-tracking-button"
            onPress={() => router.push(`/job/${room.jobId}` as any)}
            style={[styles.headerIconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Ionicons name="analytics" size={19} color={colors.tint} />
          </Pressable>
        </View>
      </View>

      {/* Connection state */}
      {chat.socketStatus === 'disconnected' || chat.socketStatus === 'connecting' ? (
        <View style={[styles.connectionBar, { backgroundColor: colors.warning + '1A' }]} testID="chat-connection-banner">
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={[styles.connectionText, { color: colors.foreground }]}>
            {chat.socketStatus === 'connecting' ? 'Connecting…' : 'Reconnecting — messages will still sync.'}
          </Text>
        </View>
      ) : null}
      {chat.historyError ? (
        <Pressable onPress={() => void chat.refresh()} style={[styles.connectionBar, { backgroundColor: colors.destructive + '14' }]}>
          <Ionicons name="refresh" size={14} color={colors.destructive} />
          <Text style={[styles.connectionText, { color: colors.foreground }]}>{chat.historyError} Tap to retry.</Text>
        </Pressable>
      ) : null}

      {lockReason ? (
        <View style={styles.bannerPadding}>
          <Notice tone="warning" icon="lock-closed-outline" text={lockReason} />
        </View>
      ) : null}
      {firstMessage === 'true' && canSend ? (
        <View style={styles.bannerPadding}>
          <Notice
            tone="success"
            icon="checkmark-circle-outline"
            text={isTechnician
              ? 'You are assigned to this job. Coordinate the visit with your client here.'
              : 'Booking fee paid. You can now message your technician directly.'}
          />
        </View>
      ) : null}

      <FlatList
        inverted
        data={timeline}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListFooterComponent={jobCard}
        contentContainerStyle={styles.messageList}
        onEndReached={() => void chat.loadOlder()}
        onEndReachedThreshold={0.2}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* Booking fee gate (customers only) */}
      {feeBlocksClient && !lockReason ? (
        <View style={[styles.lockedBanner, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {fee.status === 'checking' ? (
            <View style={styles.lockedBannerTop}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.lockedBannerTitle, { color: colors.foreground, marginLeft: 10 }]}>Verifying your booking fee…</Text>
            </View>
          ) : fee.status === 'unknown' ? (
            <>
              <Text style={[styles.lockedBannerTitle, { color: colors.foreground }]}>
                We couldn't confirm your booking fee payment.
              </Text>
              <Button label="Check again" size="small" variant="outline" onPress={fee.retry} style={{ marginTop: 10 }} />
            </>
          ) : (
            <>
              <View style={styles.lockedBannerTop}>
                <View style={[styles.lockedIconCircle, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.warning} />
                </View>
                <Text style={[styles.lockedBannerTitle, { color: colors.foreground, flex: 1, marginLeft: 10 }]}>
                  Booking fee pending. Complete payment to message this technician.
                </Text>
              </View>
              <Button
                label="Pay Booking Fee"
                icon="arrow-forward"
                testID="chat-pay-booking-fee-button"
                onPress={() =>
                  router.push({
                    pathname: '/checkout/payment',
                    params: {
                      requestId: room.jobId,
                      service: serviceName ?? '',
                      ...(fee.amount ? { amount: String(fee.amount) } : {}),
                    },
                  })
                }
                style={{ marginTop: 10 }}
              />
            </>
          )}
        </View>
      ) : null}

      {/* Composer */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
            opacity: canSend ? 1 : 0.6,
          },
        ]}
      >
        <Pressable
          disabled={!canSend}
          onPress={handleAttach}
          accessibilityLabel="Attach photo or document"
          testID="chat-attach-button"
          style={[styles.actionIconBtn, { backgroundColor: canSend ? colors.primary + '18' : colors.muted }]}
        >
          <Feather name="paperclip" size={18} color={canSend ? colors.primary : colors.mutedForeground} />
        </Pressable>
        <TextInput
          editable={canSend}
          value={draft}
          onChangeText={handleChangeDraft}
          onBlur={() => chat.setTyping(false)}
          maxLength={CHAT_TEXT_MAX_LENGTH}
          multiline
          placeholder={inputPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          testID="chat-message-input"
        />
        <Pressable
          disabled={!canSend || !draft.trim()}
          onPress={handleSend}
          accessibilityLabel="Send message"
          testID="chat-send-button"
          style={[styles.sendBtn, { backgroundColor: canSend && draft.trim() ? colors.primary : colors.muted }]}
        >
          <Ionicons name="send" size={18} color={canSend && draft.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>

      {previewUri ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
          <Pressable style={styles.fullscreenOverlay} onPress={() => setPreviewUri(null)}>
            <Image source={{ uri: previewUri }} style={styles.fullscreenImage} resizeMode="contain" />
            <Pressable style={styles.closePreviewBtn} onPress={() => setPreviewUri(null)}>
              <Feather name="x" size={24} color="#ffffff" />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerAvatarWrap: { marginLeft: 6, marginRight: 10 },
  headerInfo: { flex: 1, justifyContent: 'center', minWidth: 0 },
  headerName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  headerServicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    maxWidth: 120,
  },
  headerServiceText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  headerJobStatus: { fontFamily: 'Inter_400Regular', fontSize: 12, flexShrink: 1 },
  headerActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  connectionText: { fontFamily: 'Inter_500Medium', fontSize: 12, flexShrink: 1 },
  bannerPadding: { paddingHorizontal: 16, paddingTop: 10 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' },
  centerText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  messageList: { paddingHorizontal: 16, paddingVertical: 16 },
  loadOlder: { alignItems: 'center', paddingVertical: 10 },
  loadOlderText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  dateSeparatorWrap: { alignItems: 'center', marginVertical: 10 },
  dateSeparatorPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  dateSeparatorText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  systemWrap: { alignItems: 'center', marginVertical: 6 },
  systemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '90%',
  },
  systemText: { fontFamily: 'Inter_500Medium', fontSize: 12, flexShrink: 1 },
  systemTime: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  msgWrapper: { marginVertical: 3, maxWidth: '82%' },
  msgRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  chatBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  hiddenText: { fontStyle: 'italic' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 },
  bubbleTime: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  failedText: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 2 },
  chatPhoto: { width: 200, height: 200, borderRadius: 10 },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  attachmentName: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  attachmentDetail: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  requestCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  reqCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqHeaderIconTile: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  reqCardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  reqStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reqStatusBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  reqProblem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 10 },
  reqAddress: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 6 },
  reqActionRow: { flexDirection: 'row', borderTopWidth: 1, marginTop: 10, paddingTop: 8, gap: 16 },
  reqActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  reqActionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  lockedBanner: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  lockedBannerTop: { flexDirection: 'row', alignItems: 'center' },
  lockedIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  lockedBannerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  actionIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: { width: '100%', height: '80%' },
  closePreviewBtn: { position: 'absolute', top: 48, right: 20, padding: 8 },
});
