/**
 * Every AsyncStorage key the app owns, in one place.
 *
 * Job history is scoped to the account's phone number so that signing out and
 * signing back in restores the same records, while a different number on the
 * same device starts clean.
 */

/** Every account registered on this device, keyed by phone number. */
export const ACCOUNTS_KEY = '@fundi/accounts';

/** The phone number that is signed in. */
export const SESSION_KEY = '@fundi/session';

/** The one-time code waiting to be typed in, if any. */
export const PENDING_KEY = '@fundi/pending-verification';

export const JOBS_KEY_PREFIX = '@fundi/jobs/';

/** Where one account's jobs live. */
export function jobsKey(phone: string): string {
  return `${JOBS_KEY_PREFIX}${phone}`;
}

/** Unscoped job list written by installs from before accounts existed. */
export const LEGACY_JOBS_KEY = '@fundi/jobs';

/** Which side of the marketplace an account is viewing, and its work state. */
export function workKey(phone: string): string {
  return `@fundi/work/${phone}`;
}

/**
 * What the customer changed about themselves on this device — picture, name,
 * area, saved places and preferences — until the backend's `PATCH /me` and
 * upload endpoints exist. Kept apart from the session, which the server owns.
 */
export function profileKey(phone: string): string {
  return `@fundi/profile/${phone}`;
}
