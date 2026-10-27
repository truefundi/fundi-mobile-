import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useChat, type ChatMessage, type ServiceRequestDetails } from '@/context/ChatContext';
import { useFundi } from '@/context/FundiContext';
import { useAuth } from '@/context/AuthContext';
import { useRequestMediaUri } from '@/hooks/useRequestMediaUri';
import { canOpenMapNavigation, openMapNavigation } from '@/lib/location';
import { isCancellationEvent } from '@/lib/cancellation';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';

/** Helper to reliably render request thumbnails and gallery images with fallback */
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

export default function StandaloneChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const {
    threads,
    sendMessage,
    sendPriceOffer,
    respondToOffer,
    updateRequestStatus,
  } = useChat();
  const { getJob } = useFundi();

  const {
    id: routeId,
    requestId,
    firstMessage,
    type: typeParam,
  } = useLocalSearchParams<{
    id?: string;
    requestId?: string;
    firstMessage?: string;
    type?: string;
  }>();

  // Find target thread by thread ID or associated job/request ID
  const thread = useMemo(() => {
    if (!routeId && !requestId) return threads[0];
    return (
      threads.find((t) => t.id === routeId) ??
      threads.find((t) => t.jobId === routeId) ??
      threads.find((t) => requestId && t.jobId === requestId) ??
      threads[0]
    );
  }, [routeId, requestId, threads]);

  const targetJobId = thread?.jobId || requestId || routeId;
  const job = targetJobId ? getJob(targetJobId) : undefined;
  const otherName = thread?.otherParticipantName ?? (job?.technician?.name || 'Technician');

  const threadServiceRequest = useMemo(() => {
    return thread?.messages.find((m) => Boolean(m.serviceRequest))?.serviceRequest;
  }, [thread?.messages]);

  const isSos = typeParam === 'SOS' || job?.type === 'SOS' || threadServiceRequest?.type === 'SOS';

  // Check booking fee gatekeeping status
  const hasAssociatedBooking = Boolean(job || threadServiceRequest?.bookingFee || thread?.jobId);
  const isBookingFeePaid = hasAssociatedBooking
    ? job
      ? job.bookingFee?.status === 'PAID'
      : threadServiceRequest?.bookingFee
        ? threadServiceRequest.bookingFee.status === 'PAID'
        : false
    : true;

  const isThreadTerminated =
    Boolean(thread?.isEnded) ||
    threadServiceRequest?.status === 'CANCELLED' ||
    threadServiceRequest?.status === 'DECLINED' ||
    Boolean(thread?.messages.some((m) => isCancellationEvent(m.text)));

  const [messageText, setMessageText] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [selectedRequestDetails, setSelectedRequestDetails] = useState<ServiceRequestDetails | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineRequestId, setDeclineRequestId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState('');



  // Inject existing request card into message feed if not already present
  const displayMessages = useMemo(() => {
    const list = [...(thread?.messages ?? [])];
    const hasRequestCard = list.some((m) => Boolean(m.serviceRequest));

    if (!hasRequestCard && job) {
      const intakeMessage: ChatMessage = {
        id: `msg-req-intake-${job.id}`,
        senderId: account?.id ?? 'client',
        senderName: account?.name ?? 'Client',
        senderRole: 'client',
        text: `Service request submitted for ${job.service}`,
        timestamp: job.createdAt || new Date().toISOString(),
        serviceRequest: {
          id: job.id,
          serviceName: job.service,
          problem: job.problem,
          address: job.locationLabel,
          latitude: job.locationLatitude,
          longitude: job.locationLongitude,
          thumbnailUri: job.photoUris?.[0] ?? job.photoUri,
          photos: job.photoUris ?? (job.photoUri ? [job.photoUri] : []),
          videos: job.videoUris ?? (job.videoUri ? [job.videoUri] : []),
          createdAt: job.createdAt,
          status: (job.status as any) || 'ACCEPTED',
          type: job.type || 'STANDARD',
          bookingFee: job.bookingFee,
        },
      };
      return [intakeMessage, ...list];
    }
    return list;
  }, [thread?.messages, job, account?.id, account?.name]);

  const handleSend = async () => {
    if (!thread || !messageText.trim() || !isBookingFeePaid || isThreadTerminated) return;
    const textToSend = messageText.trim();
    setMessageText('');
    await sendMessage(thread.id, textToSend);
  };

  const handlePickImage = async () => {
    if (!isBookingFeePaid || !thread || isThreadTerminated) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await sendMessage(thread.id, '', result.assets[0].uri);
    }
  };

  const handleSendOffer = async () => {
    if (!thread || !offerAmount || !isBookingFeePaid || isThreadTerminated) return;
    const amountNum = parseFloat(offerAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    await sendPriceOffer(
      thread.id,
      amountNum,
      offerNotes,
      account?.role === 'TECHNICIAN' ? 'technician' : 'client',
    );
    setShowOfferModal(false);
    setOfferAmount('');
    setOfferNotes('');
  };

  const handleDeclineRequestSubmit = async () => {
    if (!thread || !declineRequestId) return;
    await updateRequestStatus(thread.id, declineRequestId, 'DECLINED', declineReasonText.trim() || undefined);
    setShowDeclineModal(false);
    setDeclineRequestId(null);
    setDeclineReasonText('');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/chat');
    }
  };

  const technicianPhone = thread?.technicianPhone || job?.technician?.phone;

  const handleCallTechnician = () => {
    if (technicianPhone) {
      Linking.openURL(`tel:${technicianPhone}`);
    }
  };

  const handleOpenMap = () => {
    const lat = job?.locationLatitude ?? threadServiceRequest?.latitude;
    const lng = job?.locationLongitude ?? threadServiceRequest?.longitude;
    const address = job?.locationLabel ?? threadServiceRequest?.address;
    if (canOpenMapNavigation({ latitude: lat, longitude: lng, address })) {
      openMapNavigation({ latitude: lat, longitude: lng, address });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top Header */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <BackButton onPress={handleBack} />
        <View style={styles.headerInfo}>
          <View style={styles.headerTitleRow}>
            <Text numberOfLines={1} style={[styles.headerName, { color: colors.foreground }]}>
              {otherName}
            </Text>
            {isSos && (
              <View style={styles.sosInlineBadge} testID="sos-chat-header-badge">
                <View style={styles.sosDot} />
                <Text style={styles.sosInlineBadgeText}>SOS Priority</Text>
              </View>
            )}
          </View>
          <View style={styles.headerStatusRow}>
            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: isSos
                    ? '#ef4444'
                    : isThreadTerminated
                      ? colors.destructive
                      : isBookingFeePaid
                        ? colors.success
                        : colors.warning,
                },
              ]}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.headerStatusText,
                { color: isSos ? '#ef4444' : colors.mutedForeground, fontWeight: isSos ? '600' : '400' },
              ]}
            >
              {isThreadTerminated
                ? 'Request Inactive'
                : isSos
                  ? '⚡ 5–15m ETA · En route'
                  : thread?.agreedPrice
                    ? `Agreed: RWF ${thread.agreedPrice.toLocaleString()}`
                    : isBookingFeePaid
                      ? 'Booking Confirmed · Chat Active'
                      : 'Booking Fee Pending'}
            </Text>
          </View>
        </View>

        {/* Quick Actions (Call / GPS for SOS) & Job Tracking */}
        <View style={styles.headerActionsRow}>
          {isSos && (
            <>
              {technicianPhone && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Call Technician"
                  testID="chat-header-call-button"
                  onPress={handleCallTechnician}
                  style={({ pressed }) => [
                    styles.headerActionBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Ionicons name="call" size={15} color="#ef4444" />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Navigation"
                testID="chat-header-gps-button"
                onPress={handleOpenMap}
                style={({ pressed }) => [
                  styles.headerActionBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name="navigate" size={15} color="#ef4444" />
              </Pressable>
            </>
          )}

          {targetJobId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View Job Tracking"
              testID="chat-header-job-tracking-button"
              onPress={() => router.push(`/job/${targetJobId}` as any)}
              style={({ pressed }) => [
                styles.headerJobBtn,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="clipboard-outline" size={15} color={colors.primary} />
              {!isSos && <Text style={[styles.headerJobBtnText, { color: colors.primary }]}>Job Details</Text>}
            </Pressable>
          ) : !isSos ? (
            <View style={{ width: 34 }} />
          ) : null}
        </View>
      </View>

      {/* Cancellation / Termination Notice Banner */}
      {isThreadTerminated && (
        <View style={styles.bannerPadding}>
          <Notice
            tone="warning"
            icon="alert-circle-outline"
            text={
              thread?.cancelledByName
                ? `This service request was cancelled by ${thread.cancelledByName}.`
                : 'This service request is no longer active.'
            }
          />
          {account?.role !== 'TECHNICIAN' && (
            <Button
              label="Find Another Specialist"
              variant="outline"
              size="small"
              icon="arrow-forward"
              onPress={() =>
                router.push({
                  pathname: '/select-technician',
                  params: {
                    service: job?.service || threadServiceRequest?.serviceName,
                    problem: job?.problem || threadServiceRequest?.problem,
                    locationLabel: job?.locationLabel || threadServiceRequest?.address,
                  },
                })
              }
              style={{ marginTop: 8 }}
            />
          )}
        </View>
      )}

      {/* Booking Confirmed / First Message Banner */}
      {firstMessage === 'true' && isBookingFeePaid && !isThreadTerminated && !isSos && (
        <View style={styles.bannerPadding}>
          <Notice
            tone="success"
            icon="checkmark-circle-outline"
            text="Service Booking Fee paid successfully! You now have direct messaging with your technician to coordinate the visit and negotiate repair pricing."
          />
        </View>
      )}

      {/* Message List */}
      <FlatList
        data={displayMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isMe =
            item.senderId === account?.id ||
            item.senderRole === (account?.role === 'TECHNICIAN' ? 'technician' : 'client');
          const time = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          const prevItem = index > 0 ? displayMessages[index - 1] : null;
          const showDateSeparator =
            !prevItem ||
            new Date(item.timestamp).toDateString() !== new Date(prevItem.timestamp).toDateString();
          const dateLabel = showDateSeparator ? getDateSeparatorLabel(item.timestamp) : null;

          return (
            <View key={item.id} style={styles.messageItemContainer}>
              {/* Date Separator Pill */}
              {dateLabel && (
                <View style={styles.dateSeparatorWrap}>
                  <View style={[styles.dateSeparatorPill, { backgroundColor: colors.muted + '40' }]}>
                    <Text style={[styles.dateSeparatorText, { color: colors.mutedForeground }]}>
                      {dateLabel}
                    </Text>
                  </View>
                </View>
              )}

              <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
                {/* SERVICE REQUEST CARD (Existing Rich Card Model) */}
                {item.serviceRequest && (
                  <View
                    style={[
                      styles.requestCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.reqCardHeader}>
                      <View style={styles.reqCardTitleWrap}>
                        <Ionicons name="construct-outline" size={16} color={colors.primary} />
                        <Text style={[styles.reqCardTitle, { color: colors.foreground }]}>
                          {item.serviceRequest.serviceName} Service Request
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.reqStatusBadge,
                          {
                            backgroundColor:
                              item.serviceRequest.bookingFee?.status === 'PAID'
                                ? colors.success + '1A'
                                : colors.warning + '1A',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reqStatusBadgeText,
                            {
                              color:
                                item.serviceRequest.bookingFee?.status === 'PAID'
                                  ? colors.success
                                  : colors.warning,
                            },
                          ]}
                        >
                          {item.serviceRequest.bookingFee?.status === 'PAID'
                            ? 'Booking Fee Paid'
                            : 'Payment Pending'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reqCardBody}>
                      {/* Thumbnail Image */}
                      {item.serviceRequest.thumbnailUri ? (
                        <View style={styles.reqThumbFrame}>
                          <StableRequestImage
                            uri={item.serviceRequest.thumbnailUri}
                            style={styles.reqThumb}
                            fallbackStyle={styles.reqThumbFallback}
                          />
                        </View>
                      ) : (
                        <View
                          style={[styles.reqThumbFallback, { backgroundColor: colors.secondary }]}
                        >
                          <Ionicons name="construct-outline" size={24} color={colors.primary} />
                        </View>
                      )}

                      <View style={styles.reqInfoWrap}>
                        <Text
                          numberOfLines={1}
                          style={[styles.reqAddress, { color: colors.mutedForeground }]}
                        >
                          📍 {item.serviceRequest.address || 'Address provided on request'}
                        </Text>
                        <Text
                          numberOfLines={3}
                          style={[styles.reqProblem, { color: colors.foreground }]}
                        >
                          {item.serviceRequest.problem}
                        </Text>
                      </View>
                    </View>

                    {/* Actionable Navigation Buttons */}
                    <View style={[styles.reqActionRow, { borderTopColor: colors.border }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View service details"
                        onPress={() => setSelectedRequestDetails(item.serviceRequest!)}
                        style={({ pressed }) => [
                          styles.reqActionBtn,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                        <Text style={[styles.reqActionBtnText, { color: colors.primary }]}>
                          View Details
                        </Text>
                      </Pressable>

                      {canOpenMapNavigation(item.serviceRequest) && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Navigate to request location"
                          onPress={() => void openMapNavigation(item.serviceRequest!)}
                          style={({ pressed }) => [
                            styles.reqActionBtn,
                            { opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="navigation" size={13} color={colors.primary} />
                          <Text style={[styles.reqActionBtnText, { color: colors.primary }]}>
                            Navigate
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View job tracking screen"
                        onPress={() =>
                          router.push(`/job/${item.serviceRequest!.id || targetJobId}` as any)
                        }
                        style={({ pressed }) => [
                          styles.reqActionBtn,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={[styles.reqActionBtnText, { color: colors.primary }]}>
                          Track Job
                        </Text>
                      </Pressable>
                    </View>

                    {/* Technician Accept / Decline Request actions */}
                    {account?.role === 'TECHNICIAN' &&
                      ['REQUEST_RECEIVED', 'PENDING_RESPONSE'].includes(item.serviceRequest.status) &&
                      !thread?.isEnded && (
                        <View style={[styles.techRequestActionRow, { borderTopColor: colors.border }]}>
                          <Button
                            label="Accept Request"
                            size="small"
                            onPress={async () => {
                              if (!thread) return;
                              await updateRequestStatus(thread.id, item.serviceRequest!.id, 'ACCEPTED');
                            }}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label="Decline"
                            variant="outline"
                            size="small"
                            onPress={() => {
                              setDeclineRequestId(item.serviceRequest!.id);
                              setShowDeclineModal(true);
                            }}
                            style={{ flex: 1, marginLeft: 8 }}
                          />
                        </View>
                      )}
                  </View>
                )}

                {/* Price Offer Card */}
                {item.priceOffer && (
                  <View
                    style={[
                      styles.offerCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.offerHeader}>
                      <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                      <Text style={[styles.offerLabel, { color: colors.mutedForeground }]}>
                        Repair Price Proposal
                      </Text>
                    </View>
                    <Text style={[styles.offerAmount, { color: colors.foreground }]}>
                      {item.priceOffer.currency} {item.priceOffer.amount.toLocaleString()}
                    </Text>
                    {item.priceOffer.notes ? (
                      <Text style={[styles.offerNotes, { color: colors.mutedForeground }]}>
                        {item.priceOffer.notes}
                      </Text>
                    ) : null}

                    <View
                      style={[
                        styles.offerStatusBadge,
                        {
                          backgroundColor:
                            item.priceOffer.status === 'ACCEPTED'
                              ? colors.success + '1A'
                              : colors.primary + '18',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.offerStatusText,
                          {
                            color:
                              item.priceOffer.status === 'ACCEPTED'
                                ? colors.success
                                : colors.primary,
                          },
                        ]}
                      >
                        Status: {item.priceOffer.status}
                      </Text>
                    </View>

                    {/* Accept / Decline actions if client and offer is pending */}
                    {item.priceOffer.status === 'PENDING' && account?.role !== 'TECHNICIAN' && !isThreadTerminated && (
                      <View style={styles.offerActionRow}>
                        <Button
                          label="Accept Price"
                          size="small"
                          onPress={() => respondToOffer(thread.id, item.priceOffer!.id, 'ACCEPTED')}
                          style={{ flex: 1 }}
                        />
                        <Button
                          label="Decline"
                          variant="outline"
                          size="small"
                          onPress={() => respondToOffer(thread.id, item.priceOffer!.id, 'DECLINED')}
                          style={{ flex: 1, marginLeft: 8 }}
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Attached Image in Message */}
                {item.imageUri ? (
                  <Pressable
                    onPress={() => setPreviewImage(item.imageUri!)}
                    style={[
                      styles.imageMsgFrame,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <StableRequestImage
                      uri={item.imageUri}
                      style={styles.chatPhoto}
                      fallbackStyle={styles.chatPhotoFallback}
                    />
                    <Text style={[styles.bubbleTime, { color: colors.mutedForeground, marginTop: 4 }]}>
                      {time}
                    </Text>
                  </Pressable>
                ) : null}

                {/* Regular Text Bubble */}
                {item.text ? (
                  <View
                    style={[
                      styles.chatBubble,
                      isMe
                        ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                        : [
                            styles.bubbleOther,
                            { backgroundColor: colors.card, borderColor: colors.border },
                          ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isMe ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleTime,
                        { color: isMe ? colors.primaryForeground + 'B3' : colors.mutedForeground },
                      ]}
                    >
                      {time}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Send a message to start coordinating with your technician.
            </Text>
          </View>
        }
      />

      {/* Direct Settlement Explainer */}
      <View style={[styles.settlementBar, { backgroundColor: colors.secondary }]}>
        <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
        <Text style={[styles.settlementText, { color: colors.secondaryForeground }]}>
          Final repair and labor price is negotiated and settled directly with your technician.
        </Text>
      </View>

      {/* GATEKEEPING: Locked overlay banner if booking fee is unpaid */}
      {!isBookingFeePaid && !isThreadTerminated && (
        <View
          style={[
            styles.lockedBanner,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <View style={styles.lockedBannerTop}>
            <View style={[styles.lockedIconCircle, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="lock-closed" size={18} color={colors.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.lockedBannerTitle, { color: colors.foreground }]}>
                Booking fee pending. Complete payment to message this technician.
              </Text>
            </View>
          </View>
          <Button
            label="Pay Booking Fee"
            icon="arrow-forward"
            onPress={() => {
              router.push({
                pathname: '/checkout/payment',
                params: {
                  requestId: targetJobId,
                  technicianId: job?.technician?.id,
                  service: job?.service,
                  amount: (job?.bookingFee?.amount ?? 2500).toString(),
                },
              });
            }}
            style={{ marginTop: 10 }}
            testID="chat-pay-booking-fee-button"
          />
        </View>
      )}

      {/* Bottom Message Input Bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
            opacity: isBookingFeePaid && !isThreadTerminated ? 1 : 0.6,
          },
        ]}
      >
        {/* Price proposal button */}
        <Pressable
          disabled={!isBookingFeePaid || isThreadTerminated}
          onPress={() => setShowOfferModal(true)}
          style={[
            styles.actionIconBtn,
            { backgroundColor: isBookingFeePaid && !isThreadTerminated ? colors.primary + '18' : colors.muted },
          ]}
          accessibilityLabel="Propose price offer"
        >
          <Feather
            name="tag"
            size={18}
            color={isBookingFeePaid && !isThreadTerminated ? colors.primary : colors.mutedForeground}
          />
        </Pressable>

        {/* Media / photo upload attachment button */}
        <Pressable
          disabled={!isBookingFeePaid || isThreadTerminated}
          onPress={handlePickImage}
          style={[
            styles.actionIconBtn,
            {
              backgroundColor: isBookingFeePaid && !isThreadTerminated ? colors.primary + '18' : colors.muted,
              marginLeft: 8,
            },
          ]}
          accessibilityLabel="Attach photo"
          testID="chat-attach-photo-button"
        >
          <Feather
            name="image"
            size={18}
            color={isBookingFeePaid && !isThreadTerminated ? colors.primary : colors.mutedForeground}
          />
        </Pressable>

        <TextInput
          editable={isBookingFeePaid && !isThreadTerminated}
          value={messageText}
          onChangeText={setMessageText}
          placeholder={
            isThreadTerminated
              ? 'Request is no longer active'
              : isBookingFeePaid
                ? 'Type a message...'
                : 'Complete payment to message this technician...'
          }
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.textInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: isBookingFeePaid && !isThreadTerminated ? colors.foreground : colors.mutedForeground,
            },
          ]}
        />

        <Pressable
          disabled={!messageText.trim() || !isBookingFeePaid || isThreadTerminated}
          onPress={handleSend}
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                messageText.trim() && isBookingFeePaid && !isThreadTerminated ? colors.primary : colors.muted,
            },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={
              messageText.trim() && isBookingFeePaid && !isThreadTerminated
                ? colors.primaryForeground
                : colors.mutedForeground
            }
          />
        </Pressable>
      </View>

      {/* Propose Price Offer Modal */}
      {showOfferModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.modalTopRow}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Propose Repair Price
                </Text>
                <Pressable onPress={() => setShowOfferModal(false)}>
                  <Ionicons name="close" size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
                Enter the agreed service amount to record the direct settlement.
              </Text>

              <TextInput
                value={offerAmount}
                onChangeText={setOfferAmount}
                keyboardType="numeric"
                placeholder="Amount in RWF (e.g. 25000)"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />

              <TextInput
                value={offerNotes}
                onChangeText={setOfferNotes}
                placeholder="Notes (optional, e.g. includes parts)"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />

              <Button
                label="Send Price Proposal"
                onPress={handleSendOffer}
                disabled={!offerAmount}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Decline Request Modal for Technicians */}
      {showDeclineModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDeclineModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalTopRow}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Decline Service Request</Text>
                <Pressable onPress={() => setShowDeclineModal(false)}>
                  <Ionicons name="close" size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
                Provide a brief reason so the client can find another technician.
              </Text>
              <TextInput
                value={declineReasonText}
                onChangeText={setDeclineReasonText}
                placeholder="Reason (e.g. out of area, currently unavailable)"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
              <Button
                label="Confirm Decline"
                variant="danger"
                onPress={handleDeclineRequestSubmit}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Existing Request Card Details Modal */}
      {selectedRequestDetails && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedRequestDetails(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalDetailsCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.modalTopRow}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {selectedRequestDetails.serviceName} Details
                </Text>
                <Pressable onPress={() => setSelectedRequestDetails(null)}>
                  <Ionicons name="close" size={24} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
                <Text style={[styles.detailSectionLabel, { color: colors.mutedForeground }]}>
                  Problem Description
                </Text>
                <Text style={[styles.detailText, { color: colors.foreground }]}>
                  {selectedRequestDetails.problem}
                </Text>

                <Text style={[styles.detailSectionLabel, { color: colors.mutedForeground }]}>
                  Service Address
                </Text>
                <Text style={[styles.detailText, { color: colors.foreground }]}>
                  📍 {selectedRequestDetails.address || 'Address provided on request'}
                </Text>

                {canOpenMapNavigation(selectedRequestDetails) && (
                  <Button
                    label="Open Location in Maps"
                    variant="outline"
                    size="small"
                    featherIcon="navigation"
                    onPress={() => void openMapNavigation(selectedRequestDetails)}
                    style={{ marginTop: 10 }}
                  />
                )}

                {/* Uploaded Photos Gallery */}
                {selectedRequestDetails.photos && selectedRequestDetails.photos.length > 0 && (
                  <>
                    <Text style={[styles.detailSectionLabel, { color: colors.mutedForeground }]}>
                      Attached Photos ({selectedRequestDetails.photos.length})
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                      {selectedRequestDetails.photos.map((photoUri, index) => (
                        <Pressable
                          key={`${photoUri}-${index}`}
                          onPress={() => setPreviewImage(photoUri)}
                          style={styles.galleryThumbWrap}
                        >
                          <StableRequestImage
                            uri={photoUri}
                            style={styles.galleryThumb}
                            fallbackStyle={styles.galleryThumbFallback}
                          />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                <View style={[styles.detailsFooter, { borderTopColor: colors.border }]}>
                  <Button
                    label="Track Job Status"
                    icon="arrow-forward"
                    onPress={() => {
                      setSelectedRequestDetails(null);
                      router.push(`/job/${selectedRequestDetails.id || targetJobId}` as any);
                    }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Fullscreen Photo Preview Modal */}
      {previewImage && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <Pressable style={styles.fullscreenOverlay} onPress={() => setPreviewImage(null)}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <StableRequestImage
                uri={previewImage}
                style={styles.fullscreenImage}
                fallbackStyle={styles.fullscreenImageFallback}
              />
            </Pressable>
            <Pressable style={styles.closePreviewBtn} onPress={() => setPreviewImage(null)}>
              <Feather name="x" size={24} color="#ffffff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  sosInlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sosDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  sosInlineBadgeText: {
    color: '#ef4444',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  headerStatusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  headerJobBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  bannerPadding: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  messageItemContainer: {
    marginBottom: 4,
  },
  dateSeparatorWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateSeparatorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  msgWrapper: {
    marginVertical: 2,
    maxWidth: '90%',
  },
  msgRight: {
    alignSelf: 'flex-end',
  },
  msgLeft: {
    alignSelf: 'flex-start',
  },
  chatBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  imageMsgFrame: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 6,
    maxWidth: 240,
  },
  chatPhoto: {
    width: 220,
    height: 160,
    borderRadius: 10,
  },
  chatPhotoFallback: {
    width: 220,
    height: 160,
    borderRadius: 10,
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    width: '100%',
  },
  reqCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  reqCardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  reqCardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    flex: 1,
  },
  reqStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reqStatusBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  reqCardBody: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 12,
  },
  reqThumbFrame: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
  },
  reqThumb: {
    width: 64,
    height: 64,
  },
  reqThumbFallback: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  reqInfoWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  reqAddress: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  reqProblem: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  reqActionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
    justifyContent: 'flex-end',
  },
  techRequestActionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reqActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reqActionBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  offerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginBottom: 6,
    minWidth: 220,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  offerAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  offerNotes: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  offerStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  offerStatusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  offerActionRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  settlementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settlementText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    flex: 1,
  },
  lockedBanner: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  lockedBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBannerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  actionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalDetailsCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
  },
  modalHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  detailSectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 4,
  },
  detailText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  galleryScroll: {
    marginTop: 6,
  },
  galleryThumbWrap: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  galleryThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  galleryThumbFallback: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  detailsFooter: {
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 16,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: 340,
    height: 440,
    resizeMode: 'contain',
  },
  fullscreenImageFallback: {
    width: 340,
    height: 440,
  },
  closePreviewBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
