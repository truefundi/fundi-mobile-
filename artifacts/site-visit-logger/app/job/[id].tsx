import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFundi } from '@/context/FundiContext';
import { AdditionalWork } from '@/components/job/AdditionalWork';
import { Arrived } from '@/components/job/Arrived';
import { Diagnosis } from '@/components/job/Diagnosis';
import { JobClosed } from '@/components/job/JobClosed';
import { JobCompleted } from '@/components/job/JobCompleted';
import { Matching } from '@/components/job/Matching';
import { RepairInProgress } from '@/components/job/RepairInProgress';
import { RepairQuote } from '@/components/job/RepairQuote';
import { Settlement } from '@/components/job/Settlement';
import { TechnicianFound } from '@/components/job/TechnicianFound';
import { Tracking } from '@/components/job/Tracking';
import { VisitFee } from '@/components/job/VisitFee';
import { Button } from '@/components/ui/Button';
import { StageScreen } from '@/components/ui/StageScreen';
import { useColors } from '@/hooks/useColors';

/**
 * Single entry point for a job.
 *
 * The screen shown is derived from the job's status rather than from the
 * navigation stack, so a timer firing in the background moves the customer to
 * the next stage on its own, and reopening a job from My services always lands
 * on the stage it is actually at.
 */
export default function JobScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getJob,
    isHydrated,
    acceptOffer,
    payVisitFee,
    approveQuote,
    declineQuote,
    approveAdditionalWork,
    declineAdditionalWork,
    startSettlement,
    recordSettlement,
    cancelJob,
  } = useFundi();

  const job = id ? getJob(id) : undefined;

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!isHydrated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <StageScreen
        title="Job not found"
        subtitle="This request is no longer available."
        onBack={() => router.replace('/activity')}
        footer={<Button label="Back to my services" onPress={() => router.replace('/activity')} testID="job-missing-back" />}
      >
        <Text style={[styles.missing, { color: colors.mutedForeground }]}>
          It may have been cleared from this device.
        </Text>
      </StageScreen>
    );
  }

  switch (job.status) {
    case 'REQUESTED':
    case 'MATCHING':
      return <Matching job={job} onCancel={() => cancelJob(job.id)} />;

    case 'OFFERED':
      return (
        <TechnicianFound
          job={job}
          onContinue={() => {
            tap();
            acceptOffer(job.id);
          }}
          onCancel={() => cancelJob(job.id)}
        />
      );

    case 'ACCEPTED':
      return (
        <VisitFee
          job={job}
          onPay={(method) => {
            tap();
            payVisitFee(job.id, method);
          }}
          onCancel={() => cancelJob(job.id)}
        />
      );

    case 'VISIT_PAID':
    case 'EN_ROUTE':
      return <Tracking job={job} />;

    case 'ARRIVED':
      return <Arrived job={job} />;

    case 'DIAGNOSING':
    case 'DIAGNOSIS_COMPLETE':
      return <Diagnosis job={job} />;

    case 'QUOTE_PENDING':
      return (
        <RepairQuote
          job={job}
          onApprove={() => {
            tap();
            approveQuote(job.id);
          }}
          onDecline={() => declineQuote(job.id)}
        />
      );

    case 'QUOTE_APPROVED':
    case 'REPAIR_IN_PROGRESS':
      return <RepairInProgress job={job} />;

    case 'ADDITIONAL_APPROVAL_REQUIRED':
      return (
        <AdditionalWork
          job={job}
          onApprove={() => {
            tap();
            approveAdditionalWork(job.id);
          }}
          onDecline={() => declineAdditionalWork(job.id)}
        />
      );

    case 'REPAIR_COMPLETED':
      return (
        <JobCompleted
          job={job}
          onContinue={() => {
            tap();
            startSettlement(job.id);
          }}
        />
      );

    case 'PAYMENT_PENDING':
      return (
        <Settlement
          job={job}
          onRecord={(method) => {
            tap();
            recordSettlement(job.id, method);
          }}
        />
      );

    case 'PAYMENT_REPORTED':
      return (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.pending, { color: colors.mutedForeground }]}>Preparing your invoice…</Text>
        </View>
      );

    default:
      return <JobClosed job={job} />;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  pending: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  missing: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
});
