import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { workKey } from '@/constants/storage';
import {
  type TechnicianApplication,
  type WorkProfile,
  type WorkStatus,
} from '@/constants/work';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
import {
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
  user: { fullName: string; phoneNumber: string; email: string | null };
  gender: WorkProfile['gender'];
  yearsOfExperience: number;
  serviceExperiences: Array<{
    id?: string;
    customName: string | null;
    category: { name: string } | null;
    yearsOfExperience: number;
    status?: 'PENDING' | 'APPROVED' | 'DENIED' | 'SUSPENDED';
    reviewNote?: string | null;
  }>;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  availabilityStatus: 'ONLINE' | 'OFFLINE';
  location: { address: string; latitude: number; longitude: number };
  profilePictureUrl: string | null;
  nationalIdNumber: string | null;
  paymentMethod: WorkProfile['paymentMethod'] | null;
  paymentNumber: string | null;
  createdAt: string;
};

type ApiTechnicianDocument = NonNullable<WorkProfile['documents']>[number];

function statusFromApi(status: ApiTechnicianProfile['verificationStatus']): WorkStatus {
  if (status === 'APPROVED') return 'verified';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
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
    trade: service.category?.name ?? service.customName ?? 'General Maintenance',
    customName: service.customName ?? '',
    yearsOfExperience: service.yearsOfExperience,
    status: service.status ?? 'PENDING',
    reviewNote: service.reviewNote ?? null,
  }));

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

type WorkContextValue = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isAvailable: boolean;
  setAvailable: (available: boolean) => Promise<void>;
  status: WorkStatus;
  profile: WorkProfile | null;
  applicationError: string | null;
  submissionFailed: boolean;
  refreshApplication: () => Promise<void>;
  apply: (profile: TechnicianApplication) => Promise<void>;
  offers: Job[];
  mine: Job[];
  done: Job[];
  earnings: number;
  createDraftRequest: (data: Partial<ServiceRequest>) => string;
  markBookingFeePaid: (requestId: string, transactionId: string) => void;
  initializeChatId?: (requestId: string, chatId?: string) => string;
};

const WorkContext = createContext<WorkContextValue | null>(null);

