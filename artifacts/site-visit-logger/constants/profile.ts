/**
 * Defaults for a new account.
 *
 * The customer's identity is their verified phone number, held in the session
 * (see context/AuthContext.tsx). Only values that sign-up cannot ask for live
 * here — registration collects a phone number and nothing else.
 */

/** Shown until the customer sets a service area of their own. */
export const DEFAULT_LOCATION = 'Kigali, Rwanda';
