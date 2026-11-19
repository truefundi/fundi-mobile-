import type { useRouter } from 'expo-router';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import { resolveServiceCategoryId } from '@/lib/categories-api';
import { fetchJobPhoneStatus } from '@/lib/jobs-api';
import type { Job } from '@/constants/jobs';

type Router = ReturnType<typeof useRouter>;

type CheckoutParams = {
  requestId?: string;
  technicianId?: string;
  service?: string;
  categoryId?: string;
};

type NavOptions = {
  /** Replace the current screen instead of stacking on it (resuming from a hub screen). */
  replace?: boolean;
  /**
   * Go back to the checkout screen if it is already open (e.g. booking from a
   * profile opened on the payment screen), else replace the current screen.
   * Keeps the back stack to one payment screen.
   */
  reuseOpenScreen?: boolean;
};

function navigator(router: Router, options: NavOptions) {
  if (options.reuseOpenScreen) return router.dismissTo;
  return options.replace ? router.replace : router.push;
}

/**
 * Opens the booking-fee payment for a request. A client whose account phone
 * is already verified goes straight to payment; only an unverified phone gets
 * the code screen first. Deciding before navigating keeps the code screen
 * from flashing up and disappearing for verified accounts.
 */
export async function continueToCheckout(router: Router, params: CheckoutParams, options: NavOptions = {}): Promise<void> {
  const go = navigator(router, options);
  try {
    const status = await fetchJobPhoneStatus();
    if (status.verified) {
      const categoryId = await resolveServiceCategoryId(params.service, params.categoryId);
      go({
        pathname: '/checkout/payment',
        params: {
          ...params,
          categoryId,
          verifiedPhone: cleanAndNormalizePhone(status.phoneNumber),
        },
      });
      return;
    }
  } catch {
    // Status unavailable: verify with a code instead.
  }
  go({ pathname: '/checkout/verify-phone' as any, params });
}

/** Statuses of a request that has not been sent (booking fee not paid yet). */
const UNSENT = new Set(['REQUESTED', 'MATCHING', 'OFFERED', 'ACCEPTED', 'PAYMENT_PENDING']);

/**
 * Where an unfinished request continues: the step the client stopped on.
 * Returns null when the request is past booking (its chat or job screen handles it).
 */
export function resumeStep(job: Job): 'choose-technician' | 'pay' | 'sos' | null {
  if (job.bookingFee?.status === 'PAID' || !UNSENT.has(job.status)) return null;
  if (job.type === 'SOS') return 'sos';
  return job.technician ? 'pay' : 'choose-technician';
}

/** Opens an unfinished request at its step. Returns false when there is nothing to resume. */
export function resumeRequest(router: Router, job: Job, options: NavOptions = {}): boolean {
  const step = resumeStep(job);
  if (!step) return false;
  const go = options.replace ? router.replace : router.push;
  if (step === 'sos') {
    go({
      pathname: '/checkout/sos-dispatch' as any,
      params: { requestId: job.id, jobId: job.id, service: job.service, ...(job.serviceCategoryId ? { categoryId: job.serviceCategoryId } : {}) },
    });
  } else if (step === 'choose-technician') {
    go({ pathname: '/select-technician', params: { jobId: job.id, service: job.service } });
  } else {
    void continueToCheckout(
      router,
      { requestId: job.id, technicianId: job.technician?.id, service: job.service, categoryId: job.serviceCategoryId },
      options,
    );
  }
  return true;
}
