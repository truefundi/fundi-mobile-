import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { jobsKey, LEGACY_JOBS_KEY } from '@/constants/storage';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
import { getServiceBookingFee } from '@/constants/services';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  isClosed,
  visitFeeFor,
  type BookingFee,
  type Job,
  type JobEvent,
  type JobStatus,
  type PaymentMethod,
  type PaymentStatus,
  type Quote,
  type Rating,
  type RequestLifecycleStatus,
  type RequestStatus,
  type RequestType,
  type ServiceRequest,
  type SettlementMethod,
  type Technician,
} from '@/constants/jobs';

export type {
  BookingFee,
  Job,
  JobStatus,
  PaymentStatus,
  RequestLifecycleStatus,
  RequestStatus,
  RequestType,
  ServiceRequest,
} from '@/constants/jobs';

type RequestMedia = {
  uri: string;
  sizeBytes?: number;
  mimeType?: string;
};

type NewRequest = Pick<
  Job,
  'service' | 'problem' | 'urgency' | 'locationLabel' | 'locationLatitude' | 'locationLongitude' | 'photoUri' | 'videoUri'
> & {
  type?: RequestType;
  bookingFee?: BookingFee;
  photos?: RequestMedia[];
  videos?: RequestMedia[];
  photoSizeBytes?: number;
  photoMimeType?: string;
  videoSizeBytes?: number;
  videoMimeType?: string;
};

type FundiContextValue = {
  jobs: Job[];
  isHydrated: boolean;
  getJob: (id: string) => Job | undefined;
  /** Every status change in reverse-chronological order, newest first. */
  events: (JobEvent & { jobId: string; service: string })[];
  addRequest: (request: NewRequest) => Promise<string>;
  createDraftRequest: (data: Partial<ServiceRequest>) => string;
  markBookingFeePaid: (requestId: string, transactionId: string) => void;
  initializeChatId: (requestId: string, chatId?: string) => string;
  /** Customer saw the matched technician and wants to continue. */
  acceptOffer: (id: string) => void;
  payVisitFee: (id: string, method: PaymentMethod) => void;
  approveQuote: (id: string) => void;
  declineQuote: (id: string) => void;
  approveAdditionalWork: (id: string) => void;
  declineAdditionalWork: (id: string) => void;
  startSettlement: (id: string) => void;
  recordSettlement: (id: string, method: SettlementMethod) => void;
  submitRating: (id: string, rating: Rating) => void;
  cancelJob: (id: string, reason?: string, recipientPhones?: string[]) => void;
  updateJob: (id: string, updates: Partial<Job>, recipientPhones?: string[]) => void;
  advance: (id: string, next: JobStatus) => void;
  assignEmergencyTechnician: (id: string, technician: Technician) => void;
  /** Assigns a manually selected mock technician to the request. */
  selectTechnician: (id: string, technician: Technician) => void;
  linkChatThread: (id: string, threadId: string) => void;
  findAnotherTechnician: (id: string) => void;
  markArrived: (id: string) => void;
  submitDiagnosis: (id: string, quote: Quote) => void;
  completeRepair: (id: string) => void;
};

export const FundiContext = createContext<FundiContextValue | undefined>(undefined);

