import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normaliseName, normalisePhone, OTP_LENGTH, PHONE_RULE, RESEND_AFTER_MS } from '@/constants/auth';
import { DEFAULT_LOCATION } from '@/constants/profile';
import { ACCOUNTS_KEY, jobsKey, PENDING_KEY, SESSION_KEY, workKey } from '@/constants/storage';
import {
  deleteCurrentAccount,
  logout as logoutApi,
  resendOtp,
  restoreSession,
  startLogin,
  startRegistration,
  verifyOtp,
  type ApiUser,
} from '@/lib/auth-api';

/** A registered customer. The phone number is the identity and the record key. */
export type Account = {
  id: string;
  /** E.164, e.g. +250788123456. */
  phone: string;
  name: string;
  location: string;
  createdAt: string;
  role: string;
};

/** A backend-issued OTP is pending for this phone; the code stays server-side. */
export type Verification = {
  phone: string;
  intent: 'register' | 'login';
  sentAt: string;
};

type AuthContextValue = {
  /** The signed-in account, or null when nobody is signed in. */
  account: Account | null;
  /** Set once a code has been sent, cleared on success or when abandoned. */
  verification: Verification | null;
  /** False until the stored session has been read back from the device. */
  isHydrated: boolean;
  /** Creates an account through the backend and requests an OTP. */
  register: (name: string, phone: string) => Promise<void>;
  /** Signs straight back in on a number that already has an account. */
  login: (phone: string) => Promise<void>;
  resendCode: () => Promise<void>;
  /** Verifies the backend OTP and starts a token-backed session. */
  verifyCode: (entered: string) => Promise<void>;
  /** Drops the pending code so the customer can start over. */
  cancelVerification: () => Promise<void>;
  /** Ends the session. The account and its jobs stay on the device. */
  signOut: () => Promise<void>;
  /** Removes the account and everything stored for it on this device. */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseVerification(raw: string | null): Verification | null {
  const stored = parse<Partial<Verification>>(raw);
  if (
    !stored ||
    typeof stored.phone !== 'string' ||
    (stored.intent !== 'register' && stored.intent !== 'login') ||
    typeof stored.sentAt !== 'string'
  ) {
    return null;
  }
  return { phone: stored.phone, intent: stored.intent, sentAt: stored.sentAt };
}

function accountFromApi(user: ApiUser): Account {
  return {
    id: user.id,
    phone: user.phoneNumber,
    name: user.fullName,
    location: DEFAULT_LOCATION,
    createdAt: user.createdAt ?? new Date().toISOString(),
    role: user.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      try {
        const pending = await AsyncStorage.getItem(PENDING_KEY);
        const sanitized = parseVerification(pending);
        if (mounted) setVerification(sanitized);
        if (sanitized) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(sanitized));
        else await AsyncStorage.removeItem(PENDING_KEY);
        await AsyncStorage.multiRemove([ACCOUNTS_KEY, SESSION_KEY]);
      } catch {
        if (mounted) setVerification(null);
      }

      try {
        const user = await restoreSession();
        if (mounted) setAccount(user ? accountFromApi(user) : null);
      } catch {
        if (mounted) setAccount(null);
      } finally {
        if (mounted) setIsHydrated(true);
      }
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const rememberVerification = useCallback(async (next: Verification | null) => {
    setVerification(next);
    try {
      if (next) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
      else await AsyncStorage.removeItem(PENDING_KEY);
    } catch {
      // The pending phone is non-secret; a local storage failure need not block auth.
    }
  }, []);

  const register = useCallback(
    async (nameInput: string, phoneInput: string) => {
      const name = normaliseName(nameInput);
      if (!name) throw new Error('Enter your full name, first and last.');
      const number = normalisePhone(phoneInput);
      if (!number) throw new Error(PHONE_RULE);
      await startRegistration(name, number);
      await rememberVerification({
        phone: number,
        intent: 'register',
        sentAt: new Date().toISOString(),
      });
    },
    [rememberVerification],
  );

  const login = useCallback(
    async (phoneInput: string) => {
      const number = normalisePhone(phoneInput);
      if (!number) throw new Error(PHONE_RULE);
      await startLogin(number);
      await rememberVerification({
        phone: number,
        intent: 'login',
        sentAt: new Date().toISOString(),
      });
    },
    [rememberVerification],
  );

  const resendCode = useCallback(async () => {
    if (!verification) throw new Error('Enter your phone number to get a code.');
    const waited = Date.now() - new Date(verification.sentAt).getTime();
    if (waited < RESEND_AFTER_MS) {
      const seconds = Math.ceil((RESEND_AFTER_MS - waited) / 1000);
      throw new Error(`You can ask for a new code in ${seconds}s.`);
    }
    await resendOtp(verification.phone);
    await rememberVerification({
      ...verification,
      sentAt: new Date().toISOString(),
    });
  }, [rememberVerification, verification]);

  const verifyCode = useCallback(
    async (entered: string) => {
      if (!verification) throw new Error('Enter your phone number to get a code.');
      const code = entered.replace(/\D/g, '');
      if (code.length !== OTP_LENGTH) throw new Error(`Enter the ${OTP_LENGTH}-digit code we sent you.`);
      const session = await verifyOtp(verification.phone, code);
      setAccount(accountFromApi(session.user));
      await rememberVerification(null);
    },
    [rememberVerification, verification],
  );

  const cancelVerification = useCallback(async () => {
    await rememberVerification(null);
  }, [rememberVerification]);

  const signOut = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setAccount(null);
      await rememberVerification(null);
    }
  }, [rememberVerification]);

  const deleteAccount = useCallback(async () => {
    if (!account) return;
    await deleteCurrentAccount();
    setAccount(null);
    await rememberVerification(null);
    await AsyncStorage.multiRemove([jobsKey(account.phone), workKey(account.phone)]);
  }, [account, rememberVerification]);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      verification,
      isHydrated,
      register,
      login,
      resendCode,
      verifyCode,
      cancelVerification,
      signOut,
      deleteAccount,
    }),
    [account, cancelVerification, deleteAccount, isHydrated, login, register, resendCode, signOut, verification, verifyCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