/** Technician profile and verification state are server-owned; local storage keeps only the draft. */
export function WorkProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const fundi = useContext(FundiContext);
  const [state, setState] = useState<Stored>(EMPTY);
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
    const feeAmount = data.bookingFee?.amount ?? (data.visitFee ?? (urgency === 'Emergency' ? 110 : 75));
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
    localDraftsRef.current = [draft, ...localDraftsRef.current];
    setLocalDrafts(localDraftsRef.current);
    return id;
  }, []);

  const localMarkBookingFeePaid = useCallback((requestId: string, transactionId: string) => {
    const job = localDraftsRef.current.find((j) => j.id === requestId);
    if (!job) return;
    const now = new Date().toISOString();
    const nextStatus = job.status === 'PAYMENT_PENDING' ? (job.type === 'SOS' ? 'DISPATCHED' : 'VISIT_PAID') : job.status;
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

  const refreshApplication = useCallback(async () => {
    if (!storageKey) return;
    try {
      const serverProfile = await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', {
        authenticated: true,
      });
      const documents = await apiRequest<ApiTechnicianDocument[]>('/api/v1/technicians/profile/documents', {
        authenticated: true,
      });
      setState((current) => {
        const hasNationalId = documents.some((document) => document.type === 'NATIONAL_ID' && document.status !== 'DENIED');
        const hasCertificate = documents.some((document) => document.type === 'CERTIFICATE' && document.status !== 'DENIED');

        // Safely check for either the URL or the raw Object Key in case the backend hasn't been updated yet
        const hasProfilePic = !!(serverProfile.profilePictureUrl || (serverProfile as any).profilePictureObjectKey);

        const applicationNeedsFiles = !hasProfilePic || !hasNationalId || !hasCertificate;
        const next: Stored = {
          ...current,
          status: statusFromApi(serverProfile.verificationStatus),
          isAvailable: serverProfile.availabilityStatus === 'ONLINE',
          profile: mapProfile(serverProfile, documents, current.profile),
          applicationError: applicationNeedsFiles
            ? 'Your application is missing a profile picture, national ID, or certificate. Add the missing items and retry.'
            : null,
          submissionFailed: applicationNeedsFiles,
        };
        void AsyncStorage.setItem(storageKey, serializeStored(next)).catch((error: unknown) => {
          console.error('Unable to persist the technician application.', error);
        });
        return next;
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) {
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
        setState(parseStored(raw));
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
  }, [account?.role, storageKey, refreshApplication]);

  const value = useMemo<WorkContextValue>(() => {
    return {
      mode: state.mode,
      setMode: (mode) => update((current) => ({ ...current, mode })),
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
        if (!account) throw new Error('Sign in before submitting a technician application.');
        const localDraft: WorkProfile = {
          ...application,
          submittedAt: state.profile?.submittedAt ?? new Date().toISOString(),
        };
        let savedState: Stored = { ...state, profile: localDraft, applicationError: null, submissionFailed: false };
        setState(savedState);
        if (storageKey) await AsyncStorage.setItem(storageKey, serializeStored(savedState));

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
          const experiences = (application.serviceExperiences ?? [{
            trade: application.trade,
            customName: application.trade,
            yearsOfExperience: application.yearsExperience,
          }]).map((experience) => ({
            customName: experience.trade === 'Others' ? experience.customName.trim() : experience.trade,
            yearsOfExperience: experience.yearsOfExperience,
          }));
          const body = {
            fullName: application.fullName,
            phoneNumber: application.phoneNumber,
            ...(application.email ? { email: application.email } : {}),
            gender: application.gender,
            nationalIdNumber: application.nationalIdNumber,
            baseAddress: application.baseAddress,
            baseLatitude: application.baseLatitude,
            baseLongitude: application.baseLongitude,
            paymentMethod: application.paymentMethod,
            paymentNumber: application.paymentNumber,
            serviceExperiences: experiences,
          };

          let serverProfile: ApiTechnicianProfile;
          try {
            await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', { authenticated: true });
            serverProfile = await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', {
              method: 'PUT',
              authenticated: true,
              body,
            });
          } catch (error) {
            if (!(error instanceof ApiRequestError) || error.status !== 404) throw error;
            serverProfile = await apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', {
              method: 'POST',
              authenticated: true,
              body,
            });
          }

          savedState = {
            ...savedState,
            status: state.status,
            profile: mapProfile(serverProfile, [], localDraft),
          };
          setState(savedState);
          if (storageKey) await AsyncStorage.setItem(storageKey, serializeStored(savedState));

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
          const documentExists = (type: ApiTechnicianDocument['type'], title: string) =>
            documents.some((document) => document.type === type && document.title === title && document.status !== 'DENIED');
          const removeDeniedDocument = async (type: ApiTechnicianDocument['type'], title: string) => {
            const denied = documents.find((document) => document.type === type && document.title === title && document.status === 'DENIED');
            if (denied) {
              await apiRequest(`/api/v1/technicians/profile/documents/${denied.id}`, {
                method: 'DELETE',
                authenticated: true,
              });
            }
          };

          if (!documentExists('NATIONAL_ID', 'National ID')) {
            await removeDeniedDocument('NATIONAL_ID', 'National ID');
            const form = new FormData();
            form.append('type', 'NATIONAL_ID');
            form.append('title', 'National ID');
            await appendLocalFile(form, application.idPhotoUri, 'national-id', idPhotoMimeType);
            await apiUpload('/api/v1/technicians/profile/documents', form);
          }

          for (const [index, uri] of application.certificateUris.entries()) {
            const title = `Certificate ${index + 1}`;
            if (documentExists('CERTIFICATE', title)) continue;
            await removeDeniedDocument('CERTIFICATE', title);
            const experience = experiences[Math.min(index, experiences.length - 1)];
            const mimeType = certificateMimeTypes[index];
            if (!mimeType) throw new Error(`Choose Certificate ${index + 1} again before uploading.`);
            const form = new FormData();
            form.append('type', 'CERTIFICATE');
            form.append('title', title);
            form.append('certificateType', 'TVET_CERTIFICATE');
            form.append('customCategoryName', experience?.customName || 'General');
            await appendLocalFile(form, uri, `certificate-${index + 1}`, mimeType);
            await apiUpload('/api/v1/technicians/profile/documents', form);
          }

          const [updatedProfile, updatedDocuments] = await Promise.all([
            apiRequest<ApiTechnicianProfile>('/api/v1/technicians/profile', { authenticated: true }),
            apiRequest<ApiTechnicianDocument[]>('/api/v1/technicians/profile/documents', { authenticated: true }),
          ]);
          savedState = {
            ...savedState,
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
        }
      },
      offers: [],
      mine: [],
      done: [],
      earnings: 0,
      createDraftRequest: fundi ? fundi.createDraftRequest : localCreateDraftRequest,
      markBookingFeePaid: fundi ? fundi.markBookingFeePaid : localMarkBookingFeePaid,
      initializeChatId: fundi ? fundi.initializeChatId : localInitializeChatId,
    };
  }, [account, fundi, localCreateDraftRequest, localInitializeChatId, localMarkBookingFeePaid, refreshApplication, state, storageKey, update]);

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWork() {
  const context = useContext(WorkContext);
  if (!context) throw new Error('useWork must be used inside WorkProvider');
  return context;
}