import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normaliseName, PHONE_RULE } from '@/constants/auth';
import { DEFAULT_LOCATION } from '@/constants/profile';
import { ACCOUNTS_KEY, jobsKey, PENDING_KEY, SESSION_KEY, workKey } from '@/constants/storage';
import {
  deleteCurrentAccount,
  loginWithPin,
  logout as logoutApi,
  registerWithPin,
  restoreSession,
  updateUserRole,
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
  /** Verification state (legacy compatibility). */
  verification: Verification | null;
  /** False until stored session has been checked. */
  isHydrated: boolean;
  /** Creates an account with Full Name, Phone, and 5-digit PIN. */
  register: (name: string, phone: string, pin: string, role?: 'CUSTOMER' | 'TECHNICIAN') => Promise<void>;
  /** Signs in with Phone and 5-digit PIN. */
  login: (phone: string, pin: string) => Promise<void>;
  /** Updates the active account role (e.g. promoting to TECHNICIAN). */
  updateRole: (role: 'CUSTOMER' | 'TECHNICIAN') => Promise<void>;
  /** Optional legacy helpers for compatibility */
  resendCode: () => Promise<void>;
  verifyCode: (entered: string) => Promise<void>;
  cancelVerification: () => Promise<void>;
  /** Ends the session. */
  signOut: () => Promise<void>;
  /** Removes the account. */
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
        await AsyncStorage.multiRemove([PENDING_KEY, ACCOUNTS_KEY, SESSION_KEY]);
      } catch {}

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

  const register = useCallback(
    async (nameInput: string, phoneInput: string, pinInput: string, role: 'CUSTOMER' | 'TECHNICIAN' = 'CUSTOMER') => {
      const name = normaliseName(nameInput);
      if (!name) throw new Error('Enter your full name (first and last name).');
      const cleanPhone = phoneInput.trim();
      if (!cleanPhone || cleanPhone.length < 7) throw new Error(PHONE_RULE);
      const cleanPin = pinInput.trim();
      if (cleanPin.length !== 5 || !/^\d{5}$/.test(cleanPin)) {
        throw new Error('PIN must be exactly 5 digits.');
      }

      const session = await registerWithPin(name, cleanPhone, cleanPin, role);
      setAccount(accountFromApi(session.user));
      setVerification(null);
    },
    [],
  );

  const login = useCallback(async (phoneInput: string, pinInput: string) => {
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone || cleanPhone.length < 7) throw new Error(PHONE_RULE);
    const cleanPin = pinInput.trim();
    if (cleanPin.length !== 5 || !/^\d{5}$/.test(cleanPin)) {
      throw new Error('Please enter your 5-digit PIN.');
    }

    const session = await loginWithPin(cleanPhone, cleanPin);
    setAccount(accountFromApi(session.user));
    setVerification(null);
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
    // No-op for PIN auth
  }, []);

  const verifyCode = useCallback(async (_entered: string) => {
    // No-op for PIN auth
  }, []);

  const cancelVerification = useCallback(async () => {
    setVerification(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setAccount(null);
      setVerification(null);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!account) return;
    await deleteCurrentAccount();
    setAccount(null);
    setVerification(null);
    await AsyncStorage.multiRemove([jobsKey(account.phone), workKey(account.phone)]);
  }, [account]);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      verification,
      isHydrated,
      register,
      login,
      updateRole,
      resendCode,
      verifyCode,
      cancelVerification,
      signOut,
      deleteAccount,
    }),
    [account, cancelVerification, deleteAccount, isHydrated, login, register, resendCode, signOut, updateRole, verification, verifyCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
