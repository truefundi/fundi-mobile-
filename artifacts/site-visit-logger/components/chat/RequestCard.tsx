import React, { useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useRequestMediaUri } from '@/hooks/useRequestMediaUri';
import { getServiceIcon } from '@/lib/categories-api';
import { canOpenMapNavigation, openMapNavigation } from '@/lib/location';
import type { BackendChatRoom } from '@/lib/chat-rooms-api';
import type { BackendConversation } from '@/lib/conversations-api';
import type { BackendJob } from '@/lib/jobs-api';
import type { RequestResponseBadge } from '@/lib/job-lifecycle';

/** Everything the request card and its details modal show, merged from backend records. */
export type RequestSummary = {
  jobId: string;
  service: string;
  description: string;
  address: string | null;
  latitude?: number;
  longitude?: number;
  isSos: boolean;
  createdAt: string | null;
  photos: string[];
  videos: string[];
  documents: Array<{ url: string; label: string }>;
  bookingFeePaid: boolean;
  bookingFee: { amount: number; currency: string } | null;
};

export function buildRequestSummary(
  jobId: string,
  job: BackendJob | null,
  conversation: BackendConversation | null,
  room: BackendChatRoom | null,
): RequestSummary {
  const media = job?.media ?? [];
  return {
    jobId,
    service: job?.service || conversation?.request.service || room?.job.service || 'Service request',
    description: job?.description || conversation?.request.description || room?.job.description || '',
    address: job?.location.address || conversation?.request.locationAddress || null,
    latitude: job?.location.latitude ?? conversation?.request.latitude,
    longitude: job?.location.longitude ?? conversation?.request.longitude,
    isSos: job?.requestType === 'SOS',
    createdAt: job?.createdAt ?? null,
    photos: media.filter((m) => m.type === 'PHOTO').map((m) => m.url),
    videos: media.filter((m) => m.type === 'VIDEO').map((m) => m.url),
    documents: media
      .filter((m) => m.type === 'DOCUMENT' || m.type === 'VOICE_NOTE')
      .map((m, i) => ({ url: m.url, label: m.type === 'VOICE_NOTE' ? `Voice note ${i + 1}` : `Document ${i + 1}` })),
    bookingFeePaid: Boolean(job?.bookingPayment),
    bookingFee: job?.bookingPayment ? { amount: job.bookingPayment.amount, currency: job.bookingPayment.currency } : null,
  };
}

const BADGE_COPY: Record<RequestResponseBadge, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Pending', icon: 'time-outline' },
  accepted: { label: 'Accepted', icon: 'checkmark-circle-outline' },
  denied: { label: 'Denied', icon: 'close-circle-outline' },
  cancelled: { label: 'Cancelled', icon: 'ban-outline' },
  completed: { label: 'Completed', icon: 'trophy-outline' },
};

