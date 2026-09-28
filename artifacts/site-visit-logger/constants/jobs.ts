/**
 * The Fundi job lifecycle.
 *
 * REQUEST -> MATCH -> ACCEPT -> PAY VISIT FEE -> TRACK -> ARRIVE -> DIAGNOSE
 * -> QUOTE -> APPROVE -> REPAIR -> COMPLETE -> PAYMENT -> RATE
 */

export type JobStatus =
  | 'REQUESTED'
  | 'MATCHING'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'VISIT_PAID'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'DIAGNOSING'
  | 'DIAGNOSIS_COMPLETE'
  | 'QUOTE_PENDING'
  | 'QUOTE_APPROVED'
  | 'REPAIR_IN_PROGRESS'
  | 'ADDITIONAL_APPROVAL_REQUIRED'
  | 'REPAIR_COMPLETED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_REPORTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

/** Customer-facing wording for each status. */
export const STATUS_LABEL: Record<JobStatus, string> = {
  REQUESTED: 'Request sent',
  MATCHING: 'Finding a technician',
  OFFERED: 'Technician found',
  ACCEPTED: 'Visit fee due',
  VISIT_PAID: 'Visit fee paid',
  EN_ROUTE: 'On the way',
  ARRIVED: 'Technician arrived',
  DIAGNOSING: 'Diagnosing',
  DIAGNOSIS_COMPLETE: 'Diagnosis complete',
  QUOTE_PENDING: 'Quote awaiting approval',
  QUOTE_APPROVED: 'Quote approved',
  REPAIR_IN_PROGRESS: 'Repair in progress',
  ADDITIONAL_APPROVAL_REQUIRED: 'Extra work needs approval',
  REPAIR_COMPLETED: 'Repair completed',
  PAYMENT_PENDING: 'Payment pending',
  PAYMENT_REPORTED: 'Payment recorded',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

/** Which palette token a status badge should use. */
export type StatusTone = 'progress' | 'action' | 'success' | 'danger';

export const STATUS_TONE: Record<JobStatus, StatusTone> = {
  REQUESTED: 'progress',
  MATCHING: 'progress',
  OFFERED: 'action',
  ACCEPTED: 'action',
  VISIT_PAID: 'progress',
  EN_ROUTE: 'progress',
  ARRIVED: 'progress',
  DIAGNOSING: 'progress',
  DIAGNOSIS_COMPLETE: 'progress',
  QUOTE_PENDING: 'action',
  QUOTE_APPROVED: 'progress',
  REPAIR_IN_PROGRESS: 'progress',
  ADDITIONAL_APPROVAL_REQUIRED: 'action',
  REPAIR_COMPLETED: 'progress',
  PAYMENT_PENDING: 'action',
  PAYMENT_REPORTED: 'progress',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
};

/** A job is finished when it reaches one of these. */
export const CLOSED_STATUSES: JobStatus[] = ['COMPLETED', 'CANCELLED'];

export function isClosed(status: JobStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export type Technician = {
  id: string;
  name: string;
  skill: string;
  rating: number;
  jobsCompleted: number;
  distanceKm: number;
  etaMinutes: number;
  initials: string;
  phone: string;
  yearsExperience: number;
};

export type QuoteLine = {
  label: string;
  quantity: number;
  unitPrice: number;
};

export type Quote = {
  diagnosis: string;
  parts: QuoteLine[];
  labour: number;
};

export type AdditionalWork = {
  reason: string;
  parts: QuoteLine[];
  labour: number;
};

export type Rating = {
  overall: number;
  quality: number;
  professionalism: number;
  arrival: number;
  communication: number;
  value: number;
  comment: string;
};

export type SettlementMethod = 'Fundi' | 'Cash' | 'Mobile Money' | 'Other';

export type PaymentMethod = 'Card' | 'Mobile Money' | 'Fundi Wallet';

export type JobEvent = {
  id: string;
  status: JobStatus;
  title: string;
  text: string;
  at: string;
};

export type Job = {
  id: string;
  reference: string;
  service: string;
  problem: string;
  urgency: 'Emergency' | 'Today' | 'Schedule';
  locationLabel: string;
  photoUri?: string;
  status: JobStatus;
  /** ISO timestamp of the last status change — drives the simulated timers. */
  statusSince: string;
  createdAt: string;
  technician?: Technician;
  /** A technician on this device took the job, so they drive it, not the timers. */
  takenByTechnician?: boolean;
  visitFee: number;
  visitPaymentMethod?: PaymentMethod;
  quote?: Quote;
  additionalWork?: AdditionalWork;
  additionalWorkApproved?: boolean;
  settlementMethod?: SettlementMethod;
  rating?: Rating;
  completedAt?: string;
  events: JobEvent[];
};

/** Emergency visits cost more because the technician drops everything. */
export const VISIT_FEE = 75;
export const EMERGENCY_VISIT_FEE = 110;

/** Fundi's cut of the visit fee. The repair itself settles between the two parties. */
export const COMMISSION_RATE = 0.3;

export function visitFeeFor(urgency: Job['urgency']): number {
  return urgency === 'Emergency' ? EMERGENCY_VISIT_FEE : VISIT_FEE;
}

export function quoteSubtotal(quote: Quote): number {
  const parts = quote.parts.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return parts + quote.labour;
}

export function additionalSubtotal(work: AdditionalWork): number {
  const parts = work.parts.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return parts + work.labour;
}

/** Repair total including any approved extra work, before the visit fee credit. */
export function repairTotal(job: Job): number {
  const base = job.quote ? quoteSubtotal(job.quote) : 0;
  const extra = job.additionalWork && job.additionalWorkApproved ? additionalSubtotal(job.additionalWork) : 0;
  return base + extra;
}

/** What the customer still owes: repair total minus the visit fee already paid. */
export function balanceDue(job: Job): number {
  return Math.max(repairTotal(job) - job.visitFee, 0);
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
