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

/** Charges the client pays on top of the base fee. */
export function customerCharges(quote: PaymentQuote | null | undefined): PaymentQuoteCharge[] {
  return quote?.charges.filter((charge) => charge.payer === 'CUSTOMER' && charge.amount > 0) ?? [];
}
