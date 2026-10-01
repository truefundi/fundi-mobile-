import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Job } from '@/constants/jobs';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { TechnicianCard } from '@/components/ui/TechnicianCard';
import { useColors } from '@/hooks/useColors';

/** Spec 11 — arrival confirmation, shown briefly before diagnosis starts. */
export function Arrived({ job }: { job: Job }) {
  const colors = useColors();
  if (!job.technician) return null;

  return (
    <StageScreen eyebrow="ARRIVED" title="Your technician has arrived" hideBack>
      <View style={styles.hero}>
        <View style={[styles.iconRing, { borderColor: colors.successMuted }]}>
          <View style={[styles.iconCore, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={34} color={colors.primaryForeground} />
          </View>
        </View>
      </View>

      <TechnicianCard technician={job.technician} compact />

      <SectionCard>
        <Text style={[styles.next, { color: colors.foreground }]}>Diagnosis will begin shortly.</Text>
        <Text style={[styles.nextText, { color: colors.mutedForeground }]}>
          {job.technician.name.split(' ')[0]} will inspect the problem and send you a written diagnosis with a repair
          quote. You approve the cost before any repair work starts.
        </Text>
      </SectionCard>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 14, paddingVertical: 10 },
  iconRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  iconCore: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  next: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  nextText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 6 },
});
