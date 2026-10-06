import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AUTO_ADVANCE_MS,
  AUTO_NEXT,
  buildAdditionalWork,
  buildQuote,
  matchTechnician,
  TECHNICIAN_DRIVEN,
} from '@/constants/simulation';
import { jobsKey, LEGACY_JOBS_KEY } from '@/constants/storage';
import { useAuth } from '@/context/AuthContext';
import {
  isClosed,
  visitFeeFor,
  type Job,
  type JobEvent,
  type JobStatus,
  type PaymentMethod,
  type Quote,
  type Rating,
  type SettlementMethod,
  type Technician,
} from '@/constants/jobs';

export type { Job, JobStatus } from '@/constants/jobs';

type NewRequest = Pick<Job, 'service' | 'problem' | 'urgency' | 'locationLabel' | 'photoUri' | 'videoUri' | 'scheduledFor'>;

type FundiContextValue = {
  jobs: Job[];
  isHydrated: boolean;
  getJob: (id: string) => Job | undefined;
  /** Every status change in reverse-chronological order, newest first. */
  events: (JobEvent & { jobId: string; service: string })[];
  addRequest: (request: NewRequest) => Promise<string>;
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
  cancelJob: (id: string) => void;
  /** A technician on this device takes the job and becomes the one on it. */
  takeJob: (id: string, technician: Technician) => void;
  markArrived: (id: string) => void;
  submitDiagnosis: (id: string, quote: Quote) => void;
  completeRepair: (id: string) => void;
};

const FundiContext = createContext<FundiContextValue | undefined>(undefined);

