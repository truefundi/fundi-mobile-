import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatBookingFee } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';
import { customerCharges, type PaymentQuote } from '@/lib/payments-api';

type Props = {
  quote: PaymentQuote | null;
  /** Drawn on the brand-coloured total card (light text) or on a plain card. */
  onEmphasis?: boolean;
  testID?: string;
};

/**
 * Itemises a booking price when the service carries charges the client pays:
 * base fee, each charge, then the total. Nothing is drawn for a plain fee.
 */
export function PriceBreakdown({ quote, onEmphasis, testID = 'price-breakdown' }: Props) {
  const colors = useColors();
  const charges = customerCharges(quote);
  if (!quote || charges.length === 0) return null;

  const strong = onEmphasis ? colors.primaryForeground : colors.foreground;
  const muted = onEmphasis ? colors.secondary : colors.mutedForeground;
  const rule = onEmphasis ? 'rgba(255,255,255,0.2)' : colors.border;
  const baseLabel = quote.requestType === 'SOS' ? 'Emergency booking fee' : 'Booking fee';

  return (
    <View testID={testID} style={[styles.box, { borderTopColor: rule }]}>
      <Row label={baseLabel} value={formatBookingFee(quote.baseFee, quote.currency)} color={muted} />
      {charges.map((charge) => (
        <Row
          key={charge.id}
          label={charge.chargeType === 'PERCENTAGE' ? `${charge.name} (${charge.value}%)` : charge.name}
          value={formatBookingFee(charge.amount, quote.currency)}
          color={muted}
        />
      ))}
      <View style={[styles.rule, { backgroundColor: rule }]} />
      <Row label="Total" value={formatBookingFee(quote.customerTotal, quote.currency)} color={strong} bold />
    </View>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  const font = bold ? 'Inter_700Bold' : 'Inter_500Medium';
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color, fontFamily: font }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.value, { color, fontFamily: font }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12, gap: 7 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 13 },
  value: { fontSize: 13 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
});
