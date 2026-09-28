import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, repairTotal, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useColors } from '@/hooks/useColors';

/** Terminal view for a finished or cancelled job, reachable from My services. */
export function JobClosed({ job }: { job: Job }) {
  const colors = useColors();
  const router = useRouter();
  const cancelled = job.status === 'CANCELLED';

  return (
    <StageScreen
      eyebrow={cancelled ? 'CANCELLED' : 'COMPLETED'}
      title={cancelled ? 'Request cancelled' : 'Job completed'}
      subtitle={cancelled ? 'This request was cancelled and no repair was carried out.' : undefined}
      onBack={() => router.replace('/activity')}
      footer={
        cancelled ? (
          <Button label="Back to my services" variant="outline" onPress={() => router.replace('/activity')} testID="closed-back-button" />
        ) : (
          <>
            <Button label="View invoice" onPress={() => router.push(`/invoice/${job.id}`)} testID="closed-invoice-button" />
            <Button
              label={job.rating ? 'View your review' : 'Rate technician'}
              variant="outline"
              onPress={() => router.push(`/rate/${job.id}`)}
              testID="closed-rate-button"
            />
          </>
        )
      }
    >
      {!cancelled && (
        <View style={styles.hero}>
          <View style={[styles.iconCore, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={32} color={colors.primaryForeground} />
          </View>
        </View>
      )}

      <SectionCard>
        <StatusBadge status={job.status} testID="closed-status-badge" />
        <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
        <Text style={[styles.problem, { color: colors.mutedForeground }]}>{job.problem}</Text>
      </SectionCard>

      <SectionCard title="Summary">
        <MoneyRow label="Job ID" value={job.reference} />
        <MoneyRow label="Technician" value={job.technician?.name ?? 'Not matched'} />
        <MoneyRow label="Location" value={job.locationLabel} />
        {!cancelled && (
          <>
            <MoneyRow label="Repair total" value={formatMoney(repairTotal(job))} />
            <MoneyRow label="Visit fee" value={formatMoney(job.visitFee)} />
            <MoneyRow label="Settled by" value={job.settlementMethod ?? '—'} />
            <MoneyRow label="Balance" value={formatMoney(balanceDue(job))} strong />
          </>
        )}
      </SectionCard>

      {job.rating ? (
        <SectionCard title="Your rating">
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= job.rating!.overall ? 'star' : 'star-outline'}
                size={18}
                color={colors.warning}
              />
            ))}
            <Text style={[styles.ratingValue, { color: colors.foreground }]}>{job.rating.overall}.0</Text>
          </View>
          {job.rating.comment ? <Text style={[styles.comment, { color: colors.mutedForeground }]}>{job.rating.comment}</Text> : null}
        </SectionCard>
      ) : null}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 2 },
  iconCore: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  service: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 11 },
  problem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 5 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontFamily: 'Inter_700Bold', fontSize: 14, marginLeft: 5 },
  comment: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 9 },
});
