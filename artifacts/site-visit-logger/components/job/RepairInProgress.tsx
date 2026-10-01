import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney, repairTotal, type Job } from '@/constants/jobs';
import { REPAIR_MS } from '@/constants/simulation';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { Timeline, type TimelineStep } from '@/components/ui/Timeline';
import { useCountdown } from '@/hooks/useCountdown';
import { useColors } from '@/hooks/useColors';

/** Spec 14 — work underway after the customer approved the quote. */
export function RepairInProgress({ job }: { job: Job }) {
  const colors = useColors();
  const { progress, remainingSeconds } = useCountdown(job.statusSince, REPAIR_MS);
  const approved = job.status === 'QUOTE_APPROVED';

  const steps: TimelineStep[] = [
    { label: 'Diagnosis completed', state: 'done' },
    { label: 'Repair approved', state: 'done' },
    { label: 'Repair in progress', state: approved ? 'pending' : 'active' },
    { label: 'Final inspection', state: 'pending' },
    { label: 'Job completed', state: 'pending' },
  ];

  return (
    <StageScreen
      eyebrow="REPAIR"
      title={approved ? 'Repair approved' : 'Repair in progress'}
      subtitle={
        approved
          ? 'Your technician is getting started.'
          : `${job.technician?.name.split(' ')[0] ?? 'Your technician'} is working on the repair now.`
      }
      hideBack
    >
      {!approved && (
        <SectionCard>
          <Text style={[styles.etaLabel, { color: colors.mutedForeground }]}>ESTIMATED COMPLETION</Text>
          <Text style={[styles.eta, { color: colors.foreground }]}>
            {remainingSeconds > 0 ? `About ${Math.max(Math.ceil(remainingSeconds / 60), 1)} min left` : 'Finishing up'}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </SectionCard>
      )}

      <SectionCard title="Job progress">
        <Timeline steps={steps} />
      </SectionCard>

      <SectionCard title="Approved work">
        <Text style={[styles.diagnosis, { color: colors.foreground }]}>{job.quote?.diagnosis}</Text>
        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Approved total</Text>
          <Text style={[styles.total, { color: colors.foreground }]}>{formatMoney(repairTotal(job))}</Text>
        </View>
      </SectionCard>

      <Notice tone="info" icon="information-circle-outline" text="If your technician finds anything else, you will be asked to approve it first." />
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  etaLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2 },
  eta: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 13 },
  progressFill: { height: 6, borderRadius: 3 },
  diagnosis: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 12, paddingTop: 11 },
  totalLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  total: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
