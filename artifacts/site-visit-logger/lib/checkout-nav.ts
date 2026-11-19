import type { useRouter } from 'expo-router';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import { resolveServiceCategoryId } from '@/lib/categories-api';
import { fetchJobPhoneStatus } from '@/lib/jobs-api';

type CheckoutParams = {
  requestId?: string;
  technicianId?: string;
  service?: string;
  categoryId?: string;
};

/**
 * Opens the booking-fee checkout for a request. A client whose account phone
 * is already verified goes straight to the booking fee; only an unverified
 * phone gets the code screen. Deciding before navigating keeps the code
 * screen from flashing up and disappearing for verified accounts.
 */
export async function continueToCheckout(router: ReturnType<typeof useRouter>, params: CheckoutParams): Promise<void> {
  try {
    const status = await fetchJobPhoneStatus();
    if (status.verified) {
      const categoryId = await resolveServiceCategoryId(params.service, params.categoryId);
      router.push({
        pathname: '/checkout/booking-fee',
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
  router.push({ pathname: '/checkout/verify-phone' as any, params });
}
