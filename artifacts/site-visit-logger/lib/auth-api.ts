import { ApiRequestError, apiRequest } from '@/lib/api';
import { clearTokens, getRefreshToken, storeTokens } from '@/lib/auth-session';

export type ApiUser = {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  createdAt?: string;
};

type TokenResponse = {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
};

type MessageResponse = { message: string };

export type AuthIntent = 'register' | 'login';

export async function startRegistration(fullName: string, phoneNumber: string): Promise<void> {
  await apiRequest<MessageResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: { fullName, phoneNumber },
  });
}

export async function startLogin(phoneNumber: string): Promise<void> {
  await apiRequest<MessageResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { phoneNumber },
  });
}

export async function resendOtp(phoneNumber: string): Promise<void> {
  await apiRequest<MessageResponse>('/api/v1/auth/resend-otp', {
    method: 'POST',
    body: { phoneNumber },
  });
}

export async function verifyOtp(phoneNumber: string, otp: string): Promise<TokenResponse> {
  const session = await apiRequest<TokenResponse>('/api/v1/auth/verify-otp', {
    method: 'POST',
    body: { phoneNumber, otp },
  });
  await storeTokens(session.accessToken, session.refreshToken);
  return session;
}

async function refreshSession(): Promise<TokenResponse> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new ApiRequestError('Your session has expired. Please sign in again.', 401);

  const session = await apiRequest<TokenResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
  await storeTokens(session.accessToken, session.refreshToken);
  return session;
}

export async function restoreSession(): Promise<ApiUser | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    return await apiRequest<ApiUser>('/api/v1/auth/me', { authenticated: true });
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) throw error;
  }

  try {
    const session = await refreshSession();
    return session.user;
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      await clearTokens();
      return null;
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) {
      try {
        await apiRequest<MessageResponse>('/api/v1/auth/logout', {
          method: 'POST',
          authenticated: true,
          body: { refreshToken },
        });
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 401) throw error;
        const session = await refreshSession();
        await apiRequest<MessageResponse>('/api/v1/auth/logout', {
          method: 'POST',
          authenticated: true,
          body: { refreshToken: session.refreshToken },
        });
      }
    }
  } finally {
    await clearTokens();
  }
}

export async function deleteCurrentAccount(): Promise<void> {
  await apiRequest<MessageResponse>('/api/v1/users/me', {
    method: 'DELETE',
    authenticated: true,
  });
  await clearTokens();
}