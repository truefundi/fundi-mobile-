import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney, type Job, type PaymentMethod } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { TechnicianCard } from '@/components/ui/TechnicianCard';
import { useColors } from '@/hooks/useColors';

const METHODS: { id: PaymentMethod; icon: keyof typeof Ionicons.glyphMap; detail: string }[] = [
  { id: 'Card', icon: 'card-outline', detail: 'Visa, Mastercard' },
  { id: 'Mobile Money', icon: 'phone-portrait-outline', detail: 'MTN, Airtel' },
  { id: 'Fundi Wallet', icon: 'wallet-outline', detail: 'Balance $0.00' },
];

/**
 * Spec 7 and 9 — the visit fee explainer, then the payment sheet.
 * Both live here because the customer moves straight between them.
 */
export function VisitFee({ job, onPay, onCancel }: { job: Job; onPay: (method: PaymentMethod) => void; onCancel: () => void }) {
  const colors = useColors();
  const [showPayment, setShowPayment] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('Card');
  const [paying, setPaying] = useState(false);

  if (!job.technician) return null;

  if (!showPayment) {
    return (
      <StageScreen
        eyebrow="VISIT FEE"
        title="Technician visit & diagnostic fee"
        hideBack
        footer={
          <>
            <Button label="Continue to payment" icon="arrow-forward" onPress={() => setShowPayment(true)} testID="visit-fee-continue-button" />
            <Button label="Cancel request" variant="outline" onPress={onCancel} testID="visit-fee-cancel-button" />
          </>
        }
      >
        <SectionCard emphasis>
          <Text style={[styles.priceLabel, { color: colors.primaryForeground }]}>
            {job.urgency === 'Emergency' ? 'Emergency callout' : 'Standard callout'}
          </Text>
          <Text style={[styles.price, { color: colors.primaryForeground }]}>{formatMoney(job.visitFee)}</Text>
          <Text style={[styles.priceText, { color: colors.secondary }]}>
            This covers the technician&apos;s travel, inspection and diagnosis.
          </Text>
        </SectionCard>

        <TechnicianCard technician={job.technician} compact caption="Available now" />

        <SectionCard title="Included">
          <MoneyRow label="Callout & travel" value="Included" />
          <MoneyRow label="On-site inspection" value="Included" />
          <MoneyRow label="Written diagnosis" value="Included" />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MoneyRow label="Estimated arrival" value={`${job.technician.etaMinutes} min`} />
        </SectionCard>

        <Notice
          tone="neutral"
          icon="shield-checkmark-outline"
          text="The visit fee is subject to Fundi's cancellation and refund policy. It is credited against your repair total if you approve the quote."
        />
      </StageScreen>
    );
  }

  return (
    <StageScreen
      eyebrow="SECURE PAYMENT"
      title="Pay visit fee"
      onBack={() => setShowPayment(false)}
      footer={
        <Button
          label={`Pay ${formatMoney(job.visitFee)}`}
          loading={paying}
          onPress={() => {
            setPaying(true);
            onPay(method);
          }}
          testID="pay-visit-fee-button"
        />
      }
    >
      <SectionCard emphasis>
        <Text style={[styles.priceLabel, { color: colors.primaryForeground }]}>Amount due</Text>
        <Text style={[styles.price, { color: colors.primaryForeground }]}>{formatMoney(job.visitFee)}</Text>
      </SectionCard>

      <SectionCard title="Payment method">
        {METHODS.map((option, index) => {
          const selected = option.id === method;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`payment-method-${option.id}`}
              onPress={() => setMethod(option.id)}
              style={({ pressed }) => [
                styles.method,
                index < METHODS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.methodIcon, { backgroundColor: selected ? colors.secondary : colors.muted }]}>
                <Ionicons name={option.icon} size={18} color={selected ? colors.primary : colors.mutedForeground} />
              </View>
              <View style={styles.methodCopy}>
                <Text style={[styles.methodName, { color: colors.foreground }]}>{option.id}</Text>
                <Text style={[styles.methodDetail, { color: colors.mutedForeground }]}>{option.detail}</Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.input }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
            </Pressable>
          );
        })}
      </SectionCard>

      <Notice tone="success" icon="lock-closed" text="Secured by Fundi. Your details are encrypted." />
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  priceLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  price: { fontFamily: 'Inter_700Bold', fontSize: 44, letterSpacing: -1.5, marginTop: 4 },
  priceText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 6 },
  divider: { height: 1, marginVertical: 8 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  methodIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  methodCopy: { flex: 1 },
  methodName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  methodDetail: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
