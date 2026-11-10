import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import type { PriceOfferItem, PriceOfferStatus } from '@/lib/conversations-api';

type Props = {
  offer: PriceOfferItem;
  /** True when the viewer posted this offer. */
  isMine: boolean;
  senderName: string;
  /** Whether the viewer may accept/counter/decline (pending offer from the other side). */
  canRespond: boolean;
  /** Whether a counter-offer is still possible (offer limits, negotiation open). */
  canCounter: boolean;
  busy?: string | null;
  onAccept: () => void;
  onCounter: () => void;
  onDecline: () => void;
  time: string;
};

const STATUS_COPY: Record<PriceOfferStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Agreed',
  DECLINED: 'Denied',
  SUPERSEDED: 'Countered',
  EXPIRED: 'Expired',
};

function expiresIn(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Expires in ${hours}h`;
  return `Expires in ${Math.max(1, Math.round(ms / 60_000))}m`;
}

/** A structured price offer rendered inline in the chat stream. */
export function OfferCard({
  offer,
  isMine,
  senderName,
  canRespond,
  canCounter,
  busy,
  onAccept,
  onCounter,
  onDecline,
  time,
}: Props) {
  const colors = useColors();
  const tone =
    offer.status === 'ACCEPTED'
      ? colors.success
      : offer.status === 'DECLINED'
        ? colors.destructive
        : offer.status === 'PENDING'
          ? colors.primary
          : colors.mutedForeground;
  const inactive = offer.status === 'SUPERSEDED' || offer.status === 'EXPIRED';
  const expiry = offer.status === 'PENDING' ? expiresIn(offer.expiresAt) : null;

  return (
    <View
      style={[
        styles.card,
        isMine ? styles.mine : styles.theirs,
        {
          backgroundColor: colors.card,
          borderColor: offer.status === 'PENDING' ? colors.primary + '55' : colors.border,
          opacity: inactive ? 0.7 : 1,
        },
      ]}
      testID={`offer-card-${offer.id}`}
    >
      <View style={styles.header}>
        <Ionicons name="pricetag-outline" size={15} color={colors.primary} />
        <Text style={[styles.kicker, { color: colors.mutedForeground }]} numberOfLines={1}>
          {isMine ? 'Your price offer' : `Price offer from ${senderName}`}
        </Text>
        <View style={[styles.statusChip, { backgroundColor: tone + '1A' }]}>
          <Text style={[styles.statusText, { color: tone }]}>{STATUS_COPY[offer.status]}</Text>
        </View>
      </View>

      <Text
        style={[
          styles.amount,
          { color: colors.foreground, textDecorationLine: inactive ? 'line-through' : 'none' },
        ]}
      >
        {offer.currency} {offer.amount.toLocaleString()}
      </Text>
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>
        Repair & labour price · paid separately from the booking fee
      </Text>
      {offer.notes ? <Text style={[styles.notes, { color: colors.foreground }]}>{offer.notes}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{time}</Text>
        {expiry ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>· {expiry}</Text> : null}
        {offer.status === 'PENDING' && isMine ? (
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>· Waiting for a response</Text>
        ) : null}
      </View>

      {canRespond ? (
        <View style={styles.actions}>
          <Button
            label="Accept"
            size="small"
            onPress={onAccept}
            loading={busy === 'accept-offer'}
            disabled={Boolean(busy)}
            style={styles.flex}
            testID={`offer-accept-${offer.id}`}
          />
          {canCounter ? (
            <Button
              label="Counter"
              size="small"
              variant="outline"
              onPress={onCounter}
              disabled={Boolean(busy)}
              style={styles.flex}
              testID={`offer-counter-${offer.id}`}
            />
          ) : null}
          <Button
            label="Deny"
            size="small"
            variant="danger"
            onPress={onDecline}
            loading={busy === 'decline-offer'}
            disabled={Boolean(busy)}
            style={styles.flex}
            testID={`offer-deny-${offer.id}`}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, width: '86%', marginVertical: 4 },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 8 },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  notes: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  flex: { flex: 1 },
});
