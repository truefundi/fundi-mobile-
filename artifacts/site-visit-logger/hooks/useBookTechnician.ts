import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { isTerminated, type Job } from '@/constants/jobs';
import { toJobTechnician, type MarketplaceTechnician } from '@/constants/technicians';
import { mapBackendJobToFrontendJob, useFundi } from '@/context/FundiContext';
import { ApiRequestError } from '@/lib/api';
import { continueToCheckout } from '@/lib/checkout-nav';
import { fetchCustomerJob, type BackendJob } from '@/lib/jobs-api';

/** Jobs on the API have UUIDs; phone-only drafts have ids like job-123-abc. */
const API_JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BookOptions = {
  /** The request being booked. Without one, the client is sent to describe the job first. */
  requestId?: string;
  technician: MarketplaceTechnician;
  /** Straight-line distance to show on the request, when known. */
  distanceKm?: number;
  /** Service to pre-fill when there is no request yet. */
  service?: string;
  categoryId?: string;
};

/**
 * Books a technician for a request, from the technician list or a profile.
 *
 * One request has one id: this never creates a second request for the same
 * job. It continues the request the client already has, reusing its booking
 * fee when it is paid, and only starts a new request to rebook one that was
 * cancelled (once, however many times the client taps).
 */
export function useBookTechnician() {
  const router = useRouter();
  const { getJob, jobs, selectTechnician, proposeTechnicianToJob, createDraftRequest } = useFundi();
  const inFlight = useRef(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openChat = useCallback(
    (jobId: string, technicianId?: string, proposalError?: string) => {
      // Back to the request's chat if it is already open underneath, so the back
      // stack keeps one chat per request; otherwise it takes this screen's place.
      router.dismissTo({
        pathname: '/chat/[id]',
        params: { id: jobId, requestId: jobId, ...(technicianId ? { technicianId } : {}), ...(proposalError ? { proposalError } : {}) },
      });
    },
    [router],
  );

  /** Sends a paid, open request to the technician; an existing request elsewhere opens instead. */
  const sendPaidRequest = useCallback(
    async (jobId: string, technicianId: string) => {
      try {
        await proposeTechnicianToJob(jobId, technicianId);
        openChat(jobId, technicianId);
      } catch (err) {
        const existing = err instanceof ApiRequestError ? err.details?.existingJobId : undefined;
        if (typeof existing === 'string' && existing !== jobId) {
          // This technician already has another request from the client: continue that one.
          openChat(existing);
          return;
        }
        openChat(jobId, technicianId, err instanceof Error ? err.message : 'The request could not be sent to this technician.');
      }
    },
    [proposeTechnicianToJob, openChat],
  );

  /** A cancelled request is booked again as one new request, reused on every later tap. */
  const rebook = useCallback(
    (previous: Job): string => {
      const existing = jobs.find(
        (job) => job.rebookOf === previous.id && job.bookingFee?.status !== 'PAID' && !isTerminated(job.status),
      );
      if (existing) return existing.id;
      return createDraftRequest({
        service: previous.service,
        serviceCategoryId: previous.serviceCategoryId,
        problem: previous.problem,
        urgency: previous.urgency === 'Emergency' ? 'Today' : previous.urgency,
        type: 'STANDARD',
        locationLabel: previous.locationLabel,
        locationLatitude: previous.locationLatitude,
        locationLongitude: previous.locationLongitude,
        photoUris: previous.photoUris,
        videoUris: previous.videoUris,
        rebookOf: previous.id,
      });
    },
    [jobs, createDraftRequest],
  );

  const book = useCallback(
    async ({ requestId, technician, distanceKm, service, categoryId }: BookOptions) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBooking(true);
      setError(null);
      try {
        // No request yet: describe the job first instead of inventing one.
        if (!requestId) {
          router.push({ pathname: '/request', params: { ...(service ? { service } : {}), ...(categoryId ? { categoryId } : {}) } });
          return;
        }

        const local = getJob(requestId);
        let remote: BackendJob | null = null;
        if (API_JOB_ID.test(requestId)) remote = await fetchCustomerJob(requestId).catch(() => null);

        if (remote) {
          if (remote.status === 'OPEN') {
            if (remote.bookingPayment) {
              // Already waiting for this technician: nothing to send again.
              if (remote.activeOffer?.technicianId === technician.id) openChat(requestId);
              else await sendPaidRequest(requestId, technician.id);
              return;
            }
          } else if (remote.status === 'ASSIGNED' || remote.status === 'PAUSED') {
            // A technician is on the job; its chat is where it continues.
            openChat(requestId);
            return;
          } else {
            // Cancelled, failed or completed: book it again as one new request.
            const draftId = rebook(local ?? mapBackendJobToFrontendJob(remote));
            selectTechnician(draftId, toJobTechnician(technician, distanceKm));
            const draft = getJob(draftId);
            await continueToCheckout(
              router,
              {
              requestId: draftId,
              technicianId: technician.id,
              service: draft?.service ?? remote.service,
              categoryId: draft?.serviceCategoryId ?? remote.serviceCategory?.id ?? categoryId,
            },
            { reuseOpenScreen: true },
            );
            return;
          }
        }

        if (!local) {
          setError('This request is no longer on this phone. Open it from your requests and try again.');
          return;
        }

        if (isTerminated(local.status)) {
          const draftId = rebook(local);
          selectTechnician(draftId, toJobTechnician(technician, distanceKm));
          await continueToCheckout(
              router,
              {
            requestId: draftId,
            technicianId: technician.id,
            service: local.service,
            categoryId: local.serviceCategoryId ?? categoryId,
          },
          { reuseOpenScreen: true },
          );
          return;
        }

        // The phone's own (unpaid) request: pick this technician, then pay.
        if (local.technician?.id !== technician.id) {
          selectTechnician(local.id, toJobTechnician(technician, distanceKm));
        }
        await continueToCheckout(
              router,
              {
          requestId: local.id,
          technicianId: technician.id,
          service: local.service,
          categoryId: local.serviceCategoryId ?? categoryId,
        },
        { reuseOpenScreen: true },
        );
      } finally {
        inFlight.current = false;
        setBooking(false);
      }
    },
    [getJob, rebook, selectTechnician, sendPaidRequest, openChat, router],
  );

  return { book, booking, error };
}
