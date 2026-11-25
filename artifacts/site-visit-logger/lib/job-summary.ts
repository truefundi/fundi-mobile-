import { isTerminated, type Job } from '@/constants/jobs';

export type JobTone = 'action' | 'progress' | 'waiting' | 'done' | 'stopped';

/**
 * Where a job stands, in the words shown on job lists. Derived from the same
 * backend fields as the chat tracker, so a card and its chat always agree.
 */
export type JobSummary = {
  /** Short status, e.g. "Agree on a price". */
  label: string;
  /** One line explaining it, e.g. "Chat with Alex to agree the price." */
  hint: string;
  tone: JobTone;
  /** The viewer owes the next step. */
  yourTurn: boolean;
  /** Steps done on the four-step tracker (0–4): found, agreed, started, ended. */
  stepsDone: number;
  /** Still going (as opposed to completed or cancelled). */
  ongoing: boolean;
};

// Work has started once the technician is working, on hold or finished.
const WORK_STARTED = new Set(['IN_PROGRESS', 'ON_HOLD', 'COMPLETED']);

/** "until 19:42" for the confirmation window, or nothing. */
function until(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : ` It completes on its own at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
}

function money(amount?: number) {
  return amount ? `RWF ${amount.toLocaleString()}` : null;
}

function closedSummary(job: Job, viewer: 'client' | 'technician'): JobSummary | null {
  if (job.status === 'COMPLETED') {
    const price = money(job.agreedPrice);
    return {
      label: 'Completed',
      hint: price ? `Finished · ${price}` : 'Finished',
      tone: 'done',
      yourTurn: false,
      stepsDone: 4,
      ongoing: false,
    };
  }
  if (isTerminated(job.status)) {
    return {
      label: job.status === 'DECLINED' ? 'Declined' : 'Cancelled',
      hint:
        job.cancellationReason?.trim() ||
        (viewer === 'client' ? 'You can book this service again.' : 'This job was called off.'),
      tone: 'stopped',
      yourTurn: false,
      stepsDone: 0,
      ongoing: false,
    };
  }
  return null;
}

/** The client's view of one of their requests. */
export function summarizeClientJob(job: Job): JobSummary {
  const closed = closedSummary(job, 'client');
  if (closed) return closed;

  const tech = job.technician?.name;
  const paid = job.bookingFee?.status === 'PAID';
  const assigned = job.status === 'ACTIVE' || job.status === 'IN_PROGRESS';

  if (!paid && !assigned && job.paymentReported) {
    return {
      label: 'Confirming payment',
      hint: 'Fundi is checking your payment. Your request is sent as soon as it is confirmed.',
      tone: 'waiting',
      yourTurn: false,
      stepsDone: 0,
      ongoing: true,
    };
  }
  if (!paid && !assigned) {
    return {
      label: 'Finish booking',
      hint: job.technician ? `Pay the booking fee to send it to ${tech}.` : 'Choose a technician to send your request.',
      tone: 'action',
      yourTurn: true,
      stepsDone: 0,
      ongoing: true,
    };
  }
  if (!assigned) {
    const routed = job.routedTechnician;
    if (routed?.pending) {
      return {
        label: 'Request sent',
        hint: `Waiting for ${routed.name} to accept.`,
        tone: 'waiting',
        yourTurn: false,
        stepsDone: 0,
        ongoing: true,
      };
    }
    return {
      label: 'Not accepted yet',
      hint: 'Send it to another technician. Your booking fee still covers it.',
      tone: 'action',
      yourTurn: true,
      stepsDone: 0,
      ongoing: true,
    };
  }

  const agreed = Boolean(job.agreedPrice) || job.cooperationStatus === 'CONFIRMED';
  if (!agreed) {
    return {
      label: 'Agree on a price',
      hint: `Chat with ${tech ?? 'your technician'} to agree the price.`,
      tone: 'progress',
      yourTurn: false,
      stepsDone: 1,
      ongoing: true,
    };
  }
  if (job.workStatus === 'HEADING_TO_LOCATION' || job.workStatus === 'ARRIVED') {
    const arrived = job.workStatus === 'ARRIVED';
    return {
      label: arrived ? 'Technician arrived' : 'On the way',
      hint: arrived ? `${tech ?? 'Your technician'} is with you.` : `${tech ?? 'Your technician'} is on the way.`,
      tone: 'progress',
      yourTurn: false,
      stepsDone: 2,
      ongoing: true,
    };
  }
  if (!WORK_STARTED.has(job.workStatus ?? '')) {
    return {
      label: 'Confirmed',
      hint: `${money(job.agreedPrice) ?? 'Price agreed'} · waiting for ${tech ?? 'the technician'} to set off.`,
      tone: 'waiting',
      yourTurn: false,
      stepsDone: 2,
      ongoing: true,
    };
  }
  if (job.workStatus === 'COMPLETED') {
    return {
      label: 'Confirm it is done',
      hint: `${tech ?? 'The technician'} marked the job finished.${until(job.completionConfirmationDueAt)}`,
      tone: 'action',
      yourTurn: true,
      stepsDone: 3,
      ongoing: true,
    };
  }
  if (job.workStatus === 'ON_HOLD') {
    return {
      label: 'On hold',
      hint: job.workStatusReason?.trim() || `${tech ?? 'Your technician'} paused the work.`,
      tone: 'waiting',
      yourTurn: false,
      stepsDone: 3,
      ongoing: true,
    };
  }
  return {
    label: 'In progress',
    hint: `${tech ?? 'Your technician'} is working on it.`,
    tone: 'progress',
    yourTurn: false,
    stepsDone: 3,
    ongoing: true,
  };
}

/** The technician's view of a job they were sent or are working on. */
export function summarizeTechnicianJob(job: Job, isRequest: boolean): JobSummary {
  if (isRequest) {
    return {
      label: 'New request',
      hint: 'Accept it to agree a price with the client.',
      tone: 'action',
      yourTurn: true,
      stepsDone: 0,
      ongoing: true,
    };
  }
  const closed = closedSummary(job, 'technician');
  if (closed) return closed;

  const client = job.clientName || 'the client';
  const agreed = Boolean(job.agreedPrice) || job.cooperationStatus === 'CONFIRMED';
  if (!agreed) {
    return {
      label: 'Agree on a price',
      hint: `Propose a price to ${client} in the chat.`,
      tone: 'progress',
      yourTurn: false,
      stepsDone: 1,
      ongoing: true,
    };
  }
  if (job.workStatus === 'HEADING_TO_LOCATION') {
    return {
      label: 'On your way',
      hint: `Tap "I've arrived" in the chat when you get there.`,
      tone: 'progress',
      yourTurn: true,
      stepsDone: 2,
      ongoing: true,
    };
  }
  if (job.workStatus === 'ARRIVED') {
    return {
      label: 'Start the work',
      hint: 'You have arrived. Start the work in the chat.',
      tone: 'action',
      yourTurn: true,
      stepsDone: 2,
      ongoing: true,
    };
  }
  if (!WORK_STARTED.has(job.workStatus ?? '')) {
    return {
      label: 'Set off',
      hint: `${money(job.agreedPrice) ?? 'Price agreed'} · tell ${client} when you are on your way.`,
      tone: 'action',
      yourTurn: true,
      stepsDone: 2,
      ongoing: true,
    };
  }
  if (job.workStatus === 'COMPLETED') {
    return {
      label: 'Waiting for the client',
      hint: `${client[0]?.toUpperCase() ?? ''}${client.slice(1)} needs to confirm it is done.${until(job.completionConfirmationDueAt)}`,
      tone: 'waiting',
      yourTurn: false,
      stepsDone: 3,
      ongoing: true,
    };
  }
  if (job.workStatus === 'ON_HOLD') {
    return {
      label: 'On hold',
      hint: job.workStatusReason?.trim() ? `${job.workStatusReason.trim()} · resume in the chat.` : 'Resume the work in the chat.',
      tone: 'waiting',
      yourTurn: true,
      stepsDone: 3,
      ongoing: true,
    };
  }
  return {
    label: 'In progress',
    hint: 'Mark it finished in the chat when the work is done.',
    tone: 'progress',
    yourTurn: true,
    stepsDone: 3,
    ongoing: true,
  };
}

/** When a job last moved: finished, changed status, or was made. */
export const lastActive = (job: Job) => job.completedAt ?? job.statusSince ?? job.createdAt;

/** Sort helper: the job that moved most recently first. */
export const newestJobFirst = (a: Job, b: Job) =>
  new Date(lastActive(b)).getTime() - new Date(lastActive(a)).getTime();
