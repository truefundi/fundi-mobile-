import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { jobsKey, techJobsKey, workKey } from '@/constants/storage';
import { getServiceBookingFee } from '@/constants/services';
import {
  type TechnicianApplication,
  type WorkProfile,
  type WorkStatus,
  isWorkPending,
  isWorkVerified,
  isWorkRejected,
} from '@/constants/work';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
import {
  isClosed,
  isTerminated,
  COMMISSION_RATE,
  type BookingFee,
  type Job,
  type JobStatus,
  type PaymentStatus,
  type RequestLifecycleStatus,
  type RequestStatus,
  type RequestType,
  type ServiceRequest,
} from '@/constants/jobs';
import { useAuth } from '@/context/AuthContext';
import { FundiContext } from '@/context/FundiContext';
import { ApiRequestError, apiRequest, apiUpload } from '@/lib/api';
import { companyBody, updateMyCompany } from '@/lib/companies-api';
import { cleanAndNormalizePhone, refreshTokens } from '@/lib/auth-api';
import { getAccessToken } from '@/lib/auth-session';
import { acquireEventsSocket, onAppEvent } from '@/lib/events-socket';

import {
  acceptTechnicianOffer,
  confirmJobCooperation,
  dropTechnicianJob,
  fetchTechnicianJobs,
  fetchTechnicianOffers,
  rejectTechnicianOffer,
  updateJobProgress,
  type BackendJob,
  type TechnicianOfferItem,
  jobMediaUrl,
} from '@/lib/jobs-api';

/** Fallback refresh interval for incoming requests while the push socket is unavailable. */
const OFFER_POLL_MS = 20_000;

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

/** Which side of the marketplace the app is showing. */
export type Mode = 'hiring' | 'working';

type Stored = {
  mode: Mode;
  isAvailable: boolean;
  status: WorkStatus;
  profile: WorkProfile | null;
  applicationError: string | null;
  submissionFailed: boolean;
};

const EMPTY: Stored = {
  mode: 'hiring',
  isAvailable: false,
  status: 'none',
  profile: null,
  applicationError: null,
  submissionFailed: false,
};

function parseStored(raw: string | null): Stored {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      ...EMPTY,
      mode: parsed.mode ?? EMPTY.mode,
      isAvailable: parsed.isAvailable ?? EMPTY.isAvailable,
      status: parsed.status ?? EMPTY.status,
      profile: parsed.profile ? { ...parsed.profile, nationalIdNumber: undefined } : null,
      applicationError: parsed.applicationError ?? null,
      submissionFailed: parsed.submissionFailed ?? false,
    };
  } catch {
    return EMPTY;
  }
}

function serializeStored(value: Stored): string {
  return JSON.stringify({
    ...value,
    profile: value.profile ? { ...value.profile, nationalIdNumber: undefined } : null,
  });
}

type ApiTechnicianProfile = {
  id: string;
  businessType?: 'INDIVIDUAL' | 'COMPANY';
  user: { fullName: string; phoneNumber: string; email: string | null };
  gender: WorkProfile['gender'];
  yearsOfExperience: number;
  serviceExperiences: Array<{
    id?: string;
    categoryId?: string | null;
    customName: string | null;
    category: { name: string } | null;
    yearsOfExperience: number;
    status?: 'PENDING' | 'APPROVED' | 'DENIED' | 'SUSPENDED';
    reviewNote?: string | null;
  }>;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  /** The admin's note when the whole application was rejected. */
  rejectionReason?: string | null;
  availabilityStatus: 'ONLINE' | 'OFFLINE';
  location: { address: string; latitude: number; longitude: number };
  profilePictureUrl: string | null;
  nationalIdNumber: string | null;
  paymentMethod: WorkProfile['paymentMethod'] | null;
  paymentNumber: string | null;
  createdAt: string;
};

type ApiTechnicianDocument = NonNullable<WorkProfile['documents']>[number];

/** A file picked on the device for a document upload. */
export type DocumentFile = { uri: string; name?: string; size?: number; mimeType?: string };

function statusFromApi(status: ApiTechnicianProfile['verificationStatus']): WorkStatus {
  if (status === 'APPROVED') return 'verified';
  if (status === 'REJECTED') return 'rejected';
  return 'PENDING_REVIEW';
}

function mapProfile(
  profile: ApiTechnicianProfile,
  documents: ApiTechnicianDocument[],
  local: WorkProfile | null,
): WorkProfile {
  // 1. Identify server documents
  const nationalIdDoc = documents.find((d) => d.type === 'NATIONAL_ID' && d.status !== 'DENIED');
  const certDocs = documents.filter((d) => d.type === 'CERTIFICATE' && d.status !== 'DENIED');

  const experiences = profile.serviceExperiences.map((service) => ({
    id: service.id,
    categoryId: service.categoryId ?? null,
    trade: service.category?.name ?? service.customName ?? 'General Maintenance',
    customName: service.customName ?? '',
    yearsOfExperience: service.yearsOfExperience,
    status: service.status ?? 'PENDING',
    reviewNote: service.reviewNote ?? null,
  }));

  // General feedback only; notes on denied documents are shown on each document.
  const deniedExp = experiences.find((e) => e.status === 'DENIED' || e.status === 'SUSPENDED');
  // The admin's reason comes from the server; the generic line is only for
  // rejections made before reasons were recorded.
  const rejectionFeedback =
    profile.verificationStatus === 'REJECTED'
      ? profile.rejectionReason?.trim() || deniedExp?.reviewNote || 'Application was not approved.'
      : deniedExp?.reviewNote ?? null;

  return {
    ...local,
    id: profile.id,
    fullName: profile.user.fullName,
    phoneNumber: profile.user.phoneNumber,
    email: profile.user.email ?? '',
    gender: profile.gender ?? undefined,
    nationalIdNumber: profile.nationalIdNumber ?? '',
    baseAddress: profile.location.address,
    baseLatitude: profile.location.latitude,
    baseLongitude: profile.location.longitude,
    paymentMethod: profile.paymentMethod ?? undefined,
    paymentNumber: profile.paymentNumber ?? '',
    profilePictureUrl: profile.profilePictureUrl,
    
    // 2. Fallback to server documents if local draft is cleared by logout
    idPhotoUri: local?.idPhotoUri || (nationalIdDoc ? `https://remote-doc/${nationalIdDoc.id}` : ''),
    certificateUris: local?.certificateUris?.length 
      ? local.certificateUris 
      : certDocs.map((d) => `https://remote-doc/${d.id}`),

    trade: (experiences[0]?.trade ?? 'General Maintenance') as WorkProfile['trade'],
    yearsExperience: profile.yearsOfExperience,
    serviceExperiences: experiences,
    documents,
    submittedAt: profile.createdAt,
    rejectionFeedback,
    businessType: profile.businessType ?? local?.businessType,
  };
}

