import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, quoteSubtotal, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { Notice } from '@/components/ui/Notice';
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
          <Button label="Decline quote" variant="danger" onPress={onDecline} testID="quote-decline-button" />
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
      </SectionCard>

      <SectionCard emphasis>
        <Text style={[styles.dueLabel, { color: colors.primaryForeground }]}>REMAINING BALANCE · YOU PAY</Text>
        <Text style={[styles.due, { color: colors.primaryForeground }]}>{formatMoney(remaining)}</Text>
      </SectionCard>

      <Notice tone="success" icon="shield-checkmark" text="You will not be charged for additional work without your approval." />
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  diagnosis: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
  divider: { height: 1, marginVertical: 8 },
  dueLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  due: { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1.4, marginTop: 3 },
});
