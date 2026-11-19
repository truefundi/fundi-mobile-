import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiRequestError } from '@/lib/api';
import {
  fetchMyPaymentClaims,
  submitPaymentClaim,
  type PaymentClaim,
  type SubmitPaymentClaimInput,
} from '@/lib/payments-api';
import { formatBookingFee } from '@/constants/jobs';

const POLL_MS = 10_000;
const storageKey = (requestId: string) => `fundi.paymentClaim.${requestId}`;

/**
 * The "I have paid" claim for one request. The claim id is kept on the phone,
 * so leaving checkout and coming back picks the same claim up again, and a
 * pending claim is checked every few seconds until an admin answers.
 */
export function usePaymentClaim(requestId: string | undefined) {
  const [claim, setClaim] = useState<PaymentClaim | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What the API says the fee is when the claimed amount did not match. */
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null);
  const claimIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const id = claimIdRef.current;
    if (!id) return;
    setChecking(true);
    try {
      const found = (await fetchMyPaymentClaims()).find((row) => row.id === id);
      if (found) setClaim(found);
      else {
        // The claim is gone (an admin deleted it): start over.
        claimIdRef.current = null;
        setClaim(null);
        if (requestId) await AsyncStorage.removeItem(storageKey(requestId)).catch(() => undefined);
      }
    } catch {
      // Keep showing the last known state; the next check will try again.
    } finally {
      setChecking(false);
    }
  }, [requestId]);

  // Pick up a claim made earlier for this request.
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey(requestId))
      .then((id) => {
        if (cancelled || !id) return;
        claimIdRef.current = id;
        return refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [requestId, refresh]);

  // While an admin has not answered, keep checking.
  useEffect(() => {
    if (claim?.status !== 'PENDING') return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [claim?.status, refresh]);

  const submit = useCallback(
    async (input: SubmitPaymentClaimInput): Promise<PaymentClaim | null> => {
      setSubmitting(true);
      setError(null);
      setExpectedAmount(null);
      try {
        const created = await submitPaymentClaim(input);
        claimIdRef.current = created.id;
        setClaim(created);
        if (requestId) await AsyncStorage.setItem(storageKey(requestId), created.id).catch(() => undefined);
        return created;
      } catch (err) {
        if (err instanceof ApiRequestError && typeof err.details?.expectedAmount === 'number') {
          const expected = err.details.expectedAmount;
          setExpectedAmount(expected);
          setError(`The booking fee is now ${formatBookingFee(expected)}. Check what you paid, then tap "I have paid" again.`);
        } else {
          setError(err instanceof Error ? err.message : 'Your payment could not be reported. Please try again.');
        }
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [requestId],
  );

  /** Forget the claim, e.g. after a rejection or once the job is created. */
  const clear = useCallback(async () => {
    claimIdRef.current = null;
    setClaim(null);
    setError(null);
    setExpectedAmount(null);
    if (requestId) await AsyncStorage.removeItem(storageKey(requestId)).catch(() => undefined);
  }, [requestId]);

  return { claim, submit, submitting, refresh, checking, clear, error, expectedAmount };
}