function validateApplicationFile(
  label: string,
  uri: string,
  sizeBytes: number | undefined,
  declaredMimeType: string | undefined,
  allowPdf = false,
): string {
  if (sizeBytes === undefined || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new Error(`Please choose ${label} again so its size can be checked (maximum ${MAX_UPLOAD_SIZE_LABEL}).`);
  }
  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`${label} must be no larger than ${MAX_UPLOAD_SIZE_LABEL}.`);
  }
  const mimeType = inferUploadMimeType(uri, declaredMimeType);
  if (mimeType?.startsWith('image/')) return mimeType;
  if (allowPdf && mimeType === 'application/pdf') return mimeType;
  throw new Error(allowPdf ? `${label} must be a photo or PDF.` : `${label} must be a photo.`);
}

async function appendLocalFile(form: FormData, uri: string, fileName: string, mimeType: string): Promise<void> {
  const extension = mimeType === 'application/pdf'
    ? 'pdf'
    : mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType.slice('image/'.length).replace(/[^a-z0-9]/g, '') || 'img';
  const fullName = `${fileName}.${extension}`;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read the selected document.');
    form.append('file', await response.blob(), fullName);
    return;
  }
  const safeUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
  form.append('file', {
    uri: safeUri,
    name: fullName,
    type: mimeType,
  } as any);
}

/** Prefix of techJobsKey(phone) in constants/storage. */
export const TECH_JOBS_KEY = '@fundi/technician-jobs';

function mapBackendJobToTechnicianJob(backendJob: BackendJob): Job {
  const photoMedia = backendJob.media?.filter((m) => m.type === 'PHOTO') ?? [];
  const videoMedia = backendJob.media?.filter((m) => m.type === 'VIDEO') ?? [];
  const photoUris = photoMedia.map(jobMediaUrl);
  const videoUris = videoMedia.map(jobMediaUrl);

  let status: JobStatus = 'ACTIVE';
  if (backendJob.status === 'CANCELLED' || backendJob.status === 'FAILED') status = 'CANCELLED';
  else if (backendJob.status === 'COMPLETED') status = 'COMPLETED';
  else if (backendJob.status === 'IN_PROGRESS') status = 'IN_PROGRESS';
  else if (backendJob.status === 'OPEN') status = 'REQUESTED';
  else if (backendJob.status === 'ASSIGNED') {
    // STARTED means the request was accepted; work on site is IN_PROGRESS.
    status =
      backendJob.technicianProgress === 'IN_PROGRESS' || backendJob.technicianProgress === 'COMPLETED'
        ? 'IN_PROGRESS'
        : 'ACTIVE';
  }

  return {
    id: backendJob.id,
    reference: `FND-${backendJob.id.slice(-4).toUpperCase()}`,
    service: backendJob.serviceCategory?.name || backendJob.service || 'Service Request',
    serviceCategoryId: backendJob.serviceCategory?.id,
    problem: backendJob.description,
    urgency: backendJob.requestType === 'SOS' || backendJob.priority === 'URGENT' ? 'Emergency' : 'Today',
    locationLabel: backendJob.location?.address || 'Kigali, Rwanda',
    locationLatitude: backendJob.location?.latitude,
    locationLongitude: backendJob.location?.longitude,
    photoUri: photoUris[0],
    photoUris,
    videoUri: videoUris[0],
    videoUris,
    status,
    statusSince: backendJob.updatedAt || backendJob.createdAt,
    createdAt: backendJob.createdAt,
    completedAt: backendJob.completedAt ?? undefined,
    cancellationReason: backendJob.cancellationReason ?? undefined,
    clientName: 'Client',
    clientPhone: '',
    type: backendJob.requestType === 'SOS' ? 'SOS' : 'STANDARD',
    agreedPrice: backendJob.offeredAmount || undefined,
    cooperationStatus: backendJob.cooperationStatus,
    customerProgress: backendJob.customerProgress,
    technicianProgress: backendJob.technicianProgress,
    paymentId: backendJob.bookingPayment?.id,
    bookingFee: {
      amount: backendJob.bookingPayment?.amount || 0,
      currency: backendJob.bookingPayment?.currency || 'RWF',
      status: 'PAID',
      paidAt: backendJob.bookingPayment?.paidAt,
      transactionId: backendJob.bookingPayment?.externalPaymentId,
    },
    events: [],
  };
}

function mapOfferToJob(offer: TechnicianOfferItem): Job {
  const photoMedia = offer.job.media?.filter((m) => m.type === 'PHOTO') ?? [];
  const videoMedia = offer.job.media?.filter((m) => m.type === 'VIDEO') ?? [];
  return {
    id: offer.job.id,
    offerId: offer.id,
    reference: `OFF-${offer.id.slice(-4).toUpperCase()}`,
    service: offer.job.service || 'Service request',
    problem: offer.job.description,
    urgency: offer.job.priority === 'URGENT' ? 'Emergency' : 'Today',
    locationLabel: offer.job.locationAddress || 'Client Location',
    locationLatitude: offer.job.latitude,
    locationLongitude: offer.job.longitude,
    photoUris: photoMedia.map(jobMediaUrl),
    videoUris: videoMedia.map(jobMediaUrl),
    photoUri: photoMedia[0] ? jobMediaUrl(photoMedia[0]) : undefined,
    videoUri: videoMedia[0] ? jobMediaUrl(videoMedia[0]) : undefined,
    status: 'OFFERED',
    statusSince: offer.job.createdAt,
    createdAt: offer.job.createdAt,
    agreedPrice: offer.job.offeredAmount || 0,
    type: 'STANDARD',
    bookingFee: {
      amount: offer.job.offeredAmount || 0,
      currency: offer.job.currency || 'RWF',
      status: 'PAID',
    },
    events: [],
  };
}

type WorkContextValue = {
  mode: Mode;
  /**
   * Moves between hiring and working. For an approved technician this also switches the
   * account's role on the server. Hiring is never refused: while technician jobs are
   * still active the API keeps the TECHNICIAN role, and the app hires under it.
   */
  setMode: (mode: Mode) => Promise<void>;
  /** True when the app shows the technician side: working mode with an approved application. */
  actingAsTechnician: boolean;
  isAvailable: boolean;
  setAvailable: (available: boolean) => Promise<void>;
  status: WorkStatus;
  profile: WorkProfile | null;
  applicationError: string | null;
  submissionFailed: boolean;
  refreshApplication: () => Promise<void>;
  apply: (profile: TechnicianApplication) => Promise<void>;
  /** Replaces one denied document with a new file and sends it back to review. */
  resubmitDocument: (documentId: string, file: DocumentFile) => Promise<void>;
  offers: Job[];
  technicianOffers: TechnicianOfferItem[];
  mine: Job[];
  done: Job[];
  cancelled: Job[];
  earnings: number;
  refreshJobs: () => Promise<void>;
  acceptOffer: (offerId: string) => Promise<BackendJob>;
  rejectOffer: (offerId: string, reason?: string) => Promise<{ success: boolean }>;
  confirmCooperation: (jobId: string) => Promise<BackendJob>;
  addOrUpdateJob: (job: Job, targetTechnicianPhone?: string) => Promise<void>;
  startJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string, reason: string) => Promise<void>;
  completeJob: (jobId: string, completedPhotoUri?: string) => Promise<void>;
  createDraftRequest: (data: Partial<ServiceRequest>) => string;
  markBookingFeePaid: (requestId: string, transactionId: string) => void;
  initializeChatId?: (requestId: string, chatId?: string) => string;
};

const WorkContext = createContext<WorkContextValue | null>(null);

/** Technician profile and verification state are server-owned; local storage keeps only the draft. */
export function WorkProvider({ children }: { children: ReactNode }) {
  const { account, updateRole } = useAuth();
  const accountRef = useRef(account);
  accountRef.current = account;
  const fundi = useContext(FundiContext);
  const [state, setState] = useState<Stored>(EMPTY);
  const [techJobs, setTechJobs] = useState<Job[]>([]);
  const techJobsRef = useRef<Job[]>([]);
  const [technicianOffers, setTechnicianOffers] = useState<TechnicianOfferItem[]>([]);
  const storageKey = account ? workKey(account.phone) : null;

  const [localDrafts, setLocalDrafts] = useState<Job[]>([]);
  const localDraftsRef = useRef<Job[]>([]);

  const localCreateDraftRequest = useCallback((data: Partial<ServiceRequest>): string => {
    const bookingFeeStatus: PaymentStatus = data.bookingFee?.status ?? 'PENDING';
    const isPaid = bookingFeeStatus === 'PAID';
    if (!isPaid && data.status === 'ACTIVE') {
      throw new Error('Cannot transition unpaid request to ACTIVE status: booking fee must be PAID.');
    }
    if (!isPaid && data.chatId) {
      throw new Error('Cannot initialize chatId on unpaid request: booking fee must be PAID.');
    }
    const id = data.id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const urgency = data.urgency ?? (data.type === 'SOS' ? 'Emergency' : 'Today');
    const feeAmount = data.bookingFee?.amount ?? getServiceBookingFee(data.service);
    const draft: Job = {
      id,
      reference: data.reference ?? `FND-${Math.floor(1000 + Math.random() * 9000)}`,
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
      status: data.status ?? 'PAYMENT_PENDING',
      statusSince: now,
      createdAt: data.createdAt ?? now,
      technician: data.technician,
      chatThreadId: isPaid ? (data.chatThreadId ?? data.chatId) : undefined,
      chatId: isPaid ? (data.chatId ?? data.chatThreadId) : undefined,
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
    localDraftsRef.current = [draft, ...localDraftsRef.current];
    setLocalDrafts(localDraftsRef.current);
    return id;
  }, []);

  const localMarkBookingFeePaid = useCallback((requestId: string, transactionId: string) => {
    const job = localDraftsRef.current.find((j) => j.id === requestId);
    if (!job) return;
    const now = new Date().toISOString();
    const nextStatus = job.status === 'PAYMENT_PENDING' ? (job.type === 'SOS' ? 'DISPATCHED' : 'PAID') : job.status;
    const updated: Job = {
      ...job,
      status: nextStatus,
      bookingFee: {
        ...job.bookingFee,
        status: 'PAID',
        paidAt: now,
        transactionId,
      },
    };
    localDraftsRef.current = localDraftsRef.current.map((j) => (j.id === requestId ? updated : j));
    setLocalDrafts(localDraftsRef.current);
  }, []);

  const localInitializeChatId = useCallback((requestId: string, explicitChatId?: string): string => {
    const job = localDraftsRef.current.find((j) => j.id === requestId);
    if (!job) throw new Error(`Request not found: ${requestId}`);
    if (job.bookingFee?.status !== 'PAID') {
      throw new Error(`Cannot initialize chatId on unpaid request (${requestId}): booking fee must be PAID.`);
    }
    const finalChatId = explicitChatId || `chat-${Date.now()}`;
    const updated: Job = {
      ...job,
      chatId: finalChatId,
      chatThreadId: job.chatThreadId ?? finalChatId,
    };
    localDraftsRef.current = localDraftsRef.current.map((j) => (j.id === requestId ? updated : j));
    setLocalDrafts(localDraftsRef.current);
    return finalChatId;
  }, []);

  const refreshJobs = useCallback(async () => {
    if (!account?.phone) return;
    try {
      const [jobs, offers] = await Promise.all([
        fetchTechnicianJobs().catch(() => []),
        fetchTechnicianOffers().catch(() => []),
      ]);
      const mappedJobs = jobs.map(mapBackendJobToTechnicianJob);
      techJobsRef.current = mappedJobs;
      setTechJobs(mappedJobs);
      setTechnicianOffers(offers);
      const key = techJobsKey(account.phone);
      await AsyncStorage.setItem(key, JSON.stringify(mappedJobs)).catch(() => {});
    } catch (err) {
      console.warn('Could not refresh technician jobs/offers:', err);
    }
  }, [account?.phone]);

  useEffect(() => {
    if (!account?.phone) {
      setTechJobs([]);
      techJobsRef.current = [];
      setTechnicianOffers([]);
      return;
    }
    const key = techJobsKey(account.phone);
    void AsyncStorage.getItem(key).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTechJobs(parsed);
            techJobsRef.current = parsed;
          }
        } catch {}
      }
      void refreshJobs();
    });
  }, [account?.phone, refreshJobs]);

  // Incoming client requests (job offers) expire after a few minutes, so technicians
  // must see them immediately: listen for the backend's `job:offer` push, poll as a
  // fallback, and refresh whenever the app returns to the foreground.
  useEffect(() => {
    if (account?.role !== 'TECHNICIAN') return;
    const release = acquireEventsSocket();
    const offOffer = onAppEvent('job:offer', () => void refreshJobs());
    const offNotification = onAppEvent('notification:new', () => void refreshJobs());
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshJobs();
    }, OFFER_POLL_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshJobs();
    });
    return () => {
      offOffer();
      offNotification();
      clearInterval(timer);
      sub.remove();
      release();
    };
  }, [account?.role, refreshJobs]);

  const acceptOffer = useCallback(async (offerId: string): Promise<BackendJob> => {
    const backendJob = await acceptTechnicianOffer(offerId);
    const mapped = mapBackendJobToTechnicianJob(backendJob);
    const updated = [mapped, ...techJobsRef.current.filter((j) => j.id !== mapped.id)];
    techJobsRef.current = updated;
    setTechJobs(updated);
    setTechnicianOffers((prev) => prev.filter((o) => o.id !== offerId));
    if (account?.phone) {
      await AsyncStorage.setItem(techJobsKey(account.phone), JSON.stringify(updated)).catch(() => {});
    }
    return backendJob;
  }, [account?.phone]);

  const rejectOffer = useCallback(async (offerId: string, reason?: string): Promise<{ success: boolean }> => {
    const res = await rejectTechnicianOffer(offerId, reason);
    setTechnicianOffers((prev) => prev.filter((o) => o.id !== offerId));
    return res;
  }, []);

  const confirmCooperation = useCallback(async (jobId: string): Promise<BackendJob> => {
    const backendJob = await confirmJobCooperation(jobId, 'technician');
    const mapped = mapBackendJobToTechnicianJob(backendJob);
    const updated = techJobsRef.current.map((j) => (j.id === jobId ? mapped : j));
    techJobsRef.current = updated;
    setTechJobs(updated);
    if (account?.phone) {
      await AsyncStorage.setItem(techJobsKey(account.phone), JSON.stringify(updated)).catch(() => {});
    }
    return backendJob;
  }, [account?.phone]);

  const addOrUpdateJob = useCallback(
    async (job: Job, targetTechnicianPhone?: string) => {
      const targetPhone = targetTechnicianPhone || account?.phone;
      if (!account?.phone || account.phone === targetPhone) {
        const updated = [job, ...techJobsRef.current.filter((j) => j.id !== job.id)];
        techJobsRef.current = updated;
        setTechJobs(updated);
      }
      if (targetPhone) {
        const key = techJobsKey(targetPhone);
        try {
          const raw = await AsyncStorage.getItem(key);
          const currentList: Job[] = raw ? JSON.parse(raw) : [];
          const updatedList = [job, ...currentList.filter((j) => j.id !== job.id)];
          await AsyncStorage.setItem(key, JSON.stringify(updatedList));
        } catch {}
      }
      if (fundi) {
        fundi.updateJob(job.id, job);
      }
    },
    [account?.phone, fundi],
  );

  const startJob = useCallback(
    async (jobId: string) => {
      try {
        await updateJobProgress(jobId, 'IN_PROGRESS', 'technician');
      } catch (err) {
        console.warn('Backend start progress update non-fatal:', err);
      }

      const now = new Date().toISOString();
      const targetJob = techJobsRef.current.find((j) => j.id === jobId);
      const updated = techJobsRef.current.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            status: 'IN_PROGRESS' as JobStatus,
            statusSince: now,
            events: [
              ...j.events,
              {
                id: `evt-${Date.now()}`,
                status: 'IN_PROGRESS' as JobStatus,
                title: 'Job in progress',
                text: 'Technician has started work on this job.',
                at: now,
              },
            ],
          };
        }
        return j;
      });
      techJobsRef.current = updated;
      setTechJobs(updated);
      if (account?.phone) {
        await AsyncStorage.setItem(techJobsKey(account.phone), JSON.stringify(updated));
      }
      if (fundi) {
        fundi.updateJob(jobId, { status: 'IN_PROGRESS' });
      }
      if (targetJob?.clientPhone) {
        const clientKey = jobsKey(targetJob.clientPhone);
        void AsyncStorage.getItem(clientKey).then((raw) => {
          if (!raw) return;
          try {
            const list: Job[] = JSON.parse(raw);
            const updatedClientList = list.map((j) =>
              j.id === jobId ? { ...j, status: 'IN_PROGRESS' as JobStatus, statusSince: now } : j,
            );
            void AsyncStorage.setItem(clientKey, JSON.stringify(updatedClientList));
          } catch {}
        });

      }
    },
    [account?.phone, fundi],
  );

  const cancelJob = useCallback(
    async (jobId: string, reason: string) => {
      try {
        await dropTechnicianJob(jobId, reason);
      } catch (err) {
        console.warn('Backend drop job non-fatal:', err);
      }

      const now = new Date().toISOString();
      const targetJob = techJobsRef.current.find((j) => j.id === jobId);
      const updated = techJobsRef.current.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            status: 'CANCELLED' as JobStatus,
            cancellationReason: reason,
            statusSince: now,
            events: [
              ...j.events,
              {
                id: `evt-${Date.now()}`,
                status: 'CANCELLED' as JobStatus,
                title: 'Job cancelled by technician',
                text: reason,
                at: now,
              },
            ],
          };
        }
        return j;
      });
      techJobsRef.current = updated;
      setTechJobs(updated);
      if (account?.phone) {
        await AsyncStorage.setItem(techJobsKey(account.phone), JSON.stringify(updated));
      }
      if (fundi) {
        fundi.cancelJob(jobId, reason, [targetJob?.clientPhone].filter(Boolean) as string[]);
      }
      if (targetJob?.clientPhone) {
        const clientKey = jobsKey(targetJob.clientPhone);
        void AsyncStorage.getItem(clientKey).then((raw) => {
          if (!raw) return;
          try {
            const list: Job[] = JSON.parse(raw);
            const updatedClientList = list.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'CANCELLED' as JobStatus,
                    statusSince: now,
                    cancellationReason: reason,
                  }
                : j,
            );
            void AsyncStorage.setItem(clientKey, JSON.stringify(updatedClientList));
          } catch {}
        });

      }
    },
    [account?.phone, fundi],
  );

  const completeJob = useCallback(
    async (jobId: string, completedPhotoUri?: string) => {
      try {
        await updateJobProgress(jobId, 'COMPLETED', 'technician');
      } catch (err) {
        console.warn('Backend complete job non-fatal:', err);
      }

      const now = new Date().toISOString();
      const targetJob = techJobsRef.current.find((j) => j.id === jobId);
      const updated = techJobsRef.current.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            status: 'COMPLETED' as JobStatus,
            completedPhotoUri,
            completedAt: now,
            statusSince: now,
            events: [
              ...j.events,
              {
                id: `evt-${Date.now()}`,
                status: 'COMPLETED' as JobStatus,
                title: 'Job completed',
                text: 'Technician has completed the work successfully.',
                at: now,
              },
            ],
          };
        }
        return j;
      });
      techJobsRef.current = updated;
      setTechJobs(updated);
      if (account?.phone) {
        await AsyncStorage.setItem(techJobsKey(account.phone), JSON.stringify(updated));
      }
      if (fundi) {
        fundi.updateJob(jobId, { status: 'COMPLETED', completedPhotoUri, completedAt: now });
      }
      if (targetJob?.clientPhone) {
        const clientKey = jobsKey(targetJob.clientPhone);
        void AsyncStorage.getItem(clientKey).then((raw) => {
          if (!raw) return;
          try {
            const list: Job[] = JSON.parse(raw);
            const updatedClientList = list.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'COMPLETED' as JobStatus,
                    statusSince: now,
                    completedAt: now,
                    completedPhotoUri,
                  }
                : j,
            );
            void AsyncStorage.setItem(clientKey, JSON.stringify(updatedClientList));
          } catch {}
        });

      }
    },
    [account?.phone, fundi],
  );

  const update = useCallback(
    (next: (current: Stored) => Stored) => {
      setState((current) => {
        const value = next(current);
        if (storageKey) {
          void AsyncStorage.setItem(storageKey, serializeStored(value)).catch((error: unknown) => {
            console.error('Unable to persist technician application state.', error);
          });
        }
        return value;
      });
    },
    [storageKey],
  );

  /** Uploads in flight; background refreshes wait so they never see a half-finished submission. */
  const uploadsInFlight = useRef(0);

  const refreshApplication = useCallback(async () => {
    if (!storageKey) return;
    if (uploadsInFlight.current > 0) return;
    // Applying keeps the account a customer until it switches roles, so the application
    // is read whatever the role: a 404 simply means there is none.
    try {
      const serverProfile = await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', {
        authenticated: true,
      });
      const documents = await apiRequest<ApiTechnicianDocument[]>('/api/v1/technicians/profile/documents', {
        authenticated: true,
      });
      if (uploadsInFlight.current > 0) return;
      setState((current) => {
        // A denied ID is replaced on its own from the document list; only a missing one needs the form.
        const hasNationalId = documents.some((document) => document.type === 'NATIONAL_ID');
        const applicationNeedsFiles = !hasNationalId;
        const nextStatus = statusFromApi(serverProfile.verificationStatus);
        const next: Stored = {
          ...current,
          status: nextStatus,
          isAvailable: serverProfile.availabilityStatus === 'ONLINE',
          profile: mapProfile(serverProfile, documents, current.profile),
          applicationError: applicationNeedsFiles
            ? 'Your application is missing your national ID document. Add your ID and retry.'
            : null,
          submissionFailed: applicationNeedsFiles,
        };
        void AsyncStorage.setItem(storageKey, serializeStored(next)).catch((error: unknown) => {
          console.error('Unable to persist the technician application.', error);
        });
        return next;
      });
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 404 || error.status === 403)) {
        setState((current) => {
          const next: Stored = {
            ...current,
            status: 'none',
            applicationError: current.submissionFailed ? current.applicationError : null,
          };
          void AsyncStorage.setItem(storageKey, serializeStored(next)).catch((storageError: unknown) => {
            console.error('Unable to persist technician application state.', storageError);
          });
          return next;
        });
        return;
      }
      const message = error instanceof Error ? error.message : 'Could not load your technician application.';
      setState((current) => ({ ...current, applicationError: message }));
      throw error;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) {
      setState(EMPTY);
      return;
    }
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!mounted) return;
        const parsed = parseStored(raw);
        // Nothing saved on this device yet: a technician account starts in working mode.
        if (!raw && accountRef.current?.role === 'TECHNICIAN') parsed.mode = 'working';
        setState(parsed);
        void refreshApplication().catch(() => undefined);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : 'Could not load saved technician application.';
        setState({ ...EMPTY, applicationError: message });
      });
    return () => {
      mounted = false;
    };
  }, [storageKey, refreshApplication]);

  const stateRef = useRef(state);
  stateRef.current = state;

  /** Set while a role switch is in flight, so the sync below never undoes it halfway. */
  const roleSyncing = useRef(false);

  const setMode = useCallback(
    async (mode: Mode) => {
      const role = mode === 'working' ? 'TECHNICIAN' : 'CUSTOMER';
      // Only an approved application can work; anyone else stays a customer and uses
      // working mode to apply or follow their application.
      const mustSwitch =
        account != null &&
        account.role !== role &&
        (role === 'CUSTOMER' || isWorkVerified(stateRef.current.status));
      roleSyncing.current = true;
      try {
        if (mustSwitch) {
          try {
            await updateRole(role);
          } catch (error) {
            // The API keeps the TECHNICIAN role while technician jobs are active. Hiring
            // works under either role, so the switch goes ahead and the role follows later.
            const keepsTechnicianRole =
              role === 'CUSTOMER' && error instanceof ApiRequestError && error.status === 409;
            if (!keepsTechnicianRole) throw error;
          }
        }
        update((current) => ({ ...current, mode }));
      } finally {
        roleSyncing.current = false;
      }
    },
    [account, updateRole, update],
  );

  // Someone already in working mode, following their application, starts working as
  // soon as it is approved. (A technician account may hire, so the reverse never applies.)
  useEffect(() => {
    if (!account || !isWorkVerified(state.status) || roleSyncing.current) return;
    if (account.role !== 'TECHNICIAN' && state.mode === 'working') {
      roleSyncing.current = true;
      updateRole('TECHNICIAN')
        .catch(() => update((current) => ({ ...current, mode: 'hiring' })))
        .finally(() => {
          roleSyncing.current = false;
        });
    }
  }, [account, state.status, state.mode, update, updateRole]);

  // Background status polling: polls refreshApplication every 4 seconds when application is pending review
  useEffect(() => {
    if (!account?.phone) return;
    if (!isWorkPending(state.status)) return;

    const intervalId = setInterval(() => {
      if (isWorkPending(stateRef.current.status)) {
        void refreshApplication().catch(() => undefined);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [account?.phone, state.status, refreshApplication]);

  // Re-read the application whenever the app returns to the foreground, whatever its
  // status: an admin can approve, reject or revoke at any time.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && stateRef.current.status !== 'none') {
        void refreshApplication().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [refreshApplication]);

  const value = useMemo<WorkContextValue>(() => {
    return {
      mode: state.mode,
      setMode,
      actingAsTechnician: state.mode === 'working' && isWorkVerified(state.status),
      isAvailable: state.isAvailable,
      setAvailable: async (isAvailable) => {
        try {
          const profile = await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/availability', {
            method: 'PATCH',
            authenticated: true,
            body: { availabilityStatus: isAvailable ? 'ONLINE' : 'OFFLINE' },
          });
          update((current) => ({
            ...current,
            isAvailable: profile.availabilityStatus === 'ONLINE',
            status: statusFromApi(profile.verificationStatus),
            profile: current.profile ? { ...current.profile, id: profile.id } : current.profile,
            applicationError: null,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not update your availability.';
          update((current) => ({ ...current, applicationError: message }));
          throw error;
        }
      },
      status: state.status,
      profile: state.profile,
      applicationError: state.applicationError,
      submissionFailed: state.submissionFailed,
      refreshApplication,
      apply: async (application) => {
        if (!account) throw new Error('Sign in and verify your phone before submitting a technician application.');
        try {
          await refreshTokens();
        } catch {
          throw new Error('Your sign-in session has expired. Sign in again, then submit your technician application.');
        }
        if (!(await getAccessToken())) {
          throw new Error('Your sign-in session has expired. Sign in again, then submit your technician application.');
        }
        const phone = account?.phone || application.phoneNumber;
        const targetStorageKey = phone ? workKey(phone) : storageKey;
        const localDraft: WorkProfile = {
          ...application,
          submittedAt: state.profile?.submittedAt ?? new Date().toISOString(),
        };
        // The screen keeps showing the form (with its progress) until every upload
        // has finished; only then does it switch to the review status in one step.
        let savedState: Stored = {
          ...state,
          profile: localDraft,
          applicationError: null,
          submissionFailed: false,
        };
        if (targetStorageKey) await AsyncStorage.setItem(targetStorageKey, serializeStored(savedState));
        uploadsInFlight.current += 1;

        try {
          const profilePictureMimeType = application.profilePictureUri && !/^https?:\/\//i.test(application.profilePictureUri)
            ? validateApplicationFile(
                'Your profile picture',
                application.profilePictureUri,
                application.profilePictureSizeBytes,
                application.profilePictureMimeType,
              )
            : undefined;
          const idPhotoMimeType = validateApplicationFile(
            'Your ID document',
            application.idPhotoUri,
            application.idPhotoSizeBytes,
            application.idPhotoMimeType,
            true,
          );
          const certificateMimeTypes = application.certificateUris.map((uri, index) =>
            validateApplicationFile(
              `Certificate ${index + 1}`,
              uri,
              application.certificateSizeBytes?.[index],
              application.certificateMimeTypes?.[index],
              true,
            ),
          );
          // A catalog trade is sent by id so jobs for that service reach the technician;
          // only a trade the technician named themselves goes as free text.
          const experiences = (application.serviceExperiences ?? [{
            categoryId: null,
            trade: application.trade,
            customName: application.trade,
            yearsOfExperience: application.yearsExperience,
          }]).map((experience) =>
            experience.categoryId
              ? { categoryId: experience.categoryId, yearsOfExperience: experience.yearsOfExperience }
              : {
                  customName: experience.trade === 'Others' ? experience.customName.trim() : experience.trade,
                  yearsOfExperience: experience.yearsOfExperience,
                },
          );
          const normalizedPayment = cleanAndNormalizePhone(application.paymentNumber || application.phoneNumber || '');
          const profileBody = {
            gender: application.gender || 'PREFER_NOT_TO_SAY',
            nationalIdNumber: application.nationalIdNumber,
            baseAddress: application.baseAddress || 'Kigali, Rwanda',
            publicLocationLabel: (application.baseAddress || 'Kigali').split(',')[0].trim(),
            baseLatitude: application.baseLatitude ?? -1.9441,
            baseLongitude: application.baseLongitude ?? 30.0619,
            paymentMethod: application.paymentMethod || 'MOMO',
            paymentNumber: normalizedPayment,
            serviceExperiences: experiences,
          };
          // A company owner applies with the company's details; an admin reviews both.
          const asCompany = application.businessType === 'COMPANY' && application.company;
          const registrationBody = {
            ...profileBody,
            businessType: asCompany ? 'COMPANY' : 'INDIVIDUAL',
            ...(asCompany ? { company: companyBody(application.company!) } : {}),
          };

          let serverProfile: ApiTechnicianProfile;
          try {
            // Create directly. A missing profile is normal for a new applicant,
            // so don't probe GET /profile and generate an expected 404 first.
            serverProfile = await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', {
              method: 'POST',
              authenticated: true,
              body: registrationBody,
            });
          } catch (error) {
            const status = error instanceof ApiRequestError
              ? error.status
              : error && typeof error === 'object' && 'status' in error
                ? Number((error as { status: unknown }).status)
                : undefined;
            // Public registration may already have created the profile. In
            // that case the API returns 409 and the application should update it.
            if (status !== 409) throw error;
            serverProfile = await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', {
              method: 'PUT',
              authenticated: true,
              body: profileBody,
            });
            // Editing an existing profile cannot register a company; update the one on file.
            if (asCompany) await updateMyCompany(application.company!).catch(() => undefined);
          }

          savedState = { ...savedState, profile: mapProfile(serverProfile, [], localDraft) };

          if (application.profilePictureUri && !serverProfile.profilePictureUrl) {
            const form = new FormData();
            if (!profilePictureMimeType) throw new Error('Choose a profile photo before uploading.');
            await appendLocalFile(form, application.profilePictureUri, 'profile-picture', profilePictureMimeType);
            serverProfile = await apiUpload<ApiTechnicianProfile>(
              '/api/v1/technicians/profile/picture',
              form,
              'PUT',
            );
          }

          const documents = await apiRequest<ApiTechnicianDocument[]>('/api/v1/technicians/profile/documents', {
            authenticated: true,
          });
          const findDocument = (type: ApiTechnicianDocument['type'], titles: string[]) =>
            documents.find((document) => document.type === type && titles.includes(document.title) && document.status !== 'DENIED') ??
            documents.find((document) => document.type === type && titles.includes(document.title));
          const isRemote = (uri: string) => /^https?:\/\//i.test(uri);

          const nationalId = findDocument('NATIONAL_ID', ['National ID card', 'National ID']);
          if (!nationalId || (nationalId.status === 'DENIED' && !isRemote(application.idPhotoUri))) {
            const form = new FormData();
            if (!nationalId) {
              form.append('type', 'NATIONAL_ID');
              form.append('title', 'National ID card');
            }
            await appendLocalFile(form, application.idPhotoUri, 'national-id', idPhotoMimeType);
            await apiUpload(
              nationalId ? `/api/v1/technicians/profile/documents/${nationalId.id}` : '/api/v1/technicians/profile/documents',
              form,
              nationalId ? 'PATCH' : 'POST',
            );
          }

          for (const [index, uri] of application.certificateUris.entries()) {
            const title = `Certificate ${index + 1}`;
            const existing = findDocument('CERTIFICATE', [title]);
            if (existing && (existing.status !== 'DENIED' || isRemote(uri))) continue;
            const experience = experiences[Math.min(index, experiences.length - 1)];
            const mimeType = certificateMimeTypes[index];
            if (!mimeType) throw new Error(`Choose Certificate ${index + 1} again before uploading.`);
            const form = new FormData();
            if (!existing) {
              form.append('type', 'CERTIFICATE');
              form.append('title', title);
              form.append('certificateType', 'TVET_CERTIFICATE');
              if (experience && 'categoryId' in experience && experience.categoryId) {
                form.append('categoryId', experience.categoryId);
              } else {
                form.append('customCategoryName', experience?.customName || 'General');
              }
            }
            await appendLocalFile(form, uri, `certificate-${index + 1}`, mimeType);
            await apiUpload(
              existing ? `/api/v1/technicians/profile/documents/${existing.id}` : '/api/v1/technicians/profile/documents',
              form,
              existing ? 'PATCH' : 'POST',
            );
          }

          const [updatedProfile, updatedDocuments] = await Promise.all([
            apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', { authenticated: true }),
            apiRequest<ApiTechnicianDocument[]>('/api/v1/technicians/profile/documents', { authenticated: true }),
          ]);
          savedState = {
            ...savedState,
            mode: 'working',
            status: statusFromApi(updatedProfile.verificationStatus),
            isAvailable: updatedProfile.availabilityStatus === 'ONLINE',
            profile: mapProfile(updatedProfile, updatedDocuments, localDraft),
            applicationError: null,
            submissionFailed: false,
          };
          setState(savedState);
          if (storageKey) await AsyncStorage.setItem(storageKey, serializeStored(savedState));
        } catch (error) {
          const failedState: Stored = {
            ...savedState,
            profile: savedState.profile ?? localDraft,
            applicationError: error instanceof Error ? error.message : 'Technician application submission failed.',
            submissionFailed: true,
          };
          setState(failedState);
          if (storageKey) await AsyncStorage.setItem(storageKey, serializeStored(failedState));
          throw error;
        } finally {
          uploadsInFlight.current -= 1;
        }
      },
      resubmitDocument: async (documentId, file) => {
        const current = state.profile?.documents?.find((document) => document.id === documentId);
        if (!current) throw new Error('This document is no longer on your application. Pull to refresh.');
        if (current.status !== 'DENIED') throw new Error('Only documents that need changes can be replaced.');
        const label = current.type === 'NATIONAL_ID' ? 'Your ID document' : current.title;
        const mimeType = validateApplicationFile(label, file.uri, file.size, file.mimeType, true);
        const form = new FormData();
        await appendLocalFile(form, file.uri, current.type === 'NATIONAL_ID' ? 'national-id' : 'certificate', mimeType);

        uploadsInFlight.current += 1;
        try {
          const updated = await apiUpload<ApiTechnicianDocument>(
            `/api/v1/technicians/profile/documents/${documentId}`,
            form,
            'PATCH',
          );
          // Show the new status straight away; the application status follows from the server.
          update((prev) => {
            if (!prev.profile) return prev;
            const documents = (prev.profile.documents ?? []).map((document) =>
              document.id === documentId ? { ...document, ...updated } : document,
            );
            const stillDenied = documents.some((document) => document.status === 'DENIED');
            return {
              ...prev,
              status: isWorkRejected(prev.status) && !stillDenied ? 'PENDING_REVIEW' : prev.status,
              profile: { ...prev.profile, documents },
              applicationError: null,
            };
          });
        } finally {
          uploadsInFlight.current -= 1;
        }
        await refreshApplication().catch(() => undefined);
      },
      // Only requests still waiting for this technician's answer: one per job, none already taken.
      offers: technicianOffers
        .filter(
          (offer, index, all) =>
            offer.status === 'OFFERED' &&
            (!offer.expiresAt || new Date(offer.expiresAt).getTime() > Date.now()) &&
            !techJobs.some((j) => j.id === offer.job.id) &&
            all.findIndex((o) => o.job.id === offer.job.id && o.status === 'OFFERED') === index,
        )
        .map(mapOfferToJob),
      technicianOffers,
      mine: techJobs.filter((j) => !isClosed(j.status) && !isTerminated(j.status)),
      done: techJobs.filter((j) => j.status === 'COMPLETED' || j.status === 'REPAIR_COMPLETED'),
      cancelled: techJobs.filter((j) => isTerminated(j.status)),
      earnings: techJobs
        .filter((j) => j.status === 'COMPLETED' || j.status === 'REPAIR_COMPLETED')
        .reduce((sum, j) => sum + (j.agreedPrice || ((j.bookingFee?.amount ?? getServiceBookingFee(j.service)) * (1 - COMMISSION_RATE))), 0),
      refreshJobs,
      acceptOffer,
      rejectOffer,
      confirmCooperation,
      addOrUpdateJob,
      startJob,
      cancelJob,
      completeJob,
      createDraftRequest: fundi ? fundi.createDraftRequest : localCreateDraftRequest,
      markBookingFeePaid: fundi ? fundi.markBookingFeePaid : localMarkBookingFeePaid,
      initializeChatId: fundi ? fundi.initializeChatId : localInitializeChatId,
    };
  }, [
    account,
    acceptOffer,
    addOrUpdateJob,
    cancelJob,
    completeJob,
    confirmCooperation,
    fundi,
    localCreateDraftRequest,
    localInitializeChatId,
    localMarkBookingFeePaid,
    refreshApplication,
    refreshJobs,
    rejectOffer,
    startJob,
    state,
    storageKey,
    techJobs,
    technicianOffers,
    update,
  ]);

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWork() {
  const context = useContext(WorkContext);
  if (!context) throw new Error('useWork must be used inside WorkProvider');
  return context;
}
