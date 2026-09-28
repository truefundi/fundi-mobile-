import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  formatPhone,
  makeCode,
  MAX_ATTEMPTS,
  normaliseName,
  normalisePhone,
  OTP_LENGTH,
  OTP_TTL_MS,
  PHONE_RULE,
  RESEND_AFTER_MS,
} from '@/constants/auth';
import { DEFAULT_LOCATION } from '@/constants/profile';
import { ACCOUNTS_KEY, jobsKey, PENDING_KEY, SESSION_KEY } from '@/constants/storage';

/** A registered customer. The phone number is the identity and the record key. */
export type Account = {
  /** E.164, e.g. +250788123456. */
  phone: string;
  name: string;
  location: string;
  createdAt: string;
};

/**
 * A phone number waiting on its code. Both ways in go through one: registering
 * proves the number is yours before an account exists, signing back in proves
 * it is still yours before the account opens.
 */
export type Verification = {
  phone: string;
  /** Which side of the flow is waiting — it decides the wording and the outcome. */
  intent: 'register' | 'login';
  /** The name to create the account with, or the existing account's name. */
  name: string;
  /**
   * The code is generated and checked on the device because no SMS gateway is
   * connected yet. A real backend sends the code and verifies it server-side —
   * it never travels to, or is stored by, the client.
   */
  code: string;
  sentAt: string;
  attemptsLeft: number;
};

