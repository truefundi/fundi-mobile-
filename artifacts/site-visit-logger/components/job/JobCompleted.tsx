import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, repairTotal, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useColors } from '@/hooks/useColors';

/** Spec 16 — the repair is done and the balance is ready to settle. */
export function JobCompleted({ job, onContinue }: { job: Job; onContinue: () => void }) {
  const colors = useColors();
  const finishedAt = new Date(job.statusSince);

  return (
    <StageScreen
      eyebrow="COMPLETED"
      title="Job completed"
      hideBack
      footer={<Button label="Continue to payment" onPress={onContinue} testID="completed-continue-button" />}
    >
      <View style={styles.hero}>
        <View style={[styles.iconRing, { borderColor: colors.successMuted }]}>
          <View style={[styles.iconCore, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={38} color={colors.primaryForeground} />
          </View>
        </View>
      </View>

      <SectionCard title="Service summary">
        <MoneyRow label="Service" value={job.service} />
        <MoneyRow label="Technician" value={job.technician?.name ?? '—'} />
        <MoneyRow
          label="Completed"
          value={finishedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        />
        <MoneyRow label="Job ID" value={job.reference} />
      </SectionCard>

      <SectionCard title="Work done">
        <Text style={[styles.diagnosis, { color: colors.foreground }]}>{job.quote?.diagnosis}</Text>
        {job.additionalWork ? (
          <Text style={[styles.extra, { color: colors.mutedForeground }]}>
            {job.additionalWorkApproved ? 'Plus approved extra work: ' : 'Extra work declined: '}
            {job.additionalWork.reason}
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Before & after">
        <View style={styles.photoRow}>
          <View style={styles.photo}>
            {job.photoUri ? (
              <Image source={{ uri: job.photoUri }} style={[styles.photoImage, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.photoEmpty, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />
              </View>
            )}
            <Text style={[styles.photoLabel, { color: colors.mutedForeground }]}>Before</Text>
          </View>
          <View style={styles.photo}>
            <View style={[styles.photoEmpty, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="camera-outline" size={20} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.photoLabel, { color: colors.mutedForeground }]}>After · your technician adds this</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Amount">
        <MoneyRow label="Repair total" value={formatMoney(repairTotal(job))} />
        <MoneyRow label="Visit fee already paid" value={formatMoney(job.visitFee)} credit />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoneyRow label="Balance to settle" value={formatMoney(balanceDue(job))} strong />
      </SectionCard>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 6 },
  iconRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 9, alignItems: 'center', justifyContent: 'center' },
  iconCore: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  diagnosis: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20 },
  extra: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 8 },
  photoRow: { flexDirection: 'row', gap: 11 },
  photo: { flex: 1, gap: 6 },
  photoImage: { width: '100%', height: 96, borderRadius: 11, borderWidth: 1 },
  photoEmpty: { width: '100%', height: 96, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  photoLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 },
  divider: { height: 1, marginVertical: 8 },
});
