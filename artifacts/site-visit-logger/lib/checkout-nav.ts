import type { useRouter } from 'expo-router';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import { resolveServiceCategoryId } from '@/lib/categories-api';
import { fetchJobPhoneStatus } from '@/lib/jobs-api';
import { isTerminated, type Job } from '@/constants/jobs';

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
  /** With reuseOpenScreen: the payment screen is open underneath (see isOpenInStack). */
  paymentOpen?: boolean;
};

type StackNavigation = { getState?: () => { routes?: Array<{ name: string }> } | undefined };

/** Whether a screen (by route name, e.g. 'checkout/payment') is open in the current stack. */
export function isOpenInStack(navigation: StackNavigation | undefined, name: string): boolean {
  try {
    return Boolean(navigation?.getState?.()?.routes?.some((route) => route.name === name));
  } catch {
    return false;
  }
}

function navigator(router: Router, options: NavOptions) {
  // Pop back to the payment screen when it is already open; else stack on top,
  // so back from payment returns to the technician the client was choosing.
  if (options.reuseOpenScreen) return options.paymentOpen ? router.dismissTo : router.push;
  return options.replace ? router.replace : router.push;
}

/**
 * Opens a request's chat once it is paid. The booking screens behind it are
 * cleared first, so back from the chat can never return to payment or to
 * choosing another technician.
 */
export function openPaidChat(router: Router, params: Record<string, string>): void {
  if (router.canDismiss()) router.dismissAll();
  router.push({ pathname: '/chat/[id]', params: { ...params, fromCheckout: 'true' } } as never);
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

/**
 * Opens one of the client's requests where it continues: a cancelled one is
 * booked again with another technician, a sent one lives in its chat, and one
 * not booked yet opens at its step.
 */
export function openClientJob(router: Router, job: Job): void {
  if (isTerminated(job.status)) {
    router.push({
      pathname: '/select-technician',
      params: {
        jobId: job.id,
        service: job.service,
        description: job.problem,
        address: job.locationLabel,
        ...(job.locationLatitude !== undefined ? { latitude: String(job.locationLatitude) } : {}),
        ...(job.locationLongitude !== undefined ? { longitude: String(job.locationLongitude) } : {}),
      },
    });
    return;
  }
  const sent =
    job.bookingFee?.status === 'PAID' || job.status === 'ACTIVE' || job.status === 'IN_PROGRESS' || job.status === 'COMPLETED';
  if (sent) router.push({ pathname: '/chat/[id]', params: { id: job.id } });
  else router.push(`/job/${job.id}`);
}
