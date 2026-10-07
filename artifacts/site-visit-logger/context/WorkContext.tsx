import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { workKey } from '@/constants/storage';
import {
  type TechnicianApplication,
  type WorkProfile,
  type WorkStatus,
} from '@/constants/work';
import type { Job } from '@/constants/jobs';
import { useAuth } from '@/context/AuthContext';
import { ApiRequestError, apiRequest, apiUpload } from '@/lib/api';

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
    customName: string | null;
    category: { name: string } | null;
    yearsOfExperience: number;
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
  const experiences = profile.serviceExperiences.map((service) => ({
    trade: service.category?.name ?? service.customName ?? 'General Maintenance',
    customName: service.customName ?? '',
    yearsOfExperience: service.yearsOfExperience,
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
    trade: (experiences[0]?.trade ?? 'General Maintenance') as WorkProfile['trade'],
    yearsExperience: profile.yearsOfExperience,
    serviceExperiences: experiences,
    documents,
    idPhotoUri: local?.idPhotoUri ?? '',
    certificateUris: local?.certificateUris ?? [],
    submittedAt: profile.createdAt,
  };
}

function fileMimeType(uri: string): string {
  const path = uri.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (path.endsWith('.pdf')) return 'application/pdf';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function appendLocalFile(form: FormData, uri: string, fileName: string): Promise<void> {
  const mimeType = fileMimeType(uri);
  const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fullName = `${fileName}.${extension}`;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read the selected document.');
    form.append('file', await response.blob(), fullName);
    return;
  }
  form.append('file', {
    uri,
    name: fullName,
    type: mimeType,
  } as unknown as Blob);
}

type WorkContextValue = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isAvailable: boolean;
  setAvailable: (available: boolean) => Promise<void>;
  status: WorkStatus;
  profile: WorkProfile | null;
  applicationError: string | null;
  refreshApplication: () => Promise<void>;
  apply: (profile: TechnicianApplication) => Promise<void>;
  offers: Job[];
  mine: Job[];
  done: Job[];
  earnings: number;
};

const WorkContext = createContext<WorkContextValue | null>(null);

/** Technician profile and verification state are server-owned; local storage keeps only the draft. */
export function WorkProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [state, setState] = useState<Stored>(EMPTY);
  const storageKey = account ? workKey(account.phone) : null;

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
        const applicationNeedsFiles = !serverProfile.profilePictureUrl || !hasNationalId || !hasCertificate;
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
    if (account?.role !== 'TECHNICIAN') {
      setState((current) => ({
        ...current,
        isAvailable: false,
        status: 'none',
        profile: null,
        applicationError: null,
      }));
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
            await appendLocalFile(form, application.profilePictureUri, 'profile-picture');
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
            await appendLocalFile(form, application.idPhotoUri, 'national-id');
            await apiUpload('/api/v1/technicians/profile/documents', form);
          }

          for (const [index, uri] of application.certificateUris.entries()) {
            const title = `Certificate ${index + 1}`;
            if (documentExists('CERTIFICATE', title)) continue;
            await removeDeniedDocument('CERTIFICATE', title);
            const experience = experiences[Math.min(index, experiences.length - 1)];
            const form = new FormData();
            form.append('type', 'CERTIFICATE');
            form.append('title', title);
            form.append('certificateType', 'TVET_CERTIFICATE');
            form.append('customCategoryName', experience.customName);
            await appendLocalFile(form, uri, `certificate-${index + 1}`);
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
    };
  }, [account, refreshApplication, state, storageKey, update]);

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWork() {
  const context = useContext(WorkContext);
  if (!context) throw new Error('useWork must be used inside WorkProvider');
  return context;
}
