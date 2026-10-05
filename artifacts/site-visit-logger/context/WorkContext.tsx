import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { workKey } from '@/constants/storage';
import {
  DEFAULT_SETTINGS,
  PRE_VERIFIED,
  REVIEW_MS,
  technicianFromAccount,
  type WorkProfile,
  type WorkSettings,
  type WorkStatus,
} from '@/constants/work';
import { COMMISSION_RATE, isClosed, type Job, type Technician } from '@/constants/jobs';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';

/** Which side of the marketplace the app is showing. */
export type Mode = 'hiring' | 'working';

type Handled = Record<string, 'accepted' | 'declined'>;

type Stored = {
  mode: Mode;
  isAvailable: boolean;
  handled: Handled;
  status: WorkStatus;
  profile: WorkProfile | null;
  settings: WorkSettings;
};

const EMPTY: Stored = {
  mode: 'hiring',
  isAvailable: true,
  handled: {},
  status: 'none',
  profile: null,
  settings: DEFAULT_SETTINGS,
};

function parseStored(raw: string | null): Stored {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return { ...EMPTY, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch {
    return EMPTY;
  }
}

/**
 * Lifts a pre-verified number straight to verified on load, standing in for the
 * review it never had to sit through. Anyone who genuinely applied keeps the
 * documents they submitted.
 */
function withSeed(stored: Stored, phone: string | null): Stored {
  const seed = phone ? PRE_VERIFIED[phone] : undefined;
  if (!seed || stored.status === 'verified') return stored;
  return {
    ...stored,
    status: 'verified',
    // A verified trade is the one job type they can actually be sent.
    settings: stored.settings.trades.length
      ? stored.settings
      : { ...stored.settings, trades: [seed.trade] },
    profile: stored.profile ?? {
      trade: seed.trade,
      yearsExperience: seed.yearsExperience,
      idPhotoUri: '',
      certificateUris: [],
      submittedAt: new Date().toISOString(),
    },
  };
}

type WorkContextValue = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isAvailable: boolean;
  setAvailable: (available: boolean) => void;
  /** Whether this account may take work, and the papers it claimed. */
  status: WorkStatus;
  profile: WorkProfile | null;
  apply: (profile: Omit<WorkProfile, 'submittedAt'>) => Promise<void>;
  settings: WorkSettings;
  updateSettings: (patch: Partial<WorkSettings>) => void;
  /** Jobs looking for a technician that this worker has not answered yet. */
  offers: Job[];
  /** Jobs they took and are still working. */
  mine: Job[];
  /** Jobs they took that have closed. */
  done: Job[];
  accept: (id: string) => void;
  decline: (id: string) => void;
  /** This worker as the customer's screens render them. */
  me: Technician;
  /** Their share of the visit fees on jobs they took. */
  earnings: number;
};

const WorkContext = createContext<WorkContextValue | null>(null);

