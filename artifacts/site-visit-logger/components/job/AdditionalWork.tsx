import React from 'react';
import { StyleSheet, View } from 'react-native';
import { additionalSubtotal, formatMoney, quoteSubtotal, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useColors } from '@/hooks/useColors';

/** Spec 15 — extra work found mid-repair. Never charged without approval. */
export function AdditionalWork({ job, onApprove, onDecline }: { job: Job; onApprove: () => void; onDecline: () => void }) {
  const colors = useColors();
  if (!job.additionalWork || !job.quote) return null;

  const original = quoteSubtotal(job.quote);
  const extra = additionalSubtotal(job.additionalWork);
  const extraParts = job.additionalWork.parts.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  return (
    <StageScreen
      eyebrow="ACTION NEEDED"
      title="Additional work requires approval"
      subtitle="Your technician found something else. Nothing is charged unless you approve."
      hideBack
      footer={
        <>
          <Button label={`Approve extra work · ${formatMoney(extra)}`} onPress={onApprove} testID="additional-approve-button" />
          <Button label="Decline and finish original repair" variant="danger" onPress={onDecline} testID="additional-decline-button" />
        </>
      }
    >
      <Notice tone="warning" icon="alert-circle" text={job.additionalWork.reason} />

      <SectionCard title="Additional parts">
        {job.additionalWork.parts.map((line) => (
          <MoneyRow
            key={line.label}
            label={line.label}
            hint={line.quantity > 1 ? `${line.quantity} × ${formatMoney(line.unitPrice)}` : undefined}
            value={formatMoney(line.quantity * line.unitPrice)}
          />
        ))}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoneyRow label="Additional parts" value={formatMoney(extraParts)} />
        <MoneyRow label="Additional labour" value={formatMoney(job.additionalWork.labour)} />
      </SectionCard>

      <SectionCard title="If you approve">
        <MoneyRow label="Original repair (already approved)" value={formatMoney(original)} />
        <MoneyRow label="Additional work" value={formatMoney(extra)} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoneyRow label="New repair total" value={formatMoney(original + extra)} strong />
        <MoneyRow label="Visit fee already paid" value={formatMoney(job.visitFee)} credit />
        <MoneyRow label="Remaining balance" value={formatMoney(Math.max(original + extra - job.visitFee, 0))} strong />
      </SectionCard>

      <Notice tone="success" icon="shield-checkmark" text="Declining is fine — your technician will finish the repair you already approved." />
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: 8 },
});
