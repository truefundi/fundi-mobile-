import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearTokens, getRefreshToken, storeTokens } from '@/lib/auth-session';

export type ApiUser = {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  pin: string;
  createdAt?: string;
};

type TokenResponse = {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
};

const MOCK_CURRENT_USER_KEY = 'fundi.mock-auth-current-user';
const MOCK_CUSTOM_USERS_KEY = 'fundi.mock-custom-users';

// --- 6 DEFAULT TEST USERS (Default PIN: 12345) ---
export const TEST_USERS: Record<string, ApiUser> = {
  // 1. Pure Client 1
  '+250788111111': {
    id: 'user-client-1',
    fullName: 'Alice Uwase',
    phoneNumber: '+250788111111',
    role: 'CUSTOMER',
    pin: '12345',
    createdAt: new Date().toISOString(),
  },
  // 2. Pure Client 2
  '+250788222222': {
    id: 'user-client-2',
    fullName: 'Eric Mugabo',
    phoneNumber: '+250788222222',
    role: 'CUSTOMER',
    pin: '12345',
    createdAt: new Date().toISOString(),
  },
  // 3. Dual Role: Client & Technician
  '+250788333333': {
    id: 'user-dual-3',
    fullName: 'Gédéon Irankunda',
    phoneNumber: '+250788333333',
    role: 'CUSTOMER',
    pin: '12345',
    createdAt: new Date().toISOString(),
  },
  // 4. Dedicated Technician 1
  '+250788444444': {
    id: 'user-tech-4',
    fullName: 'Jean Paul Nkurunziza',
    phoneNumber: '+250788444444',
    role: 'TECHNICIAN',
    pin: '12345',
    createdAt: new Date().toISOString(),
  },
  // 5. Dedicated Technician 2
  '+250788555555': {
    id: 'user-tech-5',
    fullName: 'Claude Habimana',
    phoneNumber: '+250788555555',
    role: 'TECHNICIAN',
    pin: '12345',
    createdAt: new Date().toISOString(),
  },
  // 6. Dedicated Technician 3
  '+250788666666': {
    id: 'user-tech-6',
    fullName: 'Patrick Bizimana',
    phoneNumber: '+250788666666',
    role: 'TECHNICIAN',
    pin: '12345',
    createdAt: new Date().toISOString(),
  },
};

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Retrieve all custom users registered on this device. */
async function getStoredUsers(): Promise<Record<string, ApiUser>> {
  try {
    const raw = isWeb()
      ? window.localStorage.getItem(MOCK_CUSTOM_USERS_KEY)
      : await AsyncStorage.getItem(MOCK_CUSTOM_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Save updated user store. */
async function saveStoredUsers(users: Record<string, ApiUser>): Promise<void> {
  const serialized = JSON.stringify(users);
  try {
    if (isWeb()) {
      window.localStorage.setItem(MOCK_CUSTOM_USERS_KEY, serialized);
    }
    await AsyncStorage.setItem(MOCK_CUSTOM_USERS_KEY, serialized);
  } catch {}
}

/** Find user by normalized phone from test users or custom registered users. */
export async function findUserByPhone(phone: string): Promise<ApiUser | null> {
  const cleaned = phone.trim();
  if (TEST_USERS[cleaned]) return TEST_USERS[cleaned];
  const customUsers = await getStoredUsers();
  return customUsers[cleaned] ?? null;
}

/**
 * Register a user with Full Name, Phone Number, and 5-digit PIN.
 */
export async function registerWithPin(
  fullName: string,
  phoneNumber: string,
  pin: string,
  role: 'CUSTOMER' | 'TECHNICIAN' = 'CUSTOMER',
): Promise<TokenResponse> {
  const cleanedPhone = phoneNumber.trim();
  const existing = await findUserByPhone(cleanedPhone);
  if (existing) {
    throw new Error('An account with this phone number already exists. Please login.');
  }

  const cleanPin = pin.trim();
  if (cleanPin.length !== 5 || !/^\d{5}$/.test(cleanPin)) {
    throw new Error('PIN must be exactly 5 digits.');
  }

  const newUser: ApiUser = {
    id: `user-${Date.now()}`,
    fullName: fullName.trim(),
    phoneNumber: cleanedPhone,
    role,
    pin: cleanPin,
    createdAt: new Date().toISOString(),
  };

  const stored = await getStoredUsers();
  stored[cleanedPhone] = newUser;
  await saveStoredUsers(stored);

  // Set as current session
  if (isWeb()) {
    window.localStorage.setItem(MOCK_CURRENT_USER_KEY, JSON.stringify(newUser));
  }
  await AsyncStorage.setItem(MOCK_CURRENT_USER_KEY, JSON.stringify(newUser));

  const session: TokenResponse = {
    user: newUser,
    accessToken: `mock-jwt-access-${newUser.id}`,
    refreshToken: `mock-jwt-refresh-${newUser.id}`,
  };

  await storeTokens(session.accessToken, session.refreshToken);
  return session;
}

/**
 * Login a user with Phone Number and 5-digit PIN.
 */
export async function loginWithPin(phoneNumber: string, pin: string): Promise<TokenResponse> {
  const cleanedPhone = phoneNumber.trim();
  const user = await findUserByPhone(cleanedPhone);

  if (!user) {
    throw new Error('No account found with this phone number. Please register.');
  }

  const cleanPin = pin.trim();
  if (user.pin !== cleanPin) {
    throw new Error('Incorrect PIN. Please try again.');
  }

  // Set as current session
  if (isWeb()) {
    window.localStorage.setItem(MOCK_CURRENT_USER_KEY, JSON.stringify(user));
  }
  await AsyncStorage.setItem(MOCK_CURRENT_USER_KEY, JSON.stringify(user));

  const session: TokenResponse = {
    user,
    accessToken: `mock-jwt-access-${user.id}`,
    refreshToken: `mock-jwt-refresh-${user.id}`,
  };

  await storeTokens(session.accessToken, session.refreshToken);
  return session;
}

/**
 * Restore active session upon app launch.
 */
export async function restoreSession(): Promise<ApiUser | null> {
  const token = await getRefreshToken();
  if (!token) return null;

  try {
    const raw = isWeb()
      ? window.localStorage.getItem(MOCK_CURRENT_USER_KEY)
      : await AsyncStorage.getItem(MOCK_CURRENT_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.phoneNumber) {
        const found = await findUserByPhone(parsed.phoneNumber);
        if (found) return found;
      }
    }
  } catch {}

  // Fallback to demo user if token is present
  return TEST_USERS['+250788333333'] ?? null;
}

export async function logout(): Promise<void> {
  if (isWeb()) {
    window.localStorage.removeItem(MOCK_CURRENT_USER_KEY);
  }
  await AsyncStorage.removeItem(MOCK_CURRENT_USER_KEY);
  await clearTokens();
}

export async function deleteCurrentAccount(): Promise<void> {
  await logout();
}