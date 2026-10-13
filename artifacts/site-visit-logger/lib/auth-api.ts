import { ApiRequestError } from '@/lib/api';
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

const MOCK_USER_STORAGE_KEY = 'fundi.mock-auth-user';

// --- 6 MOCK TEST USERS ---
const TEST_USERS: Record<string, ApiUser> = {
  // 1. Pure Client 1
  '+250788111111': { id: 'user-client-1', fullName: 'Alice Uwase', phoneNumber: '+250788111111', role: 'CUSTOMER', createdAt: new Date().toISOString() },
  // 2. Pure Client 2
  '+250788222222': { id: 'user-client-2', fullName: 'Eric Mugabo', phoneNumber: '+250788222222', role: 'CUSTOMER', createdAt: new Date().toISOString() },
  // 3. Dual Role: Client & Technician (Can slide/switch or apply)
  '+250788333333': { id: 'user-dual-3', fullName: 'Gédéon Irankunda', phoneNumber: '+250788333333', role: 'CUSTOMER', createdAt: new Date().toISOString() },
  // 4. Dedicated Technician 1
  '+250788444444': { id: 'user-tech-4', fullName: 'Jean Paul Nkurunziza', phoneNumber: '+250788444444', role: 'TECHNICIAN', createdAt: new Date().toISOString() },
  // 5. Dedicated Technician 2
  '+250788555555': { id: 'user-tech-5', fullName: 'Claude Habimana', phoneNumber: '+250788555555', role: 'TECHNICIAN', createdAt: new Date().toISOString() },
  // 6. Dedicated Technician 3
  '+250788666666': { id: 'user-tech-6', fullName: 'Patrick Bizimana', phoneNumber: '+250788666666', role: 'TECHNICIAN', createdAt: new Date().toISOString() },
};

export async function startRegistration(
  fullName: string,
  phoneNumber: string,
  role: 'CUSTOMER' | 'TECHNICIAN' = 'CUSTOMER',
): Promise<void> {
  const newUser: ApiUser = {
    id: 'mock-user-' + Date.now(),
    fullName,
    phoneNumber,
    role,
    createdAt: new Date().toISOString(),
  };
  if (PlatformOS() === 'web') {
    window.localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(newUser));
  }
  return Promise.resolve();
}

export async function startLogin(phoneNumber: string): Promise<void> {
  const cleanedPhone = phoneNumber.trim();
  const matchedUser = TEST_USERS[cleanedPhone];
  
  if (PlatformOS() === 'web' && matchedUser) {
    window.localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(matchedUser));
  }
  return Promise.resolve();
}

export async function resendOtp(phoneNumber: string): Promise<void> {
  return Promise.resolve();
}

export async function verifyOtp(phoneNumber: string, otp: string): Promise<TokenResponse> {
  const cleanedPhone = phoneNumber.trim();
  let user: ApiUser = TEST_USERS[cleanedPhone] || {
    id: 'mock-user-custom',
    fullName: 'Test User',
    phoneNumber: cleanedPhone,
    role: 'CUSTOMER',
    createdAt: new Date().toISOString(),
  };

  if (PlatformOS() === 'web') {
    const raw = window.localStorage.getItem(MOCK_USER_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.phoneNumber === cleanedPhone) {
          user = parsed;
        }
      } catch {}
    }
  }

  const session: TokenResponse = {
    user,
    accessToken: 'mock-access-token-' + user.id,
    refreshToken: 'mock-refresh-token-' + user.id,
  };

  await storeTokens(session.accessToken, session.refreshToken);
  return session;
}

export async function restoreSession(): Promise<ApiUser | null> {
  const token = await getRefreshToken();
  if (!token) return null;
  
  if (PlatformOS() === 'web') {
    const raw = window.localStorage.getItem(MOCK_USER_STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
  }

  // Default fallback user if none stored
  return TEST_USERS['+250788333333'];
}

export async function logout(): Promise<void> {
  await clearTokens();
}

export async function deleteCurrentAccount(): Promise<void> {
  await clearTokens();
}

function PlatformOS() {
  return typeof window !== 'undefined' ? 'web' : 'native';
}