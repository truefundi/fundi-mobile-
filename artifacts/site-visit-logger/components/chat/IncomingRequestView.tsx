import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { RequestCard, type RequestSummary } from '@/components/chat/RequestCard';
import { jobMediaUrl, type TechnicianOfferItem } from '@/lib/jobs-api';

/** Seconds until the request goes back to the client, ticking every second. */
export function useSecondsLeft(expiresAt?: string) {
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

export function formatCountdown(secondsLeft: number | null) {
  if (secondsLeft === null) return null;
  return `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
}

/** The request card contents for a request routed to the technician but not accepted yet. */
export function buildOfferSummary(offer: TechnicianOfferItem): RequestSummary {
  const job = offer.job;
  return {
    jobId: job.id,
    service: job.service,
    description: job.description,
    address: job.locationAddress,
    latitude: job.latitude,
    longitude: job.longitude,
    isSos: false,
    createdAt: job.createdAt,
    photos: job.media.filter((m) => m.type === 'PHOTO').map(jobMediaUrl),
    videos: job.media.filter((m) => m.type === 'VIDEO').map(jobMediaUrl),
    documents: job.media
      .filter((m) => m.type === 'DOCUMENT' || m.type === 'VOICE_NOTE')
      .map((m, i) => ({ url: jobMediaUrl(m), label: m.type === 'VOICE_NOTE' ? `Voice note ${i + 1}` : `Document ${i + 1}` })),
    bookingFeePaid: true,
    bookingFee: null,
  };
}

type Props = {
  offer: TechnicianOfferItem;
  secondsLeft: number | null;
  /** True once the technician accepted and the chat is opening. */
  accepted: boolean;
  onPreviewImage: (uri: string) => void;
};

/**
 * The start of a job chat while the request is still waiting for the
 * technician: the request as a message from the client, its details card and
 * the time left to answer. Rendered inside the regular chat screen so that
 * accepting keeps the same layout and simply unlocks messaging.
 */
export function IncomingRequestIntro({ offer, secondsLeft, accepted, onPreviewImage }: Props) {
  const colors = useColors();
  const clientName = offer.customer?.fullName?.trim() || 'New client';
  const job = offer.job;
  const expired = !accepted && secondsLeft === 0;
  const countdown = formatCountdown(secondsLeft);
  const distanceKm = offer.distanceMeters ? (offer.distanceMeters / 1000).toFixed(1) : null;

  return (
    <View>
      <RequestCard
        summary={buildOfferSummary(offer)}
        badge={accepted ? 'accepted' : expired ? 'cancelled' : 'pending'}
        cancelLabel={null}
        onCancel={() => undefined}
        onPreviewImage={onPreviewImage}
      />

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

      {accepted ? null : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  bubble: { flex: 1, borderWidth: 1, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12 },
  bubbleName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 4 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  bubbleMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 6 },
  timerCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 12 },
  timerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
});
