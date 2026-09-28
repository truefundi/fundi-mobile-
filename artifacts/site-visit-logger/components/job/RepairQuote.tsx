import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, quoteSubtotal, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useColors } from '@/hooks/useColors';

/** Spec 13 — the repair quote the customer must approve before work begins. */
export function RepairQuote({ job, onApprove, onDecline }: { job: Job; onApprove: () => void; onDecline: () => void }) {
  const colors = useColors();
  if (!job.quote) return null;

  const partsTotal = job.quote.parts.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const total = quoteSubtotal(job.quote);
  const remaining = balanceDue(job);

  return (
    <StageScreen
      eyebrow="REPAIR QUOTE"
      title="Repair quote"
      subtitle="Review the full cost before the repair starts."
      hideBack
      footer={
        <>
          <Button label={`Approve repair · ${formatMoney(remaining)}`} onPress={onApprove} testID="quote-approve-button" />
          <Button label="Decline" variant="danger" onPress={onDecline} testID="quote-decline-button" />
        </>
      }
    >
      <SectionCard title="Problem found">
        <Text style={[styles.diagnosis, { color: colors.foreground }]}>{job.quote.diagnosis}</Text>
      </SectionCard>

      <SectionCard title="Parts">
        {job.quote.parts.map((line) => (
          <MoneyRow
            key={line.label}
            label={line.label}
            hint={line.quantity > 1 ? `${line.quantity} × ${formatMoney(line.unitPrice)}` : undefined}
            value={formatMoney(line.quantity * line.unitPrice)}
          />
        ))}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoneyRow label="Parts subtotal" value={formatMoney(partsTotal)} />
      </SectionCard>

      <SectionCard title="Labour">
        <MoneyRow label="Workmanship" value={formatMoney(job.quote.labour)} />
      </SectionCard>

      <SectionCard title="Total">
        <MoneyRow label="Repair total" value={formatMoney(total)} />
        <MoneyRow label="Visit fee already paid" value={formatMoney(job.visitFee)} credit />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoneyRow label="Remaining balance" value={formatMoney(remaining)} strong />
      </SectionCard>

      <SectionCard emphasis>
        <Text style={[styles.dueLabel, { color: colors.primaryForeground }]}>YOU PAY</Text>
        <Text style={[styles.due, { color: colors.primaryForeground }]}>{formatMoney(remaining)}</Text>
      </SectionCard>

      <View style={[styles.notice, { backgroundColor: colors.successMuted }]}>
        <Ionicons name="shield-checkmark" size={17} color={colors.success} />
        <Text style={[styles.noticeText, { color: colors.success }]}>
          You will not be charged for additional work without your approval.
        </Text>
      </View>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  diagnosis: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
  divider: { height: 1, marginVertical: 8 },
  dueLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  due: { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1.4, marginTop: 3 },
  notice: { flexDirection: 'row', gap: 9, borderRadius: 12, padding: 13, alignItems: 'flex-start' },
  noticeText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, flex: 1 },
});
