import type { BackendChatRoom } from '@/lib/chat-rooms-api';
import {
  CONVERSATION_MAX_OFFERS_PER_SIDE,
  CONVERSATION_MAX_TOTAL_OFFERS,
  wasJobRequestDeclined,
  type BackendConversation,
  type PriceOfferItem,
} from '@/lib/conversations-api';
import type { BackendJob, WorkStatus } from '@/lib/jobs-api';

/**
 * Derives the job's lifecycle as seen from the chat screen:
 * Technician Found → Price Agreed → Job Start → Job End.
 *
 * Inputs are backend records only (job, chat room, negotiation). The output
 * drives the progress stepper, the request card's status badge, which action
 * the current user owes next, and whether pulling out is still allowed.
 *
 * Kept free of React so the rules can be unit tested.
 */

export type ViewerRole = 'client' | 'technician';
export type StepState = 'done' | 'current' | 'upcoming' | 'stopped';
export type StepKey = 'found' | 'agreed' | 'started' | 'ended';

export type LifecycleStep = {
  key: StepKey;
  label: string;
  state: StepState;
};

/** The next thing the viewer can do to move the job forward. */
export type LifecycleAction =
  | { kind: 'accept-request' }
  | { kind: 'make-offer' }
  | { kind: 'respond-offer'; offer: PriceOfferItem }
  | { kind: 'confirm-cooperation' }
  /** Technician: move the work to its next status (on the way, arrived, working, resume). */
  | { kind: 'work-step'; next: 'HEADING_TO_LOCATION' | 'ARRIVED' | 'IN_PROGRESS' }
  | { kind: 'finish-job' }
  | { kind: 'confirm-completion' };

export type RequestResponseBadge = 'pending' | 'accepted' | 'denied' | 'cancelled' | 'completed';

export type CancellationMode =
  /** Before the price is agreed: either side can pull out instantly. */
  | 'pull-out'
  /** Technician has not answered the job request yet: decline it. */
  | 'decline-request'
  /** Client, job not yet assigned to anyone: cancel the request. */
  | 'cancel-open-job'
  /** After agreement: client cancels the job, technician asks admin to review. */
  | 'restricted'
  | 'none';

export type Lifecycle = {
  steps: LifecycleStep[];
  /** Short line under the stepper explaining where things stand. */
  headline: string;
  /** What the viewer can do now, if anything. */
  action: LifecycleAction | null;
  badge: RequestResponseBadge;
  isPriceAgreed: boolean;
  agreedAmount: number | null;
  currency: string;
  /** True once the job is closed (completed, cancelled, failed, or request declined). */
  isTerminal: boolean;
  cancellation: CancellationMode;
  /** Whether new offers/counter-offers can be posted. */
  canNegotiate: boolean;
  /** Where the work stands (the technician moves it). */
  workStatus: WorkStatus;
  /** Technician only: the work can be put on hold now (needs a reason). */
  canHold: boolean;
  /** When the client's confirmation window closes and the job completes on its own. */
  completionDueAt: string | null;
};

const STEP_LABELS: Record<ViewerRole, Record<StepKey, string>> = {
  client: { found: 'Technician Found', agreed: 'Price Agreed', started: 'Job Start', ended: 'Job End' },
  technician: { found: 'Request Accepted', agreed: 'Price Agreed', started: 'Start Job', ended: 'Finish Job' },
};

// The "Job Start" step is done once the technician is working (or on hold, or done).
const WORK_STARTED = new Set<WorkStatus>(['IN_PROGRESS', 'ON_HOLD', 'COMPLETED']);

/** The technician's next step and its wording, from where the work stands. */
const NEXT_WORK_STEP: Partial<Record<WorkStatus, { next: 'HEADING_TO_LOCATION' | 'ARRIVED' | 'IN_PROGRESS'; headline: string }>> = {
  PENDING: { next: 'HEADING_TO_LOCATION', headline: 'Price agreed and job confirmed. Let the client know when you set off.' },
  HEADING_TO_LOCATION: { next: 'ARRIVED', headline: 'On your way. Tap when you arrive.' },
  ARRIVED: { next: 'IN_PROGRESS', headline: 'You have arrived. Start the work when you are ready.' },
};

/** What the client reads while the technician moves the work along. */
const CLIENT_WORK_HEADLINE: Record<WorkStatus, string> = {
  PENDING: 'Price agreed and job confirmed. Waiting for the technician to set off.',
  HEADING_TO_LOCATION: 'The technician is on the way.',
  ARRIVED: 'The technician has arrived.',
  IN_PROGRESS: 'The technician is working on it.',
  ON_HOLD: 'The work is on hold.',
  COMPLETED: 'The technician marked the job finished.',
};

function clock(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function pendingOffer(conversation: BackendConversation | null): PriceOfferItem | null {
  if (!conversation) return null;
  if (conversation.currentOffer?.status === 'PENDING') return conversation.currentOffer;
  for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
    const offer = conversation.messages[i].offer;
    if (offer?.status === 'PENDING') return offer;
  }
  return null;
}

