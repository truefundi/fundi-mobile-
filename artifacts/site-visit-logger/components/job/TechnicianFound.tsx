import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { TechnicianCard } from '@/components/ui/TechnicianCard';
import { useColors } from '@/hooks/useColors';

/** Shows the technician the customer selected from the local marketplace. */
export function TechnicianFound({ job, onContinue, onCancel }: { job: Job; onContinue: () => void; onCancel: () => void }) {
  if (!job.technician) return null;

  return (
    <StageScreen
      eyebrow="TECHNICIAN FOUND"
      title="Your technician is ready"
      subtitle="Review who is coming before you confirm the callout."
      hideBack
      footer={
        <>
          <Button label="Continue to visit fee" onPress={onContinue} testID="offer-continue-button" />
          <Button label="Cancel request" variant="outline" onPress={onCancel} testID="offer-cancel-button" />
        </>
      }
    >
      <TechnicianCard technician={job.technician} caption="Selected for this request" />

      <SectionCard title="What happens next">
        <Step icon="card-outline" title="Pay the visit fee" text={`${formatMoney(job.visitFee)} covers travel, inspection and diagnosis.`} />
        <Step icon="chatbubble-ellipses-outline" title="Continue in chat" text="After payment, your request opens in chat so you can coordinate with this technician and receive an offer." last />
      </SectionCard>

      <Notice tone="info" icon="information-circle-outline" text="Nothing is charged until you confirm on the next screen." />
    </StageScreen>
  );
}

function Step({ icon, title, text, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.step, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={[styles.stepIcon, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 12, paddingVertical: 11 },
  stepIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1 },
  stepTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  stepText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 2 },
});