/** Work state is per account, so a different number on the device starts clean. */
export function WorkProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const { jobs, takeJob } = useFundi();
  const [state, setState] = useState<Stored>(EMPTY);
  const phone = account?.phone ?? null;
  const storageKey = account ? workKey(account.phone) : null;

  useEffect(() => {
    if (!storageKey) {
      setState(EMPTY);
      return;
    }
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (mounted) setState(withSeed(parseStored(raw), phone));
      })
      .catch(() => {
        if (mounted) setState(withSeed(EMPTY, phone));
      });
    return () => {
      mounted = false;
    };
  }, [storageKey, phone]);

  useEffect(() => {
    if (state.status !== 'pending' || !state.profile) return;
    const elapsed = Date.now() - new Date(state.profile.submittedAt).getTime();
    const remaining = Math.max(0, REVIEW_MS - elapsed);
    const timer = setTimeout(() => {
      setState((current) => {
        if (current.status !== 'pending') return current;
        const next: Stored = { ...current, status: 'verified' };
        if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.status, state.profile, storageKey]);

  const update = useCallback(
    (next: (current: Stored) => Stored) => {
      setState((current) => {
        const value = next(current);
        if (storageKey) AsyncStorage.setItem(storageKey, JSON.stringify(value)).catch(() => undefined);
        return value;
      });
    },
    [storageKey],
  );

  const value = useMemo<WorkContextValue>(() => {
    // Jobs on this device are the real feed: anything still looking for someone
    // and not already turned down is an offer this worker can answer.
    const taken = jobs.filter((job) => job.takenByTechnician);
    const offers = jobs.filter(
      (job) => !job.takenByTechnician && (job.status === 'MATCHING' || job.status === 'OFFERED') && !state.handled[job.id],
    );
    const mine = taken.filter((job) => !isClosed(job.status));
    const done = taken.filter((job) => isClosed(job.status));
    const me = technicianFromAccount(
      account?.name ?? '',
      account?.phone ?? '',
      state.profile,
      state.settings.radiusKm,
      done.length,
    );

    return {
      mode: state.mode,
      setMode: (mode) => update((current) => ({ ...current, mode })),
      isAvailable: state.isAvailable,
      setAvailable: (isAvailable) => update((current) => ({ ...current, isAvailable })),
      status: state.status,
      profile: state.profile,
      // Apply now attempts a backend registration and also persists the profile locally.
      apply: async (profile) => {
        // Persist locally immediately so the UI reflects a pending submission.
        update((current) => ({
          ...current,
          status: 'pending',
          profile: { ...profile, submittedAt: new Date().toISOString() },
          settings: { ...current.settings, trades: [profile.trade] },
        }));

        try {
          // If an API URL is configured and the user is authenticated, try to register the profile.
          const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
          if (!baseUrl) return;

          // Convert id photo to base64 if it looks like a local URI.
          // The server accepts a profilePictureBase64 field for profile images.
          // Certificates are not yet supported server-side and are kept locally for review.
          const { idPhotoUri, yearsExperience } = profile as any;
          if (!idPhotoUri) return;

          // Dynamically import FileSystem to avoid requiring it in non-native targets.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const FileSystem = require('expo-file-system');
          let base64 = null;
          try {
            if (idPhotoUri && idPhotoUri.startsWith('data:')) {
              // Already a data URL; extract base64 part.
              const match = idPhotoUri.match(/base64,(.*)$/);
              base64 = match ? match[1] : null;
            } else {
              base64 = await FileSystem.readAsStringAsync(idPhotoUri, { encoding: FileSystem.EncodingType.Base64 });
            }
          } catch (err) {
            // Reading failed - don't block local persistence.
            base64 = null;
          }

          if (!base64) return;

          const token = await (await import('@/lib/auth-session')).getAccessToken();
          const headers: Record<string, string> = { 'content-type': 'application/json' };
          if (token) headers.authorization = `Bearer ${token}`;

          await fetch(`${baseUrl}/api/v1/technicians/profile`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ yearsOfExperience: yearsExperience, profilePictureBase64: base64, profilePictureMimeType: 'image/jpeg' }),
          });
        } catch (err) {
          // Swallow network errors - the local pending state remains and can be retried later.
          // Optionally diagnostics could be emitted here.
          // eslint-disable-next-line no-console
          console.warn('Technician profile registration failed', err);
        }
      },
      settings: state.settings,
      updateSettings: (patch) => update((current) => ({ ...current, settings: { ...current.settings, ...patch } })),
      offers,
      mine,
      done,
      accept: (id) => takeJob(id, me),
      // Declining only hides it from this worker; the job keeps looking.
      decline: (id) => update((current) => ({ ...current, handled: { ...current.handled, [id]: 'declined' } })),
      me,
      earnings: taken.reduce((sum, job) => sum + job.visitFee * (1 - COMMISSION_RATE), 0),
    };
  }, [account, jobs, state, takeJob, update]);

  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

export function useWork() {
  const context = useContext(WorkContext);
  if (!context) throw new Error('useWork must be used inside WorkProvider');
  return context;
}
