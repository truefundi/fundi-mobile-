import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { RequestCard, type RequestSummary } from '@/components/chat/RequestCard';
import { ReasonSheet } from '@/components/chat/ChatSheets';
import { getServiceIcon } from '@/lib/categories-api';
import type { TechnicianOfferItem } from '@/lib/jobs-api';

type Props = {
  offer: TechnicianOfferItem;
  onBack: () => void;
  onAccept: () => Promise<void>;
  onDecline: (reason: string) => Promise<void>;
  onExpired: () => void;
  onPreviewImage: (uri: string) => void;
};

function useSecondsLeft(expiresAt?: string) {
  const compute = () => (expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null);
  const [left, setLeft] = useState<number | null>(compute);
  useEffect(() => {
    setLeft(compute());
    if (!expiresAt) return;
    const timer = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  return left;
}

/**
 * A technician's inbox view of a client request that has been routed to them
 * but not answered yet (a backend job offer). The request arrives as a
 * message from the client; accepting assigns the job and opens the full chat
 * and price negotiation, declining hands it back to the client.
 */
export function IncomingRequestView({ offer, onBack, onAccept, onDecline, onExpired, onPreviewImage }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [accepting, setAccepting] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secondsLeft = useSecondsLeft(offer.expiresAt);
  const expired = secondsLeft === 0;
  const clientName = offer.customer?.fullName?.trim() || 'New client';
  const job = offer.job;

  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

  const summary = useMemo<RequestSummary>(
    () => ({
      jobId: job.id,
      service: job.service,
      description: job.description,
      address: job.locationAddress,
      latitude: job.latitude,
      longitude: job.longitude,
      isSos: false,
      createdAt: job.createdAt,
      photos: job.media.filter((m) => m.type === 'PHOTO').map((m) => m.url),
      videos: job.media.filter((m) => m.type === 'VIDEO').map((m) => m.url),
      documents: job.media
        .filter((m) => m.type === 'DOCUMENT' || m.type === 'VOICE_NOTE')
        .map((m, i) => ({ url: m.url, label: m.type === 'VOICE_NOTE' ? `Voice note ${i + 1}` : `Document ${i + 1}` })),
      bookingFeePaid: true,
      bookingFee: null,
    }),
    [job],
  );

  const countdown =
    secondsLeft === null
      ? null
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const distanceKm = offer.distanceMeters ? (offer.distanceMeters / 1000).toFixed(1) : null;

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await onAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this request.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          { paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <BackButton onPress={onBack} />
        <ProfileAvatar uri={offer.customer?.profilePictureUrl ?? undefined} name={clientName} size={38} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text numberOfLines={1} style={[styles.headerName, { color: colors.foreground }]}>{clientName}</Text>
          <View style={styles.headerSub}>
            <MaterialCommunityIcons name={getServiceIcon(job.service) as any} size={12} color={colors.primary} />
            <Text numberOfLines={1} style={[styles.headerSubText, { color: colors.mutedForeground }]}>
              New request · {job.service}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.datePill}>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            {new Date(offer.job.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </View>

        {/* The request, delivered as a message from the client */}
        <View style={styles.messageRow}>
          <ProfileAvatar uri={offer.customer?.profilePictureUrl ?? undefined} name={clientName} size={28} />
          <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bubbleName, { color: colors.primary }]}>{clientName}</Text>
            <Text style={[styles.bubbleText, { color: colors.foreground }]}>
              Hi, I need help with {job.service.toLowerCase()}. {job.description}
            </Text>
            <Text style={[styles.bubbleMeta, { color: colors.mutedForeground }]}>
              📍 {job.locationAddress}
              {distanceKm ? ` · ${distanceKm} km from you` : ''}
            </Text>
          </View>
        </View>

        <RequestCard
          summary={summary}
          badge={expired ? 'cancelled' : 'pending'}
          cancelLabel={null}
          onCancel={() => undefined}
          onPreviewImage={onPreviewImage}
        />

        <View style={[styles.timerCard, { backgroundColor: (expired ? colors.destructive : colors.warning) + '14' }]}>
          <Ionicons name={expired ? 'alert-circle-outline' : 'time-outline'} size={16} color={expired ? colors.destructive : colors.warning} />
          <Text style={[styles.timerText, { color: colors.foreground }]}>
            {expired
              ? 'This request expired before it was answered.'
              : countdown
                ? `Respond within ${countdown} or the request goes back to the client.`
                : 'Respond soon or the request goes back to the client.'}
          </Text>
        </View>
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      </ScrollView>

      {!expired ? (
        <View style={[styles.actions, { borderTopColor: colors.border, backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button
            label="Decline"
            variant="outline"
            onPress={() => setDeclineOpen(true)}
            disabled={accepting}
            style={styles.flex}
            testID="incoming-request-decline"
          />
          <Button
            label="Accept request"
            onPress={() => void accept()}
            loading={accepting}
            disabled={accepting}
            style={styles.flex}
            testID="incoming-request-accept"
          />
        </View>
      ) : null}

      <ReasonSheet
        visible={declineOpen}
        title="Decline this request"
        description="The client will be able to choose another technician. A short reason helps them."
        confirmLabel="Decline request"
        required={false}
        busy={false}
        onClose={() => setDeclineOpen(false)}
        onSubmit={onDecline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  avatar: { marginLeft: 6, marginRight: 10 },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerSubText: { fontFamily: 'Inter_400Regular', fontSize: 12, flexShrink: 1 },
  body: { padding: 16, paddingBottom: 32 },
  datePill: { alignItems: 'center', marginBottom: 10 },
  dateText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  bubble: { flex: 1, borderWidth: 1, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12 },
  bubbleName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 4 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  bubbleMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 6 },
  timerCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  timerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  flex: { flex: 1 },
});