function MediaImage({ uri, style, fallbackIcon }: { uri: string; style: object; fallbackIcon: string }) {
  const colors = useColors();
  const resolved = useRequestMediaUri(uri);
  const [failed, setFailed] = useState(false);
  if (!resolved || failed) {
    return (
      <View style={[style, { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialCommunityIcons name={fallbackIcon as any} size={26} color={colors.primary} />
      </View>
    );
  }
  return <Image source={{ uri: resolved }} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

type Props = {
  summary: RequestSummary;
  badge: RequestResponseBadge;
  /** Label for the cancel button, or null to hide it (e.g. after the price is agreed). */
  cancelLabel: string | null;
  cancelHint?: string | null;
  onCancel: () => void;
  onPreviewImage: (uri: string) => void;
};

/**
 * The service request pinned at the start of the chat. Row 1 pairs the
 * technician's response badge with the cancel action; row 2 opens a read-only
 * details modal with the full request and its media.
 */
export function RequestCard({ summary, badge, cancelLabel, cancelHint, onCancel, onPreviewImage }: Props) {
  const colors = useColors();
  const [showDetails, setShowDetails] = useState(false);
  const icon = getServiceIcon(summary.service);
  const badgeTone =
    badge === 'accepted' || badge === 'completed'
      ? colors.success
      : badge === 'pending'
        ? colors.warning
        : colors.destructive;
  const created = useMemo(
    () =>
      summary.createdAt
        ? new Date(summary.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        : null,
    [summary.createdAt],
  );
  const mediaCount = summary.photos.length + summary.videos.length + summary.documents.length;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="chat-request-card">
      <View style={styles.top}>
        {summary.photos[0] ? (
          <Pressable onPress={() => onPreviewImage(summary.photos[0])}>
            <MediaImage uri={summary.photos[0]} style={styles.thumb} fallbackIcon={icon} />
          </Pressable>
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialCommunityIcons name={icon as any} size={28} color={colors.primary} />
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {summary.service}
            </Text>
            {summary.isSos ? (
              <View style={styles.sosTag}>
                <Text style={styles.sosText}>SOS</Text>
              </View>
            ) : null}
          </View>
          {summary.address ? (
            <View style={styles.metaLine}>
              <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {summary.address}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {[
              created ? `Requested ${created}` : null,
              summary.bookingFeePaid ? 'Booking fee paid' : 'Booking fee pending',
              mediaCount ? `${mediaCount} attachment${mediaCount === 1 ? '' : 's'}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      {/* Row 1: technician response + cancel */}
      <View style={[styles.row1, { borderTopColor: colors.border }]}>
        <View style={[styles.badge, { backgroundColor: badgeTone + '1A' }]} testID="request-response-badge">
          <Ionicons name={BADGE_COPY[badge].icon} size={13} color={badgeTone} />
          <Text style={[styles.badgeText, { color: badgeTone }]}>{BADGE_COPY[badge].label}</Text>
        </View>
        {cancelLabel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            testID="request-cancel-button"
            style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.cancelText, { color: colors.destructive }]}>{cancelLabel}</Text>
          </Pressable>
        ) : cancelHint ? (
          <Text style={[styles.cancelHint, { color: colors.mutedForeground }]} numberOfLines={2}>
            {cancelHint}
          </Text>
        ) : null}
      </View>

      {/* Row 2: centered details link */}
      <Pressable
        onPress={() => setShowDetails(true)}
        accessibilityRole="button"
        testID="request-view-details"
        style={({ pressed }) => [styles.row2, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.detailsText, { color: colors.primary }]}>View Details</Text>
        {/* arrow-up-right points 45°; rotate -30° so it points 75° up from horizontal */}
        <Feather name="arrow-up-right" size={15} color={colors.primary} style={styles.arrow75} />
      </Pressable>

      <Modal visible={showDetails} transparent animationType="slide" onRequestClose={() => setShowDetails(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalTop}>
              <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
                <MaterialCommunityIcons name={icon as any} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={1}>
                {summary.service}
              </Text>
              <Pressable onPress={() => setShowDetails(false)} accessibilityLabel="Close details" hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <DetailRow label="Request type" value={summary.isSos ? 'SOS (urgent)' : 'Standard'} />
              {summary.createdAt ? (
                <DetailRow label="Requested" value={new Date(summary.createdAt).toLocaleString()} />
              ) : null}
              <DetailRow label="Status" value={BADGE_COPY[badge].label} />
              <DetailRow
                label="Booking fee"
                value={
                  summary.bookingFee
                    ? `${summary.bookingFee.currency} ${summary.bookingFee.amount.toLocaleString()} · paid`
                    : 'Not paid yet'
                }
              />
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Problem description</Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {summary.description || 'No description provided.'}
              </Text>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Service address</Text>
              <Text style={[styles.body, { color: colors.foreground }]}>{summary.address || 'Not provided'}</Text>
              {canOpenMapNavigation(summary) ? (
                <Pressable onPress={() => void openMapNavigation(summary)} style={styles.inlineLink}>
                  <Feather name="navigation" size={13} color={colors.primary} />
                  <Text style={[styles.inlineLinkText, { color: colors.primary }]}>Open in maps</Text>
                </Pressable>
              ) : null}

              {summary.photos.length ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    Photos ({summary.photos.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {summary.photos.map((uri, index) => (
                      <Pressable
                        key={`${uri}-${index}`}
                        onPress={() => {
                          setShowDetails(false);
                          onPreviewImage(uri);
                        }}
                        style={styles.galleryItem}
                      >
                        <MediaImage uri={uri} style={styles.galleryThumb} fallbackIcon="image-outline" />
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              ) : null}
              {summary.videos.length || summary.documents.length ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Other attachments</Text>
                  {summary.videos.map((url, i) => (
                    <AttachmentLink key={url} url={url} label={`Video ${i + 1}`} icon="video-outline" />
                  ))}
                  {summary.documents.map((doc) => (
                    <AttachmentLink key={doc.url} url={doc.url} label={doc.label} icon="file-document-outline" />
                  ))}
                </>
              ) : null}
              {!mediaCount ? (
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>No attachments</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function AttachmentLink({ url, label, icon }: { url: string; label: string; icon: string }) {
  const colors = useColors();
  const resolved = useRequestMediaUri(url);
  return (
    <Pressable
      disabled={!resolved}
      onPress={() => resolved && void Linking.openURL(resolved).catch(() => undefined)}
      style={[styles.attachment, { borderColor: colors.border }]}
    >
      <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
      <Text style={[styles.body, { color: colors.foreground, flex: 1 }]}>{label}</Text>
      <Feather name="external-link" size={14} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  top: { flexDirection: 'row', padding: 12, gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  info: { flex: 1, justifyContent: 'center', gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 15, flexShrink: 1 },
  sosTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
  },
  sosText: { color: '#ef4444', fontFamily: 'Inter_700Bold', fontSize: 10 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, flexShrink: 1 },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  cancelBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  cancelHint: { fontFamily: 'Inter_400Regular', fontSize: 11, flexShrink: 1, textAlign: 'right' },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  detailsText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  arrow75: { transform: [{ rotate: '-30deg' }] },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 18, paddingBottom: 32 },
  modalTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  iconTile: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 17 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  detailLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  detailValue: { fontFamily: 'Inter_500Medium', fontSize: 13, flexShrink: 1, textAlign: 'right' },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
  },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  inlineLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  galleryItem: { marginRight: 8 },
  galleryThumb: { width: 96, height: 96, borderRadius: 10 },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
});
