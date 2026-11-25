import { apiRequest } from '@/lib/api';

export type BookingRequestType = 'NORMAL' | 'SOS';

/** One admin-configured charge on a service's booking fee. */
export interface PaymentQuoteCharge {
  id: string;
  name: string;
  description: string | null;
  chargeType: 'FIXED' | 'PERCENTAGE';
  /** The configured value: RWF for FIXED, a percentage for PERCENTAGE. */
  value: number;
  /** CUSTOMER charges are added to what the client pays; FUNDI charges Fundi absorbs. */
  payer: 'CUSTOMER' | 'FUNDI';
  /** What the charge comes to, in RWF. */
  amount: number;
}

/** GET /api/v1/payments/quote: the price the API will charge for a booking. */
export interface PaymentQuote {
  serviceCategory: { id: string; name: string };
  requestType: BookingRequestType;
  currency: 'RWF';
  baseFee: number;
  charges: PaymentQuoteCharge[];
  /** What the client pays: the base fee plus every CUSTOMER charge. */
  customerTotal: number;
  fundiTotal: number;
  total: number;
}

export async function fetchPaymentQuote(
  serviceCategoryId: string,
  requestType: BookingRequestType = 'NORMAL',
): Promise<PaymentQuote> {
  const query = new URLSearchParams({ serviceCategoryId, requestType });
  return apiRequest<PaymentQuote>(`/api/v1/payments/quote?${query.toString()}`, { authenticated: true });
}

/** One booking fee the customer paid, from GET /api/v1/payments/mine. */
export interface MyBookingPayment {
  id: string;
  externalPaymentId: string;
  jobId: string | null;
  serviceCategoryId: string;
  service: string;
  requestType: BookingRequestType;
  status: 'VALID' | 'EXPIRED' | 'PAUSED' | 'RESUMED' | 'COMPLETED';
  amount: number;
  currency: string;
  paidAt: string;
  validUntil: string;
  /** How the amount was priced at the time; null for payments made before charges existed. */
  pricingDetails: PaymentQuote | null;
}

export async function fetchMyPayments(): Promise<MyBookingPayment[]> {
  const rows = await apiRequest<MyBookingPayment[]>('/api/v1/payments/mine', { authenticated: true });
  return Array.isArray(rows) ? rows : [];
}

/**
 * A booking fee already paid for this service that no request uses yet (a
 * request that failed after paying, say). Paying again would charge twice.
 */
export async function findUnusedPayment(
  serviceCategoryId: string,
  requestType: BookingRequestType,
): Promise<MyBookingPayment | null> {
  const rows = await fetchMyPayments().catch(() => [] as MyBookingPayment[]);
  const now = Date.now();
  return (
    rows.find(
      (row) =>
        !row.jobId &&
        row.serviceCategoryId === serviceCategoryId &&
        row.requestType === requestType &&
        (row.status === 'VALID' || row.status === 'RESUMED') &&
        new Date(row.validUntil).getTime() > now,
    ) ?? null
  );
}

/** Charges the client pays on top of the base fee. */
export function customerCharges(quote: PaymentQuote | null | undefined): PaymentQuoteCharge[] {
  return quote?.charges.filter((charge) => charge.payer === 'CUSTOMER' && charge.amount > 0) ?? [];
}

/** How the customer paid outside the app. */
export type PaymentClaimMethod = 'MTN' | 'AIRTEL';

/**
 * "I have paid": a customer's report of a booking fee paid to Fundi's mobile
 * money code. An admin checks it; once APPROVED it carries the booking payment
 * the job is created with.
 */
export interface PaymentClaim {
  id: string;
  serviceCategoryId: string;
  requestType: BookingRequestType;
  amount: number;
  paymentMethod: PaymentClaimMethod | 'CREDIT_CARD';
  paymentNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  bookingPayment: {
    id: string;
    jobId: string | null;
    status: MyBookingPayment['status'];
    amount: number;
    paidAt: string;
    validUntil: string;
  } | null;
  pricingDetails: PaymentQuote | null;
}

export interface SubmitPaymentClaimInput {
  serviceCategoryId: string;
  requestType: BookingRequestType;
  /** Must equal the quote's customerTotal, or the API answers 400 with expectedAmount. */
  amount: number;
  paymentMethod: PaymentClaimMethod;
  /** The mobile money number the customer paid from. */
  paymentNumber: string;
}

export async function submitPaymentClaim(input: SubmitPaymentClaimInput): Promise<PaymentClaim> {
  return apiRequest<PaymentClaim>('/api/v1/payments/claims', {
    method: 'POST',
    authenticated: true,
    body: input,
  });
}

export async function fetchMyPaymentClaims(): Promise<PaymentClaim[]> {
  const rows = await apiRequest<PaymentClaim[]>('/api/v1/payments/claims/mine', { authenticated: true });
  return Array.isArray(rows) ? rows : [];
}
