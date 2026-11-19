import type { PaymentClaimMethod } from '@/lib/payments-api';

/**
 * Fundi's mobile money merchant codes. Customers pay the booking fee to one of
 * these, then tap "I have paid" so an admin can match the payment.
 *
 * Set them in .env:
 *   EXPO_PUBLIC_MTN_MOMO_PAY_CODE=...
 *   EXPO_PUBLIC_AIRTEL_MONEY_PAY_CODE=...
 */
export type PaymentCodeOption = {
  method: PaymentClaimMethod;
  title: string;
  /** The merchant code, or null when it has not been configured yet. */
  code: string | null;
  /** The USSD string that opens the payment with the code filled in, when the network has one. */
  dial: string | null;
  /** How to pay when there is no dial string. */
  steps: string;
};

function configured(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const MTN_CODE = configured(process.env.EXPO_PUBLIC_MTN_MOMO_PAY_CODE);
const AIRTEL_CODE = configured(process.env.EXPO_PUBLIC_AIRTEL_MONEY_PAY_CODE);

export const PAYMENT_CODE_OPTIONS: PaymentCodeOption[] = [
  {
    method: 'MTN',
    title: 'MTN Mobile Money',
    code: MTN_CODE,
    // MoMo Pay: *182*8*1*<merchant code>#
    dial: MTN_CODE ? `*182*8*1*${MTN_CODE}#` : null,
    steps: 'Dial *182*8*1*, then the code and #. Confirm the amount with your PIN.',
  },
  {
    method: 'AIRTEL',
    title: 'Airtel Money',
    code: AIRTEL_CODE,
    dial: null,
    steps: 'Open Airtel Money, choose Pay merchant, enter the code and the amount, then confirm with your PIN.',
  },
];

export function paymentCodeOption(method: PaymentClaimMethod): PaymentCodeOption {
  return PAYMENT_CODE_OPTIONS.find((option) => option.method === method) ?? PAYMENT_CODE_OPTIONS[0]!;
}
