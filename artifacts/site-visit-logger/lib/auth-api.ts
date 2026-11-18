import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { clearTokens, getRefreshToken, storeTokens } from '@/lib/auth-session';

export type ApiUser = {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';
  email?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthTokensResponse = {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
};

const CACHED_USER_KEY = 'fundi.auth.cached-user';

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Retrieve cached user stored on this device. */
export async function getCachedUser(): Promise<ApiUser | null> {
  try {
    const raw = isWeb()
      ? window.localStorage.getItem(CACHED_USER_KEY)
      : await AsyncStorage.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Cache the user profile on disk. */
export async function setCachedUser(user: ApiUser | null): Promise<void> {
  try {
    if (user) {
      const serialized = JSON.stringify(user);
      if (isWeb()) {
        window.localStorage.setItem(CACHED_USER_KEY, serialized);
      }
      await AsyncStorage.setItem(CACHED_USER_KEY, serialized);
    } else {
      if (isWeb()) {
        window.localStorage.removeItem(CACHED_USER_KEY);
      }
      await AsyncStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {}
}

/** Normalizes phone numbers to standard Rwandan (+25078/79/72/73) or international E.164. */
export function cleanAndNormalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s()-]/g, '');
  // Rwandan local format e.g. 0788123456 -> +250788123456
  if (/^0(78|79|72|73)\d{7}$/.test(cleaned)) {
    return `+250${cleaned.slice(1)}`;
  }
  // Missing dial code e.g. 788123456 -> +250788123456
  if (/^(78|79|72|73)\d{7}$/.test(cleaned)) {
    return `+250${cleaned}`;
  }
  return cleaned;
}

/**
 * Registers a new account with Full Name, Phone Number, and optional role/email.
 * Calls backend POST /api/v1/auth/register.
 * Dispatches initial OTP for customer accounts so verification can proceed immediately.
 */
export async function register(
  fullName: string,
  phoneNumber: string,
  email?: string,
  role: 'CUSTOMER' | 'TECHNICIAN' = 'CUSTOMER',
): Promise<{ message: string; user: ApiUser; phoneNumber: string }> {
  const normalizedPhone = cleanAndNormalizePhone(phoneNumber);
  const trimmedName = fullName.trim();
  const trimmedEmail = email?.trim().toLowerCase() || undefined;

  const payload: {
    fullName: string;
    phoneNumber: string;
    email?: string;
    role?: 'CUSTOMER' | 'TECHNICIAN';
  } = {
    fullName: trimmedName,
    phoneNumber: normalizedPhone,
    role,
  };
  if (trimmedEmail) {
    payload.email = trimmedEmail;
  }

  // 1. Register with backend
  const response = await apiRequest<{ message: string; user: ApiUser }>('/api/v1/auth/register', {
    method: 'POST',
    body: payload,
  });

  // 2. Customer registration in NestJS does not dispatch an OTP automatically.
  // Dispatch a login OTP for customers so they transition directly to OTP entry.
  // Technician accounts in NestJS already receive an OTP during register.
  if (role !== 'TECHNICIAN') {
    try {
      await requestLoginOtp(normalizedPhone);
    } catch (otpErr) {
      console.warn('Could not trigger initial customer OTP automatically:', otpErr);
    }
  }

  return {
    message: response.message,
    user: response.user,
    phoneNumber: normalizedPhone,
  };
}

/**
 * Requests a login OTP for an existing account.
 * Calls backend POST /api/v1/auth/login.
 */
export async function requestLoginOtp(phoneNumber: string): Promise<{ message: string }> {
  const normalizedPhone = cleanAndNormalizePhone(phoneNumber);
  return apiRequest<{ message: string }>('/api/v1/auth/login', {
    method: 'POST',
    body: { phoneNumber: normalizedPhone },
  });
}

/**
 * Verifies a 6-digit OTP and retrieves access and refresh JWT tokens.
 * Calls backend POST /api/v1/auth/verify-otp.
 */
export async function verifyOtp(phoneNumber: string, otp: string): Promise<AuthTokensResponse> {
  const normalizedPhone = cleanAndNormalizePhone(phoneNumber);
  const cleanOtp = otp.trim();

  const response = await apiRequest<AuthTokensResponse>('/api/v1/auth/verify-otp', {
    method: 'POST',
    body: {
      phoneNumber: normalizedPhone,
      otp: cleanOtp,
    },
  });

  if (response.accessToken && response.refreshToken) {
    await storeTokens(response.accessToken, response.refreshToken);
    await setCachedUser(response.user);
  }

  return response;
}

/**
 * Resends a pending OTP.
 * Calls backend POST /api/v1/auth/resend-otp.
 */
export async function resendOtp(phoneNumber: string): Promise<{ message: string }> {
  const normalizedPhone = cleanAndNormalizePhone(phoneNumber);
  return apiRequest<{ message: string }>('/api/v1/auth/resend-otp', {
    method: 'POST',
    body: { phoneNumber: normalizedPhone },
  });
}

/**
 * Exchanges a valid refresh token for a new access and refresh token pair.
 * Calls backend POST /api/v1/auth/refresh.
 */
export async function refreshTokens(): Promise<AuthTokensResponse> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available.');
  }

  const response = await apiRequest<AuthTokensResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });

  if (response.accessToken && response.refreshToken) {
    await storeTokens(response.accessToken, response.refreshToken);
    await setCachedUser(response.user);
  }

  return response;
}

/**
 * Restores the active user session on app launch.
 * Calls GET /api/v1/auth/me; falls back to POST /api/v1/auth/refresh if 401.
 */
export async function restoreSession(): Promise<ApiUser | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearTokens();
    await setCachedUser(null);
    return null;
  }

  try {
    const user = await apiRequest<ApiUser>('/api/v1/auth/me', {
      authenticated: true,
    });
    await setCachedUser(user);
    return user;
  } catch (error) {
    // If access token expired (401), attempt to rotate via refresh token
    if (error instanceof ApiRequestError && error.status === 401) {
      try {
        const refreshed = await refreshTokens();
        return refreshed.user;
      } catch {
        // Refresh token was invalid, expired or revoked
        await clearTokens();
        await setCachedUser(null);
        return null;
      }
    }

    // If device is offline or temporary network failure, fall back to cached user
    const cached = await getCachedUser();
    if (cached) return cached;

    return null;
  }
}

/**
 * Revokes the server session and clears local credentials.
 * Calls backend POST /api/v1/auth/logout.
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await apiRequest<{ message: string }>('/api/v1/auth/logout', {
        method: 'POST',
        authenticated: true,
        body: { refreshToken },
      }).catch(() => undefined);
    }
  } finally {
    await clearTokens();
    await setCachedUser(null);
  }
}

/**
 * Permanently deletes the account on the backend and clears local storage.
 * Calls backend DELETE /api/v1/users/me.
 */
export async function deleteCurrentAccount(): Promise<void> {
  try {
    await apiRequest<{ message: string }>('/api/v1/users/me', {
      method: 'DELETE',
      authenticated: true,
    });
  } finally {
    await clearTokens();
    await setCachedUser(null);
  }
}

/**
 * Switches the signed-in account between hiring (CUSTOMER) and working (TECHNICIAN).
 * Calls backend PATCH /api/v1/users/me/role. The API allows TECHNICIAN only once the
 * technician application is approved, and refuses CUSTOMER while technician jobs are
 * still assigned or paused (409 with a message the app shows as it is).
 */