/** Customer-facing copy for the notification feed, one entry per status change. */
const EVENT_COPY: Partial<Record<JobStatus, { title: string; text: string }>> = {
  REQUESTED: { title: 'Request sent', text: 'We are looking for qualified technicians near you.' },
  MATCHING: { title: 'Finding your technician', text: 'Checking who is available and close to you right now.' },
  OFFERED: { title: 'Technician found', text: 'A qualified technician is available for your job.' },
  ACCEPTED: { title: 'Technician accepted your request', text: 'Pay the visit fee to confirm the callout.' },
  VISIT_PAID: { title: 'Payment successful', text: 'Your visit fee has been received.' },
  EN_ROUTE: { title: 'Your technician is on the way', text: 'Follow the arrival time on the tracking screen.' },
  ARRIVED: { title: 'Your technician has arrived', text: 'Diagnosis will begin shortly.' },
  DIAGNOSING: { title: 'Diagnosis in progress', text: 'Your technician is inspecting the problem.' },
  DIAGNOSIS_COMPLETE: { title: 'Diagnosis completed', text: 'A repair quote is being prepared for you.' },
  QUOTE_PENDING: { title: 'Quote received', text: 'Review the repair quote and approve it to continue.' },
  QUOTE_APPROVED: { title: 'Repair approved', text: 'Your technician is starting the repair.' },
  REPAIR_IN_PROGRESS: { title: 'Repair in progress', text: 'We will let you know as soon as the work is done.' },
  ADDITIONAL_APPROVAL_REQUIRED: { title: 'Extra work needs your approval', text: 'Nothing is charged until you approve it.' },
  REPAIR_COMPLETED: { title: 'Repair completed', text: 'Review the summary and settle the balance.' },
  PAYMENT_PENDING: { title: 'Payment pending', text: 'Tell us how the repair was paid.' },
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
  const now = new Date().toISOString();
  const moved: Job = { ...job, status: next, statusSince: now };

  if (next === 'OFFERED' && !moved.technician) {
    moved.technician = matchTechnician(job.service);
  }
  if (next === 'DIAGNOSIS_COMPLETE' && !moved.quote) {
    moved.quote = buildQuote(job.service);
  }
  if (next === 'ADDITIONAL_APPROVAL_REQUIRED' && !moved.additionalWork) {
    moved.additionalWork = buildAdditionalWork(job.service);
  }
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
    const parsed = JSON.parse(stored) as Job[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function FundiProvider({ children }: { children: ReactNode }) {
  const { account, isHydrated: sessionReady } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Job history belongs to the phone number that created it.
  const storageKey = account ? jobsKey(account.phone) : null;
  const isHydrated = sessionReady && (storageKey === null || loadedKey === storageKey);

  useEffect(() => {
    if (!storageKey) {
      setJobs([]);
      setLoadedKey(null);
      return;
    }
    let mounted = true;
    setLoadedKey(null);
    loadJobs(storageKey)
      .then((stored) => {
        if (!mounted) return;
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

  const update = useCallback((id: string, change: (job: Job) => Job) => {
    setJobs((current) => current.map((job) => (job.id === id ? change(job) : job)));
  }, []);

  const advance = useCallback(
    (id: string, next: JobStatus) => {
      update(id, (job) => transition(job, next));
    },
    [update],
  );

  /**
   * Drives the stages that do not wait for the customer. Each pending job gets
   * one timer keyed by `id:status`; re-running this effect reuses live timers
   * rather than restarting them, and a deadline already in the past fires at
   * once so a job resumed from storage catches up.
   */
  useEffect(() => {
    if (!isHydrated) return;
    const live = timers.current;
    const wanted = new Set<string>();

    for (const job of jobs) {
      const next = AUTO_NEXT[job.status];
      const duration = AUTO_ADVANCE_MS[job.status];
      if (!next || duration === undefined) continue;
      // A technician owns these stages once they have taken the job.
      if (job.takenByTechnician && TECHNICIAN_DRIVEN.includes(job.status)) continue;

      const key = `${job.id}:${job.status}`;
      wanted.add(key);
      if (live.has(key)) continue;

      const elapsed = Date.now() - new Date(job.statusSince).getTime();
      const remaining = Math.max(duration - elapsed, 0);
      const timer = setTimeout(() => {
        live.delete(key);
        // The repair stage forks: offer the extra work once, then finish.
        if (job.status === 'REPAIR_IN_PROGRESS') {
          setJobs((current) =>
            current.map((candidate) => {
              if (candidate.id !== job.id || candidate.status !== 'REPAIR_IN_PROGRESS') return candidate;
              const decided = candidate.additionalWork !== undefined;
              return transition(candidate, decided ? 'REPAIR_COMPLETED' : 'ADDITIONAL_APPROVAL_REQUIRED');
            }),
          );
          return;
        }
        setJobs((current) =>
          current.map((candidate) =>
            candidate.id === job.id && candidate.status === job.status ? transition(candidate, next) : candidate,
          ),
        );
      }, remaining);
      live.set(key, timer);
    }

    // Drop timers for jobs that moved on or disappeared.
    for (const [key, timer] of live) {
      if (!wanted.has(key)) {
        clearTimeout(timer);
        live.delete(key);
      }
    }
  }, [isHydrated, jobs]);

  useEffect(() => {
    const live = timers.current;
    return () => {
      for (const timer of live.values()) clearTimeout(timer);
      live.clear();
    };
  }, []);

  const takeJob = useCallback(
    (id: string, technician: Technician) => {
      update(id, (job) =>
        // Only a job still looking for someone can be taken.
        job.status === 'MATCHING' || job.status === 'OFFERED'
          ? transition({ ...job, technician, takenByTechnician: true }, 'OFFERED')
          : job,
      );
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
    const now = new Date().toISOString();
    const id = makeId('job');
    const base: Job = {
      ...request,
      id,
      reference: makeReference(),
      status: 'REQUESTED',
      statusSince: now,
      createdAt: now,
      visitFee: visitFeeFor(request.urgency),
      events: [],
    };
    const copy = EVENT_COPY.REQUESTED!;
    base.events = [{ id: makeId('evt'), status: 'REQUESTED', title: copy.title, text: copy.text, at: now }];
    setJobs((current) => [base, ...current]);
    return id;
  }, []);

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
      acceptOffer: (id) => advance(id, 'ACCEPTED'),
      payVisitFee: (id, method) =>
        update(id, (job) => transition({ ...job, visitPaymentMethod: method }, 'VISIT_PAID')),
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
      cancelJob: (id) => advance(id, 'CANCELLED'),
      takeJob,
      markArrived,
      submitDiagnosis,
      completeRepair,
    };
  }, [addRequest, advance, completeRepair, isHydrated, jobs, markArrived, submitDiagnosis, takeJob, update]);

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
