import React, { useState, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { vibrate } from '@/lib/haptics';
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StageScreen } from '@/components/ui/StageScreen';

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

/**
 * Single entry point for a job.
 *
 * The screen shown is derived from the job's status rather than from the
 * navigation stack, so a timer firing in the background moves the customer to
 * the next stage on its own, and reopening a job from My services always lands
 * on the stage it is actually at.
 */
export default function JobScreen() {
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

  let stage: ReactNode;
  switch (job.status) {
    case 'REQUESTED':
    case 'MATCHING':
      stage = <Matching job={job} onCancel={() => setPending('cancel')} />;
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
          }}
          onCancel={() => setPending('cancel')}
        />
      );
      break;

    case 'VISIT_PAID':
    case 'EN_ROUTE':
      stage = <Tracking job={job} />;
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
    <>
      {stage}
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
    </>
  );
}