type AuthContextValue = {
  /** The signed-in account, or null when nobody is signed in. */
  account: Account | null;
  /** Set once a code has been sent, cleared on success or when abandoned. */
  verification: Verification | null;
  /** False until the stored session has been read back from the device. */
  isHydrated: boolean;
  /** Registers a new number and sends its code. Rejects with a message fit to show. */
  register: (name: string, phone: string) => Promise<void>;
  /** Signs straight back in on a number that already has an account. */
  login: (phone: string) => Promise<void>;
  resendCode: () => Promise<void>;
  /** Creates the account and starts the session once the code checks out. */
  verifyCode: (entered: string) => Promise<void>;
  /** Drops the pending code so the customer can start over. */
  cancelVerification: () => Promise<void>;
  /** Ends the session. The account and its jobs stay on the device. */
  signOut: () => Promise<void>;
  /** Removes the account and everything stored for it on this device. */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type Accounts = Record<string, Account>;

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Accounts>({});
  const [phone, setPhone] = useState<string | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.multiGet([ACCOUNTS_KEY, SESSION_KEY, PENDING_KEY])
      .then((entries) => {
        if (!mounted) return;
        const stored = new Map(entries);
        setAccounts(parse<Accounts>(stored.get(ACCOUNTS_KEY) ?? null) ?? {});
        setPhone(parse<{ phone: string }>(stored.get(SESSION_KEY) ?? null)?.phone ?? null);
        setVerification(parse<Verification>(stored.get(PENDING_KEY) ?? null));
      })
      .catch(() => {
        // A storage failure means nobody is signed in, which is the safe default.
      })
      .finally(() => {
        if (mounted) setIsHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // A session pointing at a deleted account is no session at all.
  const account = phone ? (accounts[phone] ?? null) : null;

  /** Keeps the pending code across a reload so a refresh does not lose the step. */
  const rememberVerification = useCallback(async (next: Verification | null) => {
    setVerification(next);
    if (next) await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(PENDING_KEY);
  }, []);

  const register = useCallback(
    async (nameInput: string, phoneInput: string) => {
      const name = normaliseName(nameInput);
      if (!name) throw new Error('Enter your full name, first and last.');
      const number = normalisePhone(phoneInput);
      if (!number) throw new Error(PHONE_RULE);
      if (accounts[number]) {
        throw new Error(`${formatPhone(number)} already has an account. Log in instead.`);
      }
      await rememberVerification({
        phone: number,
        intent: 'register',
        name,
        code: makeCode(),
        sentAt: new Date().toISOString(),
        attemptsLeft: MAX_ATTEMPTS,
      });
    },
    [accounts, rememberVerification],
  );

  /**
   * Signing back in sends a code to the number and opens nothing until it is
   * entered, so knowing a registered number is not enough to reach the account
   * behind it. The code is still generated on the device — a real backend sends
   * and checks it server-side, where it never reaches the client at all.
   */
  const login = useCallback(
    async (phoneInput: string) => {
      const number = normalisePhone(phoneInput);
      if (!number) throw new Error(PHONE_RULE);
      const existing = accounts[number];
      if (!existing) {
        throw new Error(`No account uses ${formatPhone(number)} yet. Register to create one.`);
      }
      // Knowing a number is not proof of owning it, so signing in is verified
      // exactly like registering. The session only opens once the code checks out.
      await rememberVerification({
        phone: number,
        intent: 'login',
        name: existing.name,
        code: makeCode(),
        sentAt: new Date().toISOString(),
        attemptsLeft: MAX_ATTEMPTS,
      });
    },
    [accounts, rememberVerification],
  );

  const resendCode = useCallback(async () => {
    if (!verification) throw new Error('Enter your phone number to get a code.');
    const waited = Date.now() - new Date(verification.sentAt).getTime();
    // A customer who has used up their tries should not also wait out the timer.
    if (waited < RESEND_AFTER_MS && verification.attemptsLeft > 0) {
      const seconds = Math.ceil((RESEND_AFTER_MS - waited) / 1000);
      throw new Error(`You can ask for a new code in ${seconds}s.`);
    }
    await rememberVerification({
      ...verification,
      code: makeCode(),
      sentAt: new Date().toISOString(),
      attemptsLeft: MAX_ATTEMPTS,
    });
  }, [rememberVerification, verification]);

  const verifyCode = useCallback(
    async (entered: string) => {
      if (!verification) throw new Error('Enter your phone number to get a code.');
      const code = entered.replace(/\D/g, '');
      if (code.length !== OTP_LENGTH) throw new Error(`Enter the ${OTP_LENGTH}-digit code we sent you.`);
      if (Date.now() - new Date(verification.sentAt).getTime() > OTP_TTL_MS) {
        throw new Error('That code has expired. Send a new one.');
      }
      if (verification.attemptsLeft <= 0) throw new Error('Too many wrong codes. Send a new one to try again.');

      if (code !== verification.code) {
        const attemptsLeft = verification.attemptsLeft - 1;
        await rememberVerification({ ...verification, attemptsLeft });
        if (attemptsLeft <= 0) throw new Error('Too many wrong codes. Send a new one to try again.');
        throw new Error(`That code is not right. ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left.`);
      }

      // Registration lands here with no account yet; signing in lands here with
      // one already. Either way an existing record is never overwritten.
      if (!accounts[verification.phone]) {
        const created: Account = {
          phone: verification.phone,
          name: verification.name,
          location: DEFAULT_LOCATION,
          createdAt: new Date().toISOString(),
        };
        const next = { ...accounts, [created.phone]: created };
        setAccounts(next);
        await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
      }

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ phone: verification.phone }));
      await rememberVerification(null);
      setPhone(verification.phone);
    },
    [accounts, rememberVerification, verification],
  );

  const cancelVerification = useCallback(async () => {
    await rememberVerification(null);
  }, [rememberVerification]);

  const signOut = useCallback(async () => {
    setPhone(null);
    await rememberVerification(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, [rememberVerification]);

  const deleteAccount = useCallback(async () => {
    const current = phone;
    setPhone(null);
    await rememberVerification(null);
    if (!current) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }
    const next = { ...accounts };
    delete next[current];
    setAccounts(next);
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
    await AsyncStorage.multiRemove([SESSION_KEY, jobsKey(current)]);
  }, [accounts, phone, rememberVerification]);

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