export function deriveLifecycle(input: {
  role: ViewerRole;
  job: BackendJob | null;
  room: BackendChatRoom | null;
  conversation: BackendConversation | null;
}): Lifecycle {
  const { role, job, room, conversation } = input;
  const labels = STEP_LABELS[role];
  const viewerSide = role === 'client' ? 'CUSTOMER' : 'TECHNICIAN';

  const jobStatus = job?.status ?? room?.job.status ?? 'OPEN';
  const cooperationConfirmed = (job?.cooperationStatus ?? room?.job.cooperationStatus) === 'CONFIRMED';
  const workStatus: WorkStatus = job?.workStatus ?? room?.job.workStatus ?? 'PENDING';
  const holdReason = (job?.workStatusReason ?? room?.job.workStatusReason ?? '').trim();
  const completionDueAt = job?.completionConfirmationDueAt ?? room?.job.completionConfirmationDueAt ?? null;
  const hasAssignment = Boolean(room && !room.assignment.endedAt) || Boolean(job?.currentTechnician);
  const convStatus = conversation?.status ?? null;
  const requestDeclined = Boolean(conversation && convStatus === 'DECLINED' && wasJobRequestDeclined(conversation));
  const negotiationEnded = convStatus === 'DECLINED' || convStatus === 'EXPIRED';
  const isPriceAgreed = convStatus === 'AGREED' || cooperationConfirmed;
  const offer = pendingOffer(conversation);

  const jobClosed = jobStatus === 'CANCELLED' || jobStatus === 'FAILED';
  const completed = jobStatus === 'COMPLETED';
  // A technician whose assignment ended (pulled out, reassigned) is done with this job.
  const viewerReleased = role === 'technician' && Boolean(room?.assignment.endedAt);
  // The job itself is over for this viewer; a failed negotiation alone is not (they can still pull out).
  const jobOver = jobClosed || completed || requestDeclined || viewerReleased;
  // A negotiation closed by a pull-out does not end the job: with nobody assigned
  // it is waiting for the next technician, whose acceptance reopens it.
  const isTerminal = jobOver || (!isPriceAgreed && negotiationEnded && hasAssignment);

  // ── Step completion ────────────────────────────────────────────────────
  const technicianAccepted = hasAssignment && convStatus !== 'PENDING' && !requestDeclined;
  const foundDone = role === 'client' ? hasAssignment || technicianAccepted : technicianAccepted;
  const startedDone = WORK_STARTED.has(workStatus) || completed;
  const doneByKey: Record<StepKey, boolean> = {
    found: foundDone,
    agreed: isPriceAgreed,
    started: startedDone,
    ended: completed,
  };
  const order: StepKey[] = ['found', 'agreed', 'started', 'ended'];
  // Steps fill strictly in order: a later step being done means every earlier one is too,
  // so the tracker never shows a gap.
  for (let i = order.length - 2; i >= 0; i -= 1) {
    if (doneByKey[order[i + 1]]) doneByKey[order[i]] = true;
  }
  const firstOpen = order.find((key) => !doneByKey[key]);
  const steps: LifecycleStep[] = order.map((key) => ({
    key,
    label: labels[key],
    state: doneByKey[key]
      ? 'done'
      : key === firstOpen
        ? isTerminal ? 'stopped' : 'current'
        : 'upcoming',
  }));

  // ── Next action and headline ───────────────────────────────────────────
  let action: LifecycleAction | null = null;
  let headline = '';
  const myConfirmation =
    role === 'client' ? job?.cooperationConfirmations?.customerConfirmedAt : job?.cooperationConfirmations?.technicianConfirmedAt;

  if (completed) {
    headline = 'Job completed.';
  } else if (jobClosed) {
    headline = jobStatus === 'FAILED' ? 'This job ended without completion.' : 'This job was cancelled.';
  } else if (viewerReleased) {
    headline = 'You are no longer assigned to this job.';
  } else if (requestDeclined) {
    headline = role === 'client'
      ? 'The technician declined this request.'
      : 'You declined this request.';
  } else if (!hasAssignment) {
    headline =
      job?.dispatchStatus === 'OFFERED'
        ? 'Request delivered. Waiting for the technician to accept.'
        : 'Not accepted yet. Let Fundi find someone, send it again, or choose a technician yourself.';
  } else if (!isPriceAgreed && negotiationEnded) {
    headline =
      (convStatus === 'EXPIRED' ? 'The negotiation expired.' : 'The price negotiation ended without agreement.') +
      (role === 'client' ? ' Cancel the request to find another technician.' : ' Pull out to release the job.');
  } else if (convStatus === 'PENDING' || (!conversation && role === 'technician')) {
    if (role === 'technician' && convStatus === 'PENDING') {
      action = { kind: 'accept-request' };
      headline = 'Review the request and accept it to start agreeing on a price.';
    } else {
      headline = role === 'client'
        ? 'Waiting for the technician to accept your request.'
        : 'Opening the price negotiation…';
    }
  } else if (!isPriceAgreed) {
    if (offer && offer.senderRole !== viewerSide) {
      action = { kind: 'respond-offer', offer };
      headline = 'You have a price offer to review.';
    } else if (offer) {
      headline = 'Your offer is waiting for a response.';
    } else if (conversation && offersRemaining(conversation, viewerSide) === 0) {
      headline = role === 'client'
        ? 'You have no offers left. Wait for the technician, or pull out to choose someone else.'
        : 'You have no offers left. Wait for the client, or pull out to release the job.';
    } else {
      action = { kind: 'make-offer' };
      headline = 'Propose a price. Once the other side accepts, the job is confirmed.';
    }
  } else if (!cooperationConfirmed) {
    // Agreements now confirm the job on the backend; this covers older jobs
    // agreed before that change.
    if (!myConfirmation) {
      action = { kind: 'confirm-cooperation' };
      headline = 'Price agreed. Confirm to lock in the job.';
    } else {
      headline = role === 'client'
        ? 'Waiting for the technician to confirm.'
        : 'Waiting for the client to confirm.';
    }
  } else if (role === 'technician') {
    const step = NEXT_WORK_STEP[workStatus];
    if (step) {
      action = { kind: 'work-step', next: step.next };
      headline = step.headline;
    } else if (workStatus === 'ON_HOLD') {
      action = { kind: 'work-step', next: 'IN_PROGRESS' };
      headline = holdReason ? `On hold: ${holdReason}` : 'The work is on hold.';
    } else if (workStatus === 'IN_PROGRESS') {
      action = { kind: 'finish-job' };
      headline = 'Mark the job finished when the work is done.';
    } else {
      const due = clock(completionDueAt);
      headline = due
        ? `Waiting for the client to confirm. It completes on its own at ${due}.`
        : 'Waiting for the client to confirm completion.';
    }
  } else if (workStatus === 'COMPLETED') {
    action = { kind: 'confirm-completion' };
    const due = clock(completionDueAt);
    headline = due
      ? `The technician finished. Confirm the job is done, or it completes on its own at ${due}.`
      : 'The technician finished. Confirm the job is done.';
  } else {
    headline =
      workStatus === 'ON_HOLD' && holdReason ? `The work is on hold: ${holdReason}` : CLIENT_WORK_HEADLINE[workStatus];
  }

  // ── Request card badge ────────────────────────────────────────────────
  let badge: RequestResponseBadge = 'pending';
  if (completed) badge = 'completed';
  else if (jobClosed || viewerReleased) badge = 'cancelled';
  else if (requestDeclined) badge = 'denied';
  else if (technicianAccepted || isPriceAgreed) badge = 'accepted';

  // ── Cancellation rules ────────────────────────────────────────────────
  let cancellation: CancellationMode = 'none';
  if (!jobOver) {
    if (!hasAssignment) cancellation = role === 'client' ? 'cancel-open-job' : 'none';
    else if (isPriceAgreed) cancellation = 'restricted';
    else if (role === 'technician' && convStatus === 'PENDING') cancellation = 'decline-request';
    else cancellation = 'pull-out';
  }

  return {
    steps,
    headline,
    action,
    badge,
    isPriceAgreed,
    agreedAmount: conversation?.agreedAmount ?? null,
    currency: conversation?.currency ?? job?.currency ?? 'RWF',
    isTerminal,
    cancellation,
    // Offers need someone on the other side: after a pull-out the job has no
    // technician until the next one accepts, and the API refuses offers.
    canNegotiate: convStatus === 'NEGOTIATING' && !isTerminal && hasAssignment,
    workStatus,
    canHold:
      role === 'technician' &&
      !jobOver &&
      cooperationConfirmed &&
      (workStatus === 'HEADING_TO_LOCATION' || workStatus === 'ARRIVED' || workStatus === 'IN_PROGRESS'),
    completionDueAt: workStatus === 'COMPLETED' && !completed ? completionDueAt : null,
  };
}

/**
 * Offers each side has left (backend: 3 per side, 6 total). Counted from the
 * current technician's acceptance, since a reassigned job reopens the same
 * conversation with fresh limits.
 */
export function offersRemaining(conversation: BackendConversation | null, side: 'CUSTOMER' | 'TECHNICIAN') {
  if (!conversation) return 0;
  let start = 0;
  for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
    const message = conversation.messages[i];
    if (message.type === 'TECHNICIAN_RESPONSE' && message.metadata?.decision === 'ACCEPTED') {
      start = i;
      break;
    }
  }
  const mine = conversation.messages.slice(start).filter((m) => m.offer?.senderRole === side).length;
  return Math.max(
    0,
    Math.min(CONVERSATION_MAX_OFFERS_PER_SIDE - mine, CONVERSATION_MAX_TOTAL_OFFERS - conversation.offerCount),
  );
}