export async function switchUserRole(newRole: 'CUSTOMER' | 'TECHNICIAN'): Promise<ApiUser | null> {
  await apiRequest<{ role: 'CUSTOMER' | 'TECHNICIAN'; changed: boolean }>('/api/v1/users/me/role', {
    method: 'PATCH',
    authenticated: true,
    body: { role: newRole },
  });
  const cached = await getCachedUser();
  if (cached) {
    const updated: ApiUser = { ...cached, role: newRole };
    await setCachedUser(updated);
    return updated;
  }
  return null;
}

/** Legacy / backward-compatibility aliases */
export async function findUserByPhone(phone: string): Promise<ApiUser | null> {
  const cached = await getCachedUser();
  if (cached && cleanAndNormalizePhone(cached.phoneNumber) === cleanAndNormalizePhone(phone)) {
    return cached;
  }
  return null;
}

/**
 * Signs in a customer or verified technician using their phone number and PIN.
 * Calls backend POST /api/v1/auth/login/pin.
 */
export async function loginWithPin(phoneNumber: string, pin: string): Promise<AuthTokensResponse> {
  const normalizedPhone = cleanAndNormalizePhone(phoneNumber);
  const cleanPin = pin.trim();

  const response = await apiRequest<AuthTokensResponse>('/api/v1/auth/login/pin', {
    method: 'POST',
    body: {
      phoneNumber: normalizedPhone,
      pin: cleanPin,
    },
  });

  if (response.accessToken && response.refreshToken) {
    await storeTokens(response.accessToken, response.refreshToken);
    await setCachedUser(response.user);
  }

  return response;
}

/**
 * Registers a new customer account using their phone number and a PIN.
 * Calls backend POST /api/v1/auth/register/pin, then immediately logs them in.
 */
export async function registerWithPin(
  fullName: string,
  phoneNumber: string,
  pin: string,
): Promise<AuthTokensResponse> {
  const normalizedPhone = cleanAndNormalizePhone(phoneNumber);
  const trimmedName = fullName.trim();
  const cleanPin = pin.trim();

  await apiRequest<{ message: string; user: ApiUser }>('/api/v1/auth/register/pin', {
    method: 'POST',
    body: {
      fullName: trimmedName,
      phoneNumber: normalizedPhone,
      pin: cleanPin,
    },
  });

  return loginWithPin(normalizedPhone, cleanPin);
}

/**
 * Signs in an account using a password.
 * Calls backend POST /api/v1/auth/login/password.
 */
export async function loginWithPassword(phoneNumber: string, password: string): Promise<AuthTokensResponse> {
  const normalizedPhone = cleanAndNormalizePhone(phoneNumber);

  const response = await apiRequest<AuthTokensResponse>('/api/v1/auth/login/password', {
    method: 'POST',
    body: {
      phoneNumber: normalizedPhone,
      password,
    },
  });

  if (response.accessToken && response.refreshToken) {
    await storeTokens(response.accessToken, response.refreshToken);
    await setCachedUser(response.user);
  }

  return response;
}

/**
 * Replaces a forgotten PIN using the SMS code from requestLoginOtp, and signs in.
 * Calls backend POST /api/v1/auth/pin/reset. Any other session for the account ends.
 */
export async function resetPin(phoneNumber: string, otp: string, newPin: string): Promise<AuthTokensResponse> {
  const response = await apiRequest<AuthTokensResponse>('/api/v1/auth/pin/reset', {
    method: 'POST',
    body: { phoneNumber: cleanAndNormalizePhone(phoneNumber), otp: otp.trim(), newPin: newPin.trim() },
  });
  if (response.accessToken && response.refreshToken) {
    await storeTokens(response.accessToken, response.refreshToken);
    await setCachedUser(response.user);
  }
  return response;
}

/**
 * Changes the signed-in account's PIN.
 * Calls backend PATCH /api/v1/auth/pin.
 */
export function changePin(currentPin: string, newPin: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/v1/auth/pin', {
    method: 'PATCH',
    authenticated: true,
    body: { currentPin: currentPin.trim(), newPin: newPin.trim() },
  });
}
