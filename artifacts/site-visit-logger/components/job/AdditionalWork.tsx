import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { additionalSubtotal, formatMoney, quoteSubtotal, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
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
      <View style={[styles.alert, { backgroundColor: colors.warningMuted }]}>
        <Ionicons name="alert-circle" size={19} color="#92400e" />
        <Text style={[styles.alertText, { color: '#92400e' }]}>{job.additionalWork.reason}</Text>
      </View>

      <SectionCard title="Already approved">
        <MoneyRow label="Original repair quote" value={formatMoney(original)} />
      </SectionCard>

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
        <MoneyRow label="Original repair" value={formatMoney(original)} />
        <MoneyRow label="Additional work" value={formatMoney(extra)} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoneyRow label="New repair total" value={formatMoney(original + extra)} strong />
        <MoneyRow label="Visit fee already paid" value={formatMoney(job.visitFee)} credit />
        <MoneyRow label="Remaining balance" value={formatMoney(Math.max(original + extra - job.visitFee, 0))} strong />
      </SectionCard>

      <View style={[styles.notice, { backgroundColor: colors.successMuted }]}>
        <Ionicons name="shield-checkmark" size={17} color={colors.success} />
        <Text style={[styles.noticeText, { color: colors.success }]}>
          Declining is fine — your technician will finish the repair you already approved.
        </Text>
      </View>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  alert: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  alertText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20, flex: 1 },
  divider: { height: 1, marginVertical: 8 },
  notice: { flexDirection: 'row', gap: 9, borderRadius: 12, padding: 13, alignItems: 'flex-start' },
  noticeText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, flex: 1 },
});
