import { useEffect, useState } from 'react';
import { resolveServiceCategoryId } from '@/lib/categories-api';
import { fetchPaymentQuote, type BookingRequestType, type PaymentQuote } from '@/lib/payments-api';

/**
 * Loads what the API will charge for booking a service: the base fee plus any
 * charges the client pays. Screens show `quote.customerTotal` and fall back to
 * the catalog fee only while it loads or when it cannot be fetched.
 */
export function usePaymentQuote(params: {
  service?: string;
  categoryId?: string;
  requestType: BookingRequestType;
  /** Skip the request, for example once the fee has been paid. */
  enabled?: boolean;
}) {
  const { service, categoryId, requestType, enabled = true } = params;
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || (!service && !categoryId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    resolveServiceCategoryId(service, categoryId)
      .then((id) => fetchPaymentQuote(id, requestType))
      .then((next) => {
        if (!cancelled) setQuote(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the booking price.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service, categoryId, requestType, enabled]);

  return { quote, loading, error };
}
