import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Job } from '@/constants/jobs';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { Timeline, type TimelineStep } from '@/components/ui/Timeline';
import { useColors } from '@/hooks/useColors';

/** Spec 12 — the on-site inspection, tracked against the rest of the job. */
export function Diagnosis({ job }: { job: Job }) {
  const colors = useColors();
  const complete = job.status === 'DIAGNOSIS_COMPLETE';

  const steps: TimelineStep[] = [
    { label: 'Technician arrived', state: 'done' },
    { label: 'Diagnosis in progress', state: complete ? 'done' : 'active' },
    { label: 'Repair quote', state: complete ? 'active' : 'pending' },
    { label: 'Your approval', state: 'pending' },
    { label: 'Repair', state: 'pending' },
    { label: 'Completion', state: 'pending' },
  ];

  return (
    <StageScreen
      eyebrow="DIAGNOSIS"
      title={complete ? 'Diagnosis completed' : 'Technician is diagnosing the problem'}
      subtitle={
        complete
          ? 'Your repair quote is being prepared. It will arrive in a moment.'
          : 'This usually takes a few minutes. You will get a written quote before any repair starts.'
      }
      hideBack
    >
      <SectionCard title="Job progress">
        <Timeline steps={steps} />
      </SectionCard>

      {job.technician ? (
        <SectionCard title="On site">
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.initials, { color: colors.primary }]}>{job.technician.initials}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.name, { color: colors.foreground }]}>{job.technician.name}</Text>
              <Text style={[styles.skill, { color: colors.mutedForeground }]}>{job.technician.skill}</Text>
            </View>
            <Ionicons name="build-outline" size={19} color={colors.primary} />
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Reported problem">
        <Text style={[styles.problem, { color: colors.foreground }]}>{job.problem}</Text>
      </SectionCard>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  copy: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  skill: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  problem: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
});
