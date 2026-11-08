import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normaliseName, PHONE_RULE } from '@/constants/auth';
import { DEFAULT_LOCATION } from '@/constants/profile';
import { jobsKey, PENDING_KEY, workKey } from '@/constants/storage';
import {
  cleanAndNormalizePhone,
  deleteCurrentAccount,
  loginWithPin,
  logout as logoutApi,
  refreshTokens,
  register as registerApi,
  registerWithPin,
  requestLoginOtp,
  resendOtp,
  restoreSession,
  updateUserRole,
  verifyOtp,
  type ApiUser,
} from '@/lib/auth-api';

/** A registered customer or technician. */
export type Account = {
  id: string;
  phone: string;
  name: string;
  location: string;
  createdAt: string;
  role: string;
};

export type Verification = {
  phone: string;
  intent: 'register' | 'login';
  sentAt: string;
};

type AuthContextValue = {
  /** The signed-in account, or null when nobody is signed in. */
  account: Account | null;
  /** Verification state for 6-digit OTP confirmation. */
  verification: Verification | null;
  /** False until stored session has been checked. */
  isHydrated: boolean;
  /** Creates an account with Full Name, Phone, and optional role/email, then dispatches verification OTP. */
  register: (
    name: string,
    phone: string,
    emailOrPin?: string,
    role?: 'CUSTOMER' | 'TECHNICIAN',
  ) => Promise<void>;
  /** Requests a 6-digit login OTP for the registered phone number. */
  login: (phone: string, optionalPin?: string) => Promise<void>;
  /** Explicitly sends a 6-digit login SMS OTP code. */
  loginWithOtp: (phone: string) => Promise<void>;
  /** Updates the active account role (e.g. promoting to TECHNICIAN). */
  updateRole: (role: 'CUSTOMER' | 'TECHNICIAN') => Promise<void>;
  /** Resends the pending 6-digit OTP code. */
  resendCode: () => Promise<void>;
  /** Verifies the 6-digit code with the backend. */
  verifyCode: (entered: string) => Promise<void>;
  /** Cancels the ongoing verification and returns to the initial auth screen. */
  cancelVerification: () => Promise<void>;
  /** Ends the session by revoking the refresh token and clearing local tokens. */
  signOut: () => Promise<void>;
  /** Permanently deletes the account on the backend. */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
        const rawPending = await AsyncStorage.getItem(PENDING_KEY);
        if (rawPending) {
          try {
            const parsed = JSON.parse(rawPending) as Verification;
            if (parsed?.phone && parsed?.sentAt) {
              if (mounted) setVerification(parsed);
            }
          } catch {}
        }

        const user = await restoreSession();
        if (mounted) {
          setAccount(user ? accountFromApi(user) : null);
          if (user) {
            setVerification(null);
            await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
          }
        }
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

  const register = useCallback(
    async (
      nameInput: string,
      phoneInput: string,
      emailOrPin?: string,
      role: 'CUSTOMER' | 'TECHNICIAN' = 'CUSTOMER',
    ) => {
      const name = normaliseName(nameInput);
      if (!name) throw new Error('Enter your full name (first and last name).');
      const cleanPhone = phoneInput.trim();
      if (!cleanPhone || cleanPhone.length < 7) throw new Error(PHONE_RULE);

      const isPin = emailOrPin && /^\d{4,6}$/.test(emailOrPin.trim());
      if (isPin && role === 'CUSTOMER') {
        const session = await registerWithPin(name, cleanPhone, emailOrPin.trim());
        setAccount(accountFromApi(session.user));
        setVerification(null);
        await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
        return;
      }

      const email = emailOrPin && emailOrPin.includes('@') ? emailOrPin : undefined;

      const res = await registerApi(name, cleanPhone, email, role);
      const pending: Verification = {
        phone: res.phoneNumber,
        intent: 'register',
        sentAt: new Date().toISOString(),
      };
      setVerification(pending);
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending)).catch(() => undefined);
    },
    [],
  );

  const login = useCallback(async (phoneInput: string, optionalPin?: string) => {
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone || cleanPhone.length < 7) throw new Error(PHONE_RULE);

    if (optionalPin && /^\d{4,6}$/.test(optionalPin.trim())) {
      const session = await loginWithPin(cleanPhone, optionalPin.trim());
      setAccount(accountFromApi(session.user));
      setVerification(null);
      await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
      return;
    }

    await requestLoginOtp(cleanPhone);
    const normalized = cleanAndNormalizePhone(cleanPhone);
    const pending: Verification = {
      phone: normalized,
      intent: 'login',
      sentAt: new Date().toISOString(),
    };
    setVerification(pending);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending)).catch(() => undefined);
  }, []);

  const loginWithOtp = useCallback(async (phoneInput: string) => {
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone || cleanPhone.length < 7) throw new Error(PHONE_RULE);

    await requestLoginOtp(cleanPhone);
    const normalized = cleanAndNormalizePhone(cleanPhone);
    const pending: Verification = {
      phone: normalized,
      intent: 'login',
      sentAt: new Date().toISOString(),
    };
    setVerification(pending);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending)).catch(() => undefined);
  }, []);

  const updateRole = useCallback(
    async (newRole: 'CUSTOMER' | 'TECHNICIAN') => {
      if (!account) return;
      await updateUserRole(account.phone, newRole);
      setAccount((prev) => (prev ? { ...prev, role: newRole } : null));
    },
    [account],
  );

  const resendCode = useCallback(async () => {
    if (!verification) throw new Error('No pending verification found.');
    await resendOtp(verification.phone);
    const updated: Verification = {
      ...verification,
      sentAt: new Date().toISOString(),
    };
    setVerification(updated);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(updated)).catch(() => undefined);
  }, [verification]);

  const verifyCode = useCallback(
    async (entered: string) => {
      if (!verification) {
        throw new Error('No verification is pending. Please request a new code.');
      }
      const cleanCode = entered.trim();
      if (cleanCode.length !== 6) {
        throw new Error('Please enter the full 6-digit verification code.');
      }

      const session = await verifyOtp(verification.phone, cleanCode);
      setAccount(accountFromApi(session.user));
      setVerification(null);
      await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
    },
    [verification],
  );

  const cancelVerification = useCallback(async () => {
    setVerification(null);
    await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setAccount(null);
      setVerification(null);
      await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!account) return;
    try {
      await deleteCurrentAccount();
    } finally {
      const phone = account.phone;
      setAccount(null);
      setVerification(null);
      await AsyncStorage.multiRemove([PENDING_KEY, jobsKey(phone), workKey(phone)]).catch(() => undefined);
    }
  }, [account]);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      verification,
      isHydrated,
      register,
      login,
      loginWithOtp,
      updateRole,
      resendCode,
      verifyCode,
      cancelVerification,
      signOut,
      deleteAccount,
    }),
    [
      account,
      cancelVerification,
      deleteAccount,
      isHydrated,
      login,
      loginWithOtp,
      register,
      resendCode,
      signOut,
      updateRole,
      verification,
      verifyCode,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
