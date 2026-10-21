/**
 * Registration and sign-in rules.
 *
 * An account is a phone number. Registration asks for a full name and that
 * number; signing back in asks for the number alone. Both are then confirmed
 * by a code, so possession of the number is what proves the account is yours.
 */

/** Rwanda is the default launch market, but multiple countries are supported. */
export const DIAL_CODE = '+250';
export const NATIONAL_DIGITS = 9;
export const SAMPLE_NUMBER = '788 123 456';
/** Every Rwandan mobile number starts with 7. */
export const NATIONAL_PREFIX = '7';

export const PIN_LENGTH = 5;
export const OTP_LENGTH = 6;
/** How long the customer waits before a new code can be sent. */
export const RESEND_AFTER_MS = 30 * 1000;

/** What a phone number has to look like, in the words shown to customers. */
export const PHONE_RULE = 'Enter a valid mobile phone number.';

/**
 * Normalises phone number given a country dial code and typed national digits.
 */
export function normaliseInternationalPhone(dialCode: string, digits: string): string | null {
  const cleanDial = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  const cleanDigits = digits.replace(/\D/g, '').replace(/^0+/, '');
  if (cleanDigits.length < 6 || cleanDigits.length > 15) return null;
  return `${cleanDial}${cleanDigits}`;
}

/**
 * Turns whatever the customer typed into +250XXXXXXXXX, or null when it cannot
 * be a Rwandan mobile number. Accepts 0788123456, 788123456, +250788123456 and
 * the spaced variants of each.
 */
export function normalisePhone(input: string, dialCode = DIAL_CODE): string | null {
  if (dialCode !== DIAL_CODE) {
    return normaliseInternationalPhone(dialCode, input);
  }
  const national = nationalDigits(input);
  if (national.length !== NATIONAL_DIGITS) return null;
  if (!national.startsWith(NATIONAL_PREFIX)) return null;
  return `${DIAL_CODE}${national}`;
}

/** The digits a customer may keep typing, without the country code. */
export function nationalDigits(input: string, maxDigits = 15): string {
  const digits = input.replace(/\D/g, '');
  const national = digits.replace(/^0+/, '');
  return national.slice(0, maxDigits);
}

/** Group digits nicely as the customer types (groups of 3). */
export function groupDigits(digits: string): string {
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

/** Formats a complete E.164 phone number nicely for display. */
export function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}


/** Registration asks for the customer's full name, so one word is not enough. */
export function normaliseName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length < 3) return null;
  if (name.split(' ').length < 2) return null;
  if (!/^[\p{L}][\p{L}'’.\- ]*$/u.test(name)) return null;
  return name;
}

/** "Jean Paul Uwase" -> "JU", for the profile avatar. */
export function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return `${first}${last}`.toUpperCase();
}