/** Customer-facing copy for the notification feed, one entry per status change. */
const EVENT_COPY: Partial<Record<JobStatus, { title: string; text: string }>> = {
  REQUESTED: { title: 'Request sent', text: 'Choose an available technician for your request.' },
  MATCHING: { title: 'Choose a technician', text: 'Browse the available local mock technicians.' },
  SEARCHING_DISPATCH: { title: 'Emergency Dispatch Active', text: 'Alerting nearby verified emergency technicians...' },
  OFFERED: { title: 'Technician selected', text: 'Review the technician you selected before continuing.' },
  ACCEPTED: { title: 'Technician accepted your request', text: 'Pay the visit fee to confirm the callout.' },
  VISIT_PAID: { title: 'Payment successful', text: 'Your visit fee has been received.' },
  DISPATCHED: { title: 'Technician dispatched', text: 'A technician has been dispatched to your location.' },
  ACTIVE: { title: 'Technician accepted request', text: 'Technician accepted the job. Coordinate details in chat.' },
  IN_PROGRESS: { title: 'Job in progress', text: 'Technician has started work on your job.' },
  EN_ROUTE: { title: 'Your technician is on the way', text: 'Follow the arrival time on the tracking screen.' },
  ARRIVED: { title: 'Your technician has arrived', text: 'Diagnosis will begin shortly.' },
  DIAGNOSING: { title: 'Diagnosis in progress', text: 'Your technician is inspecting the problem.' },
  DIAGNOSIS_COMPLETE: { title: 'Diagnosis completed', text: 'A repair quote is being prepared for you.' },
  QUOTE_PENDING: { title: 'Quote received', text: 'Review the repair quote and approve it to continue.' },
  QUOTE_APPROVED: { title: 'Repair approved', text: 'Your technician is starting the repair.' },
  REPAIR_IN_PROGRESS: { title: 'Repair in progress', text: 'We will let you know as soon as the work is done.' },
  ADDITIONAL_APPROVAL_REQUIRED: { title: 'Extra work needs your approval', text: 'Nothing is charged until you approve it.' },
  REPAIR_COMPLETED: { title: 'Repair completed', text: 'Review the summary and settle the balance.' },
  PAYMENT_PENDING: { title: 'Payment pending', text: 'Payment is required to continue.' },
  PAYMENT_REPORTED: { title: 'Payment recorded', text: 'Your invoice is ready to view.' },
  COMPLETED: { title: 'Job completed', text: 'Thanks for using Fundi. Rate your technician to help others.' },
  CANCELLED: { title: 'Request cancelled', text: 'This job was cancelled.' },
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Short human-readable job reference shown on invoices, e.g. FND-4821. */
function makeReference(): string {
  return `FND-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Moves a job to `next`, attaching whatever data that stage introduces and
 * appending a notification event. Pure — callers replace the job in state.
 */
function transition(job: Job, next: JobStatus): Job {
  if (next === 'ACTIVE' && job.bookingFee?.status !== 'PAID') {
    throw new Error(`Cannot transition unpaid request (${job.id}) to ACTIVE status: booking fee must be PAID.`);
  }

  const now = new Date().toISOString();
  const moved: Job = { ...job, status: next, statusSince: now };

  if (next === 'COMPLETED') {
    moved.completedAt = now;
  }

  const copy = EVENT_COPY[next];
  if (copy) {
    const event: JobEvent = { id: makeId('evt'), status: next, title: copy.title, text: copy.text, at: now };
    moved.events = [...job.events, event];
  }
  return moved;
}

/**
 * Reads one account's jobs. Installs from before sign-in existed kept a single
 * unscoped list, so the first account to sign in adopts it.
 */
async function loadJobs(key: string): Promise<Job[]> {
  let stored = await AsyncStorage.getItem(key);
  if (stored === null) {
    const legacy = await AsyncStorage.getItem(LEGACY_JOBS_KEY);
    if (legacy !== null) {
      await AsyncStorage.setItem(key, legacy);
      await AsyncStorage.removeItem(LEGACY_JOBS_KEY);
      stored = legacy;
    }
  }
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as Partial<Job>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      type: item.type ?? 'STANDARD',
      bookingFee: item.bookingFee ?? {
        amount: item.visitFee ?? visitFeeFor(item.urgency ?? 'Today'),
        currency: 'RWF',
        status: item.status === 'VISIT_PAID' || item.visitPaymentMethod ? 'PAID' : 'PENDING',
        paidAt: item.status === 'VISIT_PAID' ? item.statusSince : undefined,
      },
    })) as Job[];
  } catch {
    return [];
  }
}

export function FundiProvider({ children }: { children: ReactNode }) {
  const { account, isHydrated: sessionReady } = useAuth();
  const { addNotification, linkJobThread } = useNotifications();
  const [jobs, setJobs] = useState<Job[]>([]);
  const jobsRef = useRef<Job[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Job history belongs to the phone number that created it.
  const storageKey = account ? jobsKey(account.phone) : null;
  const isHydrated = sessionReady && (storageKey === null || loadedKey === storageKey);

  useEffect(() => {
    if (!storageKey) {
      jobsRef.current = [];
      setJobs([]);
      setLoadedKey(null);
      return;
    }
    let mounted = true;
    jobsRef.current = [];
    setJobs([]);
    setLoadedKey(null);
    loadJobs(storageKey)
      .then((stored) => {
        if (!mounted) return;
        jobsRef.current = stored;
        setJobs(stored);
        setLoadedKey(storageKey);
      })
      .catch(() => {
        if (!mounted) return;
        setJobs([]);
        setLoadedKey(storageKey);
      });
    return () => {
      mounted = false;
    };
  }, [storageKey]);

  // Persist after hydration only, so an early write cannot clobber saved jobs.
  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(jobs)).catch(() => {
      // Storage failures are non-fatal: the journey keeps working in memory.
    });
  }, [jobs, loadedKey, storageKey]);

  const update = useCallback((id: string, change: (job: Job) => Job, recipientPhones?: string[]) => {
    const currentJob = jobsRef.current.find((job) => job.id === id);
    if (!currentJob) return;
    const updatedJob = change(currentJob);

    if (updatedJob.status === 'ACTIVE' && updatedJob.bookingFee?.status !== 'PAID') {
      throw new Error(`Cannot transition unpaid request (${updatedJob.id}) to ACTIVE status: booking fee must be PAID.`);
    }

    if (updatedJob.chatId && updatedJob.bookingFee?.status !== 'PAID') {
      throw new Error(`Cannot initialize chatId on unpaid request (${updatedJob.id}): booking fee must be PAID.`);
    }

    const updatedJobs = jobsRef.current.map((job) => (job.id === id ? updatedJob : job));
    jobsRef.current = updatedJobs;
    setJobs(updatedJobs);

    if (updatedJob.status !== currentJob.status) {
      const event = updatedJob.events[updatedJob.events.length - 1];
      if (event) {
        addNotification({
          id: event.id,
          jobId: updatedJob.id,
          threadId: updatedJob.chatThreadId,
          status: event.status,
          service: updatedJob.service,
          title: event.title,
          text: event.text,
          at: event.at,
          ...(recipientPhones ? { recipientPhones } : {}),
        });
      }
    }
  }, [addNotification]);

  const advance = useCallback(
    (id: string, next: JobStatus) => {
      update(id, (job) => transition(job, next));
    },
    [update],
  );

  const selectTechnician = useCallback(
    (id: string, technician: Technician) => {
      update(id, (job) =>
        job.status === 'REQUESTED' || job.status === 'MATCHING' || job.status === 'OFFERED' || job.status === 'CANCELLED' || job.status === 'SEARCHING_DISPATCH'
          ? transition({ ...job, technician }, 'OFFERED')
          : job,
      );
    },
    [update],
  );

  const assignEmergencyTechnician = useCallback(
    (id: string, technician: Technician) => {
      update(id, (job) => transition({ ...job, technician }, 'ACCEPTED'));
    },
    [update],
  );

  const linkChatThread = useCallback(
    (id: string, threadId: string) => {
      update(id, (job) => {
        if (job.bookingFee?.status !== 'PAID' && (job.status === 'PAYMENT_PENDING' || job.type === 'SOS')) {
          throw new Error(`Cannot initialize chatId on unpaid request (${job.id}): booking fee must be PAID.`);
        }
        return {
          ...job,
          chatThreadId: threadId,
          ...(job.bookingFee?.status === 'PAID' ? { chatId: threadId } : {}),
        };
      });
      linkJobThread(id, threadId);
    },
    [linkJobThread, update],
  );

  const initializeChatId = useCallback(
    (requestId: string, explicitChatId?: string): string => {
      const job = jobsRef.current.find((j) => j.id === requestId);
      if (!job) throw new Error(`Request not found: ${requestId}`);
      if (job.bookingFee?.status !== 'PAID') {
        throw new Error(`Cannot initialize chatId on unpaid request (${requestId}): booking fee must be PAID.`);
      }
      const finalChatId = explicitChatId || makeId('chat');
      update(requestId, (current) => ({
        ...current,
        chatId: finalChatId,
        chatThreadId: current.chatThreadId ?? finalChatId,
      }));
      return finalChatId;
    },
    [update],
  );

  const createDraftRequest = useCallback(
    (data: Partial<ServiceRequest>): string => {
      const bookingFeeStatus: PaymentStatus = data.bookingFee?.status ?? 'PENDING';
      const isPaid = bookingFeeStatus === 'PAID';

      if (!isPaid && data.status === 'ACTIVE') {
        throw new Error('Cannot transition unpaid request to ACTIVE status: booking fee must be PAID.');
      }
      if (!isPaid && data.chatId) {
        throw new Error('Cannot initialize chatId on unpaid request: booking fee must be PAID.');
      }

      const now = new Date().toISOString();
      const id = data.id ?? makeId('job');
      const urgency = data.urgency ?? (data.type === 'SOS' ? 'Emergency' : 'Today');
      const initialStatus: JobStatus = data.status ?? 'PAYMENT_PENDING';
      const feeAmount = data.bookingFee?.amount ?? (data.visitFee ?? getServiceBookingFee(data.service));

      const draft: Job = {
        id,
        reference: data.reference ?? makeReference(),
        service: data.service ?? (data.type === 'SOS' ? 'Emergency SOS' : 'General Maintenance'),
        problem: data.problem ?? '',
        urgency,
        locationLabel: data.locationLabel ?? 'Current Location',
        locationLatitude: data.locationLatitude,
        locationLongitude: data.locationLongitude,
        photoUri: data.photoUri,
        photoUris: data.photoUris ?? (data.photoUri ? [data.photoUri] : []),
        videoUri: data.videoUri,
        videoUris: data.videoUris ?? (data.videoUri ? [data.videoUri] : []),
        scheduledFor: data.scheduledFor,
        status: initialStatus,
        statusSince: now,
        createdAt: data.createdAt ?? now,
        technician: data.technician,
        chatThreadId: isPaid ? (data.chatThreadId ?? data.chatId) : undefined,
        chatId: isPaid ? (data.chatId ?? data.chatThreadId) : undefined,
        visitFee: data.visitFee ?? feeAmount,
        visitPaymentMethod: data.visitPaymentMethod,
        quote: data.quote,
        additionalWork: data.additionalWork,
        additionalWorkApproved: data.additionalWorkApproved,
        settlementMethod: data.settlementMethod,
        rating: data.rating,
        completedAt: data.completedAt,
        type: data.type ?? 'STANDARD',
        bookingFee: {
          amount: feeAmount,
          currency: data.bookingFee?.currency ?? 'RWF',
          status: bookingFeeStatus,
          paidAt: data.bookingFee?.paidAt,
          transactionId: data.bookingFee?.transactionId,
        },
        events: data.events ?? [],
      };

      const copy = EVENT_COPY[initialStatus];
      if (copy && draft.events.length === 0) {
        draft.events = [{ id: makeId('evt'), status: initialStatus, title: copy.title, text: copy.text, at: now }];
      }

      const updatedJobs = [draft, ...jobsRef.current];
      jobsRef.current = updatedJobs;
      setJobs(updatedJobs);

      if (draft.events[0]) {
        addNotification({
          id: draft.events[0].id,
          jobId: draft.id,
          status: initialStatus,
          service: draft.service,
          title: draft.events[0].title,
          text: draft.events[0].text,
          at: now,
        });
      }

      return id;
    },
    [addNotification],
  );

  const markBookingFeePaid = useCallback(
    (requestId: string, transactionId: string) => {
      update(requestId, (job) => {
        const now = new Date().toISOString();
        const updatedBookingFee: BookingFee = {
          ...job.bookingFee,
          amount: job.bookingFee?.amount ?? job.visitFee ?? visitFeeFor(job.urgency),
          currency: job.bookingFee?.currency ?? 'RWF',
          status: 'PAID',
          paidAt: now,
          transactionId,
        };
        const nextStatus: JobStatus =
          job.type === 'SOS'
            ? 'SEARCHING_DISPATCH'
            : job.status === 'PAYMENT_PENDING'
              ? 'VISIT_PAID'
              : job.status;

        const updatedJob: Job = {
          ...job,
          bookingFee: updatedBookingFee,
        };

        return nextStatus !== job.status ? transition(updatedJob, nextStatus) : updatedJob;
      });
    },
    [update],
  );

  const findAnotherTechnician = useCallback(
    (id: string) => {
      update(id, (job) => {
        if (isClosed(job.status)) return job;
        const { technician: _technician, chatThreadId: _chatThreadId, ...availableJob } = job;
        return job.status === 'MATCHING' ? availableJob : transition(availableJob, 'MATCHING');
      });
    },
    [update],
  );

  const markArrived = useCallback(
    (id: string) => {
      update(id, (job) => (job.status === 'EN_ROUTE' ? transition(job, 'ARRIVED') : job));
    },
    [update],
  );

  const submitDiagnosis = useCallback(
    (id: string, quote: Quote) => {
      update(id, (job) =>
        job.status === 'ARRIVED' || job.status === 'DIAGNOSING'
          ? transition({ ...job, quote }, 'DIAGNOSIS_COMPLETE')
          : job,
      );
    },
    [update],
  );

  const completeRepair = useCallback(
    (id: string) => {
      update(id, (job) => (job.status === 'REPAIR_IN_PROGRESS' ? transition(job, 'REPAIR_COMPLETED') : job));
    },
    [update],
  );

  const addRequest = useCallback(async (request: NewRequest) => {
    const photos = request.photos ?? (request.photoUri
      ? [{ uri: request.photoUri, sizeBytes: request.photoSizeBytes, mimeType: request.photoMimeType }]
      : []);
    const videos = request.videos ?? (request.videoUri
      ? [{ uri: request.videoUri, sizeBytes: request.videoSizeBytes, mimeType: request.videoMimeType }]
      : []);

    for (const photo of photos) {
      if (photo.sizeBytes === undefined || !Number.isFinite(photo.sizeBytes) || photo.sizeBytes < 0) {
        throw new Error(`Choose each photo again so its size can be checked (maximum ${MAX_UPLOAD_SIZE_LABEL}).`);
      }
      if (photo.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
        throw new Error(`Each photo must be no larger than ${MAX_UPLOAD_SIZE_LABEL}.`);
      }
      if (!inferUploadMimeType(photo.uri, photo.mimeType)?.startsWith('image/')) {
        throw new Error('Choose photos, not videos or documents.');
      }
    }
    for (const video of videos) {
      if (video.sizeBytes === undefined || !Number.isFinite(video.sizeBytes) || video.sizeBytes < 0) {
        throw new Error(`Choose the video again so its size can be checked (maximum ${MAX_UPLOAD_SIZE_LABEL}).`);
      }
      if (video.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
        throw new Error(`Video must be no larger than ${MAX_UPLOAD_SIZE_LABEL}.`);
      }
      if (!inferUploadMimeType(video.uri, video.mimeType)?.startsWith('video/')) {
        throw new Error('Choose a video, not a photo or document.');
      }
    }
    const {
      photos: _photos,
      videos: _videos,
      photoSizeBytes: _photoSizeBytes,
      photoMimeType: _photoMimeType,
      videoSizeBytes: _videoSizeBytes,
      videoMimeType: _videoMimeType,
      ...jobRequest
    } = request;
    const now = new Date().toISOString();
    const id = makeId('job');
    const fee = getServiceBookingFee(request.service);
    const base: Job = {
      ...jobRequest,
      photoUri: photos[0]?.uri,
      photoUris: photos.map((photo) => photo.uri),
      videoUri: videos[0]?.uri,
      videoUris: videos.map((video) => video.uri),
      id,
      reference: makeReference(),
      status: 'REQUESTED',
      statusSince: now,
      createdAt: now,
      visitFee: fee,
      type: request.type ?? (request.urgency === 'Emergency' ? 'SOS' : 'STANDARD'),
      bookingFee: request.bookingFee ?? {
        amount: fee,
        currency: 'RWF',
        status: 'PENDING',
      },
      events: [],
    };
    const copy = EVENT_COPY.REQUESTED!;
    base.events = [{ id: makeId('evt'), status: 'REQUESTED', title: copy.title, text: copy.text, at: now }];
    const updatedJobs = [base, ...jobsRef.current];
    jobsRef.current = updatedJobs;
    setJobs(updatedJobs);
    addNotification({
      id: base.events[0]!.id,
      jobId: base.id,
      status: 'REQUESTED',
      service: base.service,
      title: copy.title,
      text: copy.text,
      at: now,
    });
    return id;
  }, [addNotification]);

  const value = useMemo<FundiContextValue>(() => {
    const events = jobs
      .flatMap((job) => job.events.map((event) => ({ ...event, jobId: job.id, service: job.service })))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      jobs,
      isHydrated,
      events,
      getJob: (id) => jobs.find((job) => job.id === id),
      addRequest,
      createDraftRequest,
      markBookingFeePaid,
      initializeChatId,
      acceptOffer: (id) => advance(id, 'ACCEPTED'),
      payVisitFee: (id, method) =>
        update(id, (job) =>
          transition(
            {
              ...job,
              visitPaymentMethod: method,
              bookingFee: {
                ...job.bookingFee,
                amount: job.bookingFee?.amount ?? job.visitFee,
                currency: job.bookingFee?.currency ?? 'RWF',
                status: 'PAID',
                paidAt: new Date().toISOString(),
                transactionId: job.bookingFee?.transactionId ?? makeId('tx'),
              },
            },
            'VISIT_PAID',
          ),
        ),
      approveQuote: (id) => advance(id, 'QUOTE_APPROVED'),
      declineQuote: (id) => advance(id, 'CANCELLED'),
      approveAdditionalWork: (id) =>
        update(id, (job) => transition({ ...job, additionalWorkApproved: true }, 'REPAIR_IN_PROGRESS')),
      declineAdditionalWork: (id) =>
        update(id, (job) => transition({ ...job, additionalWorkApproved: false }, 'REPAIR_IN_PROGRESS')),
      startSettlement: (id) => advance(id, 'PAYMENT_PENDING'),
      recordSettlement: (id, method) =>
        update(id, (job) => transition({ ...job, settlementMethod: method }, 'PAYMENT_REPORTED')),
      submitRating: (id, rating) => update(id, (job) => ({ ...job, rating })),
      cancelJob: (id, reason, recipientPhones) => update(id, (job) => ({ ...transition(job, 'CANCELLED'), ...(reason ? { cancellationReason: reason } : {}) }), recipientPhones),
      updateJob: (id, updates, recipientPhones) => update(id, (job) => { const now = new Date().toISOString(); const nextStatus = updates.status ?? job.status; let moved: Job = { ...job, ...updates, status: nextStatus, statusSince: nextStatus !== job.status ? now : job.statusSince }; if (nextStatus === 'COMPLETED') { moved.completedAt = updates.completedAt ?? now; } if (nextStatus !== job.status && EVENT_COPY[nextStatus]) { const copy = EVENT_COPY[nextStatus]!; moved.events = [...job.events, { id: makeId('evt'), status: nextStatus, title: copy.title, text: copy.text, at: now }]; } return moved; }, recipientPhones),

      advance,
      assignEmergencyTechnician,
      selectTechnician,
      linkChatThread,
      findAnotherTechnician,
      markArrived,
      submitDiagnosis,
      completeRepair,
    };
  }, [addRequest, advance, assignEmergencyTechnician, completeRepair, createDraftRequest, findAnotherTechnician, initializeChatId, isHydrated, jobs, linkChatThread, markArrived, markBookingFeePaid, selectTechnician, submitDiagnosis, update]);

  return <FundiContext.Provider value={value}>{children}</FundiContext.Provider>;
}

export function useFundi() {
  const context = useContext(FundiContext);
  if (!context) throw new Error('useFundi must be used inside FundiProvider');
  return context;
}

/** Convenience hook for the job screens, which all key off a route param. */
export function useJob(id: string | undefined) {
  const { getJob, isHydrated } = useFundi();
  return { job: id ? getJob(id) : undefined, isHydrated };
}

export { isClosed };
