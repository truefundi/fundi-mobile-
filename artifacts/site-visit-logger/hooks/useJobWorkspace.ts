import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import {
  cancelJobFromRoom,
  confirmRoomCooperation,
  denyRoomPartnership,
  updateRoomWorkStatus,
  type WorkStatusValue,
} from '@/lib/chat-rooms-api';
import {
  acceptJobRequestInConversation,
  acceptPriceOffer,
  declineJobRequestInConversation,
  declinePriceOffer,
  getConversation,
  listConversations,
  openJobConversation,
  sendPriceOffer,
  type BackendConversation,
} from '@/lib/conversations-api';
import { cancelCustomerJob, fetchCustomerJob, fetchTechnicianJob, type BackendJob } from '@/lib/jobs-api';

/** How often the job and negotiation are refreshed while the screen is open. */
const POLL_MS = 8_000;

/**
 * Loads and drives everything about a job besides chat messages: the job
 * record (status, cooperation, progress, media) and its price negotiation
 * (`/conversations`). Negotiation has no realtime channel, so it is polled
 * while the screen is open; callers can also `refresh()` on chat job events.
 *
 * All mutations go to the backend and the returned state replaces local
 * state; errors are thrown to the caller for display.
 */
export function useJobWorkspace(params: {
  jobId?: string;
  conversationId?: string;
  roomId?: string;
  /** Pause polling once the job is closed. */
  active: boolean;
  /** Which side of this job the viewer is on; defaults to the account's role. */
  asTechnician?: boolean;
}) {
  const { jobId, conversationId, roomId, active } = params;
  const { account } = useAuth();
  const { refreshConversations } = useChat();
  const isTechnician = params.asTechnician ?? account?.role === 'TECHNICIAN';

  const [job, setJob] = useState<BackendJob | null>(null);
  const [conversation, setConversation] = useState<BackendConversation | null>(null);
  /** Key of the last job/negotiation that finished loading; loading is derived from it. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = `${jobId ?? ''}|${conversationId ?? ''}`;
  const isLoading = loadedKey !== currentKey;
  const conversationRef = useRef<BackendConversation | null>(null);
  conversationRef.current = conversation;
  const jobRef = useRef<BackendJob | null>(null);
  jobRef.current = job;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mounted = useRef(true);
  const openAttempted = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadJob = useCallback(async () => {
    if (!jobId) return null;
    const fresh = isTechnician ? await fetchTechnicianJob(jobId) : await fetchCustomerJob(jobId);
    if (mounted.current) setJob(fresh);
    return fresh;
  }, [jobId, isTechnician]);

  const loadConversation = useCallback(
    async (assigned: boolean) => {
      let found: BackendConversation | null = null;
      // Once known, poll the negotiation directly instead of listing all of them.
      const knownId = conversationRef.current?.jobId === jobId ? conversationRef.current?.id : conversationId;
      if (knownId) {
        found = await getConversation(knownId).catch(() => null);
      }
      if (!found && jobId) {
        const all = await listConversations();
        found = all.find((c) => c.jobId === jobId) ?? null;
      }
      // Clients open the negotiation once a technician is assigned (idempotent on the backend).
      if (!found && jobId && !isTechnician && assigned && openAttempted.current !== jobId) {
        openAttempted.current = jobId;
        found = await openJobConversation(jobId).catch(() => null);
      }
      if (mounted.current) setConversation(found);
      return found;
    },
    [conversationId, jobId, isTechnician],
  );

  const refresh = useCallback(async () => {
    const key = `${jobId ?? ''}|${conversationId ?? ''}`;
    if (!jobId && !conversationId) {
      setLoadedKey(key);
      return;
    }
    try {
      const fresh = await loadJob().catch((error) => {
        // A technician who pulled out can no longer read the job; keep going with the negotiation.
        if (!conversationId) throw error;
        return null;
      });
      await loadConversation(Boolean(fresh?.currentTechnician || roomId));
      if (mounted.current) setLoadError(null);
    } catch (error) {
      if (mounted.current) setLoadError(error instanceof Error ? error.message : 'Unable to load this job.');
    } finally {
      if (mounted.current) setLoadedKey(key);
    }
  }, [jobId, conversationId, roomId, loadJob, loadConversation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      // Closed jobs no longer change; stop polling them.
      const status = jobRef.current?.status;
      if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'FAILED') return;
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, refresh]);

  /** Runs a mutation with a busy flag, then resyncs job + negotiation (and the chat list). */
  const run = useCallback(
    async <T,>(label: string, mutation: () => Promise<T>, apply?: (result: T) => void) => {
      setBusy(label);
      try {
        const result = await mutation();
        if (mounted.current && apply) apply(result);
        await refresh();
        void refreshConversations();
        return result;
      } finally {
        if (mounted.current) setBusy(null);
      }
    },
    [refresh, refreshConversations],
  );

  const requireConversation = () => {
    if (!conversation) throw new Error('The price negotiation is not open yet.');
    return conversation;
  };
  const requireRoom = () => {
    if (!roomId) throw new Error('This action is available once a technician is assigned.');
    return roomId;
  };

  return {
    job,
    conversation,
    isLoading,
    loadError,
    busy,
    refresh,

    // ── Negotiation ─────────────────────────────────────────────────────
    acceptRequest: () =>
      run('accept-request', () => acceptJobRequestInConversation(requireConversation().id), setConversation),
    declineRequest: (reason: string) =>
      run('decline-request', () => declineJobRequestInConversation(requireConversation().id, reason), setConversation),
    sendOffer: (amount: number, notes?: string) =>
      run('send-offer', () => sendPriceOffer(requireConversation().id, amount, notes?.trim() || undefined), setConversation),
    acceptOffer: (offerId: string) =>
      run('accept-offer', () => acceptPriceOffer(requireConversation().id, offerId), setConversation),
    declineOffer: (offerId: string, reason?: string) =>
      run('decline-offer', () => declinePriceOffer(requireConversation().id, offerId, reason?.trim() || undefined), setConversation),

    // ── Job lifecycle ───────────────────────────────────────────────────
    confirmCooperation: () => run('confirm', () => confirmRoomCooperation(requireRoom())),
    /** Technician: next work status; ON_HOLD needs a reason. */
    updateWorkStatus: (status: WorkStatusValue, reason?: string) =>
      run(`work-${status}`, () => updateRoomWorkStatus(requireRoom(), status, reason)),
    /** Technician marks the work finished; the client confirms it (both send COMPLETED). */
    completeWork: () => run('complete', () => updateRoomWorkStatus(requireRoom(), 'COMPLETED')),
    pullOut: (reason: string) => run('pull-out', () => denyRoomPartnership(requireRoom(), reason)),
    cancelAfterAgreement: (reason: string) =>
      run('cancel', () => cancelJobFromRoom<{ message?: string }>(requireRoom(), reason)),
    cancelOpenJob: (reason: string) =>
      run('cancel-open', () => {
        if (!jobId) throw new Error('This request is no longer available.');
        return cancelCustomerJob(jobId, reason);
      }),
  };
}
