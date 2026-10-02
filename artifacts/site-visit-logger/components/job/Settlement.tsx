import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, repairTotal, type Job, type SettlementMethod } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useColors } from '@/hooks/useColors';

const OPTIONS: { id: SettlementMethod; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Fundi', label: 'Paid through Fundi', detail: 'Card, mobile money or wallet, handled in the app', icon: 'shield-checkmark-outline' },
  { id: 'Cash', label: 'Cash', detail: 'Paid the technician directly', icon: 'cash-outline' },
  { id: 'Mobile Money', label: 'Mobile money / e-transfer', detail: 'Sent straight to the technician', icon: 'phone-portrait-outline' },
  { id: 'Other', label: 'Other', detail: 'Bank transfer, cheque or account', icon: 'ellipsis-horizontal-circle-outline' },
];

/**
 * Spec 17 — how the repair balance was settled.
 *
 * Only the Fundi option runs money through the platform; the others record the
 * settlement without forcing the transaction through Fundi.
 */
export function Settlement({ job, onRecord }: { job: Job; onRecord: (method: SettlementMethod) => void }) {
  const colors = useColors();
  const [method, setMethod] = useState<SettlementMethod>('Fundi');
  const [submitting, setSubmitting] = useState(false);
  const due = balanceDue(job);

  return (
    <StageScreen
      eyebrow="PAYMENT"
      title="How was the repair paid?"
      subtitle="Recording this keeps your service history and invoice accurate."
      hideBack
      footer={
        <Button
          label={method === 'Fundi' ? `Pay ${formatMoney(due)} with Fundi` : `Record as paid by ${OPTIONS.find((o) => o.id === method)!.label.toLowerCase()}`}
          loading={submitting}
          onPress={() => {
            setSubmitting(true);
            onRecord(method);
          }}
          testID="settlement-confirm-button"
        />
      }
    >
      <SectionCard emphasis>
        <Text style={[styles.dueLabel, { color: colors.primaryForeground }]}>REPAIR BALANCE</Text>
        <Text style={[styles.due, { color: colors.primaryForeground }]}>{formatMoney(due)}</Text>
      </SectionCard>

      <SectionCard title="Settlement method">
        {OPTIONS.map((option, index) => {
          const selected = option.id === method;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`settlement-${option.id}`}
              onPress={() => setMethod(option.id)}
              style={({ pressed }) => [
                styles.option,
                index < OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: selected ? colors.secondary : colors.muted }]}>
                <Ionicons name={option.icon} size={18} color={selected ? colors.primary : colors.mutedForeground} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionLabel, { color: colors.foreground }]}>{option.label}</Text>
                <Text style={[styles.optionDetail, { color: colors.mutedForeground }]}>{option.detail}</Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.input }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
            </Pressable>
          );
        })}
      </SectionCard>

      <SectionCard title="How the balance is worked out">
        <MoneyRow label="Repair total" value={formatMoney(repairTotal(job))} />
        <MoneyRow label="Visit fee already paid" value={formatMoney(job.visitFee)} credit />
      </SectionCard>

      {method !== 'Fundi' ? (
        <Notice
          tone="info"
          icon="information-circle-outline"
          text="Fundi records this settlement but does not process the money. Only the visit fee runs through the platform."
        />
      ) : null}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  dueLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  due: { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1.4, marginTop: 3 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  optionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1 },
  optionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  optionDetail: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
