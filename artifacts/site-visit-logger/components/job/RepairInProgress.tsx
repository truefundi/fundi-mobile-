import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney, repairTotal, type Job } from '@/constants/jobs';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { Timeline, type TimelineStep } from '@/components/ui/Timeline';
import { useColors } from '@/hooks/useColors';

/** Spec 14 — work underway after the customer approved the quote. */
export function RepairInProgress({ job }: { job: Job }) {
  const colors = useColors();
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
          ? 'Your approved quote is ready for the selected technician.'
          : 'Your technician will confirm completion when the repair is done.'
      }
      hideBack
    >
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
  diagnosis: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 12, paddingTop: 11 },
  totalLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  total: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
