import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { urgencyText, type Job } from '@/constants/jobs';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';

/** Matching is a manual choice from the local technician marketplace. */
export function Matching({
  job,
  onChooseTechnician,
  onCancel,
}: {
  job: Job;
  onChooseTechnician: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();

  return (
    <StageScreen
      eyebrow="CHOOSE A TECHNICIAN"
      title="Browse available technicians"
      subtitle="Select a technician yourself. Your choice will stay with this request."
      hideBack
      footer={
        <>
          <Button label="Choose technician" onPress={onChooseTechnician} testID="matching-choose-button" />
          <Button label="Cancel request" variant="outline" onPress={onCancel} testID="matching-cancel-button" />
        </>
      }
    >
      <SectionCard title="Your request">
        <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
        <Text style={[styles.problem, { color: colors.mutedForeground }]} numberOfLines={3}>
          {job.problem}
        </Text>
        <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
          <Meta label="Urgency" value={urgencyText(job)} />
          <Meta label="Location" value={job.locationLabel} />
        </View>
      </SectionCard>
    </StageScreen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  service: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  problem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 5 },
  metaRow: { flexDirection: 'row', gap: 16, borderTopWidth: 1, marginTop: 13, paddingTop: 12 },
  meta: { flex: 1 },
  metaLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  metaValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 3 },
});
