import React, { useState, type ReactNode } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { vibrate } from '@/lib/haptics';
import { useFundi } from '@/context/FundiContext';
import { useChat } from '@/context/ChatContext';
import { BackButton } from '@/components/ui/BackButton';
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
import { VisitFee } from '@/components/job/VisitFee';
import { TechnicianCard } from '@/components/ui/TechnicianCard';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Notice } from '@/components/ui/Notice';
import { StageScreen } from '@/components/ui/StageScreen';
import { useColors } from '@/hooks/useColors';

/** The irreversible choices on this screen, each confirmed before it happens. */
type Pending = 'cancel' | 'declineQuote' | 'declineExtra';

const CONFIRM: Record<Pending, { title: string; message: string; confirmLabel: string; cancelLabel: string }> = {
  cancel: {
    title: 'Cancel this request?',
    message: 'We will stop looking for a technician. You can send a new request at any time.',
    confirmLabel: 'Cancel request',
    cancelLabel: 'Keep request',
  },
  declineQuote: {
    title: 'Decline the repair quote?',
    message: 'No repair will be carried out. The visit fee you already paid covers the inspection and diagnosis.',
    confirmLabel: 'Decline quote',
    cancelLabel: 'Go back',
  },
  declineExtra: {
    title: 'Decline the extra work?',
    message: 'Your technician will finish only the repair you already approved.',
    confirmLabel: 'Decline extra work',
    cancelLabel: 'Go back',
  },
};

export default function JobScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getJob,
    isHydrated,
    acceptOffer,
    payVisitFee,
    linkChatThread,
    approveQuote,
    declineQuote,
    approveAdditionalWork,
    declineAdditionalWork,
    startSettlement,
    recordSettlement,
    cancelJob,
  } = useFundi();
  const { createOrGetThread } = useChat();
  const [pending, setPending] = useState<Pending | null>(null);

  const job = id ? getJob(id) : undefined;

  const tap = () => {
    vibrate();
  };

  if (!isHydrated) return <LoadingState label="Loading your job…" fullScreen />;

  if (!job) {
    return (
      <StageScreen
        title="Job not found"
        onBack={() => router.replace('/activity')}
        footer={<Button label="Back to my services" onPress={() => router.replace('/activity')} testID="job-missing-back" />}
      >
        <EmptyState icon="alert-circle" title="This request is no longer available" text="It may have been cleared from this device." />
      </StageScreen>
    );
  }

  const confirm = () => {
    if (pending === 'cancel') cancelJob(job.id);
    else if (pending === 'declineQuote') declineQuote(job.id);
    else if (pending === 'declineExtra') declineAdditionalWork(job.id);
    setPending(null);
  };

  const openPaidJobChat = () => {
    if (!job.technician) return;
    const now = new Date().toISOString();
    const threadId = job.chatThreadId ?? createOrGetThread(
      job.technician.name,
      'technician',
      job.id,
      {
        id: job.id,
        serviceName: job.service,
        problem: job.problem,
        address: job.locationLabel,
        ...(job.locationLatitude !== undefined ? { latitude: job.locationLatitude } : {}),
        ...(job.locationLongitude !== undefined ? { longitude: job.locationLongitude } : {}),
        photos: job.photoUris ?? (job.photoUri ? [job.photoUri] : []),
        videos: job.videoUris ?? (job.videoUri ? [job.videoUri] : []),
        thumbnailUri: job.photoUris?.[0] ?? job.photoUri,
        createdAt: job.createdAt ?? now,
        status: 'ACCEPTED',
      },
      job.technician.phone,
      job.technician.location,
    );
    if (!job.chatThreadId) linkChatThread(job.id, threadId);
    router.replace({ pathname: '/(tabs)/chat', params: { threadId } });
  };

  let stage: ReactNode;
  switch (job.status) {
    case 'REQUESTED':
    case 'MATCHING':
      stage = (
        <Matching
          job={job}
          onChooseTechnician={() => router.push({ pathname: '/select-technician', params: { jobId: job.id } })}
          onCancel={() => setPending('cancel')}
        />
      );
      break;

    case 'OFFERED':
      stage = (
        <TechnicianFound
          job={job}
          onContinue={() => {
            tap();
            acceptOffer(job.id);
          }}
          onCancel={() => setPending('cancel')}
        />
      );
      break;

    case 'ACCEPTED':
      stage = (
        <VisitFee
          job={job}
          onPay={(method) => {
            tap();
            payVisitFee(job.id, method);
            openPaidJobChat();
          }}
          onCancel={() => setPending('cancel')}
        />
      );
      break;

    case 'VISIT_PAID':
    case 'EN_ROUTE':
      stage = (
        <StageScreen
          eyebrow="VISIT FEE PAID"
          title="Continue in your technician chat"
          subtitle="Your request and attachments are ready for the selected technician to review."
          footer={
            <Button
              label="Open technician chat"
              icon="chatbubble-ellipses-outline"
              onPress={openPaidJobChat}
              testID="open-paid-job-chat-button"
            />
          }
        >
          {job.technician ? <TechnicianCard technician={job.technician} caption="Selected for this request" /> : null}
          <Notice tone="info" icon="chatbubbles-outline" text="Coordinate the visit and request a repair offer directly in chat. No technician is automatically tracked." />
        </StageScreen>
      );
      break;

    case 'ARRIVED':
      stage = <Arrived job={job} />;
      break;

    case 'DIAGNOSING':
    case 'DIAGNOSIS_COMPLETE':
      stage = <Diagnosis job={job} />;
      break;

    case 'QUOTE_PENDING':
      stage = (
        <RepairQuote
          job={job}
          onApprove={() => {
            tap();
            approveQuote(job.id);
          }}
          onDecline={() => setPending('declineQuote')}
        />
      );
      break;

    case 'QUOTE_APPROVED':
    case 'REPAIR_IN_PROGRESS':
      stage = <RepairInProgress job={job} />;
      break;

    case 'ADDITIONAL_APPROVAL_REQUIRED':
      stage = (
        <AdditionalWork
          job={job}
          onApprove={() => {
            tap();
            approveAdditionalWork(job.id);
          }}
          onDecline={() => setPending('declineExtra')}
        />
      );
      break;

    case 'REPAIR_COMPLETED':
      stage = (
        <JobCompleted
          job={job}
          onContinue={() => {
            tap();
            startSettlement(job.id);
          }}
        />
      );
      break;

    case 'PAYMENT_PENDING':
      stage = (
        <Settlement
          job={job}
          onRecord={(method) => {
            tap();
            recordSettlement(job.id, method);
          }}
        />
      );
      break;

    case 'PAYMENT_REPORTED':
      stage = <LoadingState label="Preparing your invoice…" fullScreen />;
      break;

    default:
      stage = <JobClosed job={job} />;
  }

  const dialog = pending ? CONFIRM[pending] : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* <View style={[styles.headerBar, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8, borderBottomColor: colors.border }]}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/activity'))} />
      </View> */}
      <View style={{ flex: 1 }}>{stage}</View>
      <ConfirmDialog
        visible={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirmLabel ?? ''}
        cancelLabel={dialog?.cancelLabel}
        destructive
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: { paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
});