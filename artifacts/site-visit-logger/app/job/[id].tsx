import React, { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, Platform, BackHandler } from 'react-native';
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
    message: 'No repair will be carried out. The Service Booking Fee you already paid covers request confirmation and technician dispatch.',
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
    payBookingFee,
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/activity');
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  if (!isHydrated) return <LoadingState label="Loading your job…" fullScreen />;

  if (!job) {
    return (
      <StageScreen
        title="Job not found"
        onBack={handleBack}
        footer={<Button label="Back to my services" onPress={handleBack} testID="job-missing-back" />}
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
    router.push({ pathname: `/chat/${threadId}` as any, params: { requestId: job.id } });
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
          onBack={handleBack}
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
          onBack={handleBack}
        />
      );
      break;

    case 'ACCEPTED':
    case 'PAYMENT_PENDING':
      if (job.bookingFee?.status !== 'PAID') {
        stage = (
          <StageScreen
            eyebrow="SERVICE BOOKING FEE"
            title="Confirm your technician booking"
            subtitle="Pay the flat Service Booking Fee to unlock direct real-time chat with your technician."
            onBack={handleBack}
            footer={
              <>
                <Button
                  label="Review & Pay Booking Fee"
                  icon="arrow-forward"
                  onPress={() => {
                    if (job.bookingFee?.status === 'PAID') {
                      const destChat = job.chatThreadId || job.chatId || job.id;
                      router.replace({
                        pathname: `/chat/${destChat}` as any,
                        params: { requestId: job.id },
                      });
                      return;
                    }
                    router.push({ pathname: '/checkout/verify-phone', params: { requestId: job.id, technicianId: job.technician?.id, service: job.service, categoryId: job.serviceCategoryId } });
                  }}
                  testID="review-booking-fee-button"
                />
                <Button label="Cancel request" variant="outline" onPress={() => setPending('cancel')} testID="booking-fee-cancel-button" />
              </>
            }
          >
            {job.technician ? <TechnicianCard technician={job.technician} compact caption="Selected specialist" /> : null}
            <Notice
              tone="info"
              icon="information-circle-outline"
              text="This booking fee secures your request and unlocks direct chat with your technician. The final cost of the repair/service will be agreed upon and settled directly between you and the technician."
            />
          </StageScreen>
        );
        break;
      }
      // If booking fee is paid, fall through to ACTIVE stage
    case 'PAID':
    case 'DISPATCHED':
    case 'NEGOTIATING':
    case 'COOPERATION_CONFIRMED':
    case 'ACTIVE':
    case 'IN_PROGRESS':
    case 'VISIT_PAID':
    case 'EN_ROUTE':
      stage = (
        <StageScreen
          eyebrow={job.status === 'IN_PROGRESS' ? 'SERVICE IN PROGRESS' : 'JOB ACTIVE'}
          title={job.status === 'IN_PROGRESS' ? 'Technician is working on your service' : 'Technician accepted your request'}
          subtitle={job.status === 'IN_PROGRESS' ? 'The technician has started work. Coordinate details directly in chat.' : 'Your booking is active. Coordinate the visit and agree on the repair price in chat.'}
          onBack={handleBack}
          footer={
            <>
              <Button
                label="Open technician chat"
                icon="chatbubble-ellipses-outline"
                onPress={openPaidJobChat}
                testID="open-paid-job-chat-button"
              />
              <Button
                label="Cancel request"
                variant="outline"
                onPress={() => setPending('cancel')}
                testID="active-job-cancel-button"
              />
            </>
          }
        >
          {job.technician ? <TechnicianCard technician={job.technician} caption={job.status === 'IN_PROGRESS' ? 'Working technician' : 'Selected specialist'} /> : null}
          <Notice
            tone="info"
            icon="chatbubbles-outline"
            text={job.status === 'IN_PROGRESS' ? 'The technician has marked the job in progress. You can chat normally throughout the service.' : 'Technician accepted your service request. You can now chat to negotiate and settle the job price.'}
          />
        </StageScreen>
      );
      break;

    case 'ARRIVED':
      stage = <Arrived job={job} onBack={handleBack} />;
      break;

    case 'DIAGNOSING':
    case 'DIAGNOSIS_COMPLETE':
      stage = <Diagnosis job={job} onBack={handleBack} />;
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
          onBack={handleBack}
        />
      );
      break;

    case 'QUOTE_APPROVED':
    case 'REPAIR_IN_PROGRESS':
      stage = <RepairInProgress job={job} onBack={handleBack} />;
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
          onBack={handleBack}
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
          onBack={handleBack}
        />
      );
      break;

    case 'PAYMENT_PENDING':
      if (!job.quote && job.bookingFee?.status !== 'PAID') {
        stage = (
          <StageScreen
            eyebrow="SERVICE BOOKING FEE"
            title="Service Booking Fee Required"
            subtitle="Pay the flat Service Booking Fee to confirm your technician and unlock direct chat."
            onBack={handleBack}
            footer={
              <>
                <Button
                  label="Pay Booking Fee"
                  icon="arrow-forward"
                  onPress={() => {
                    if (job.bookingFee?.status === 'PAID') {
                      const destChat = job.chatThreadId || job.chatId || job.id;
                      router.replace({
                        pathname: `/chat/${destChat}` as any,
                        params: { requestId: job.id },
                      });
                      return;
                    }
                    router.push({
                      pathname: '/checkout/verify-phone',
                      params: { requestId: job.id, technicianId: job.technician?.id, service: job.service, categoryId: job.serviceCategoryId },
                    });
                  }}
                  testID="pay-booking-fee-pending-button"
                />
                <Button label="Cancel request" variant="outline" onPress={() => setPending('cancel')} />
              </>
            }
          >
            {job.technician ? <TechnicianCard technician={job.technician} compact caption="Selected specialist" /> : null}
            <Notice
              tone="info"
              icon="information-circle-outline"
              text="This booking fee secures your request and unlocks direct chat with your technician. The final cost of the repair/service will be agreed upon and settled directly between you and the technician."
            />
          </StageScreen>
        );
        break;
      }
      stage = (
        <Settlement
          job={job}
          onRecord={(method) => {
            tap();
            recordSettlement(job.id, method);
          }}
          onBack={handleBack}
        />
      );
      break;

    case 'PAYMENT_REPORTED':
      stage = (
        <StageScreen title="Invoice processing" onBack={handleBack}>
          <LoadingState label="Preparing your invoice…" />
        </StageScreen>
      );
      break;

    default:
      stage = (
        <JobClosed
          job={job}
          onRebook={() => {
            router.push({
              pathname: '/select-technician',
              params: {
                jobId: job.id,
                category: job.service,
                service: job.service,
                description: job.problem,
                problem: job.problem,
                location: job.locationLabel,
                address: job.locationLabel,
                ...(job.locationLatitude !== undefined ? { latitude: String(job.locationLatitude) } : {}),
                ...(job.locationLongitude !== undefined ? { longitude: String(job.locationLongitude) } : {}),
              },
            });
          }}
        />
      );
  }

  const dialog = pending ? CONFIRM[pending] : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
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
});