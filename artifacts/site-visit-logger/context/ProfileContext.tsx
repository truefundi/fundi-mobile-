import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normaliseName } from '@/constants/auth';
import { DEFAULT_PREFERENCES, type Preferences, type SavedPlace } from '@/constants/places';
import { profileKey } from '@/constants/storage';
import { type Account, useAuth } from '@/context/AuthContext';
import { setHapticsEnabled } from '@/lib/haptics';

/** What the customer changed on this device. Anything missing falls back to the server's account. */
type LocalProfile = {
  name?: string;
  location?: string;
  photoUri?: string;
  savedPlaces?: SavedPlace[];
  preferences?: Partial<Preferences>;
};

/** What Update profile can change. The phone number is the identity, so it is not here. */
export type ProfileChanges = {
  name: string;
  location: string;
  /** Undefined removes the picture. */
  photoUri?: string;
};

/** The signed-in account as the screens show it: the server's record with the customer's own changes on top. */
export type Profile = Account & { photoUri?: string };

type ProfileContextValue = {
  profile: Profile | null;
  updateProfile: (changes: ProfileChanges) => Promise<void>;
  savedPlaces: SavedPlace[];
  savePlaces: (places: SavedPlace[]) => Promise<void>;
  preferences: Preferences;
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function parse(raw: string | null): LocalProfile {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as LocalProfile;
  } catch {
    return {};
  }
}

/**
 * The customer's own profile layer, kept beside AuthContext rather than inside it.
 *
 * Sign-in and the session belong to the server (AuthContext). Picture, name and
 * area edits, saved places and preferences stay on the device per phone number
 * until the backend's `PATCH /me` and upload endpoints exist; then updateProfile
 * sends them there and this layer shrinks to the parts the server does not keep.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const [local, setLocal] = useState<LocalProfile>({});
  const phone = account?.phone ?? null;

  useEffect(() => {
    let mounted = true;
    setLocal({});
    if (!phone) return;
    AsyncStorage.getItem(profileKey(phone))
      .then((raw) => {
        if (mounted) setLocal(parse(raw));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [phone]);

  /** Writes to disk first, so a failure leaves the screen as it was. */
  const write = useCallback(
    async (change: (current: LocalProfile) => LocalProfile) => {
      if (!phone) throw new Error('Log in again to change your profile.');
      const next = change(local);
      await AsyncStorage.setItem(profileKey(phone), JSON.stringify(next));
      setLocal(next);
    },
    [local, phone],
  );

  const preferences = useMemo<Preferences>(() => ({ ...DEFAULT_PREFERENCES, ...local.preferences }), [local.preferences]);

  useEffect(() => {
    setHapticsEnabled(preferences.haptics);
  }, [preferences.haptics]);

  const updateProfile = useCallback(
    async (changes: ProfileChanges) => {
      const name = normaliseName(changes.name);
      if (!name) throw new Error('Enter your full name, first and last.');
      const location = changes.location.trim().replace(/\s+/g, ' ');
      if (location.length < 2) throw new Error('Enter the area you usually need services in.');
      await write((current) => ({ ...current, name, location, photoUri: changes.photoUri }));
    },
    [write],
  );

  const savePlaces = useCallback(
    async (places: SavedPlace[]) =>
      write((current) => {
        // A default that was deleted is no default at all.
        const defaultPlaceId = places.some((place) => place.id === current.preferences?.defaultPlaceId)
          ? current.preferences?.defaultPlaceId
          : undefined;
        return { ...current, savedPlaces: places, preferences: { ...current.preferences, defaultPlaceId } };
      }),
    [write],
  );

  const updatePreferences = useCallback(
    async (patch: Partial<Preferences>) => write((current) => ({ ...current, preferences: { ...current.preferences, ...patch } })),
    [write],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: account
        ? { ...account, name: local.name ?? account.name, location: local.location ?? account.location, photoUri: local.photoUri }
        : null,
      updateProfile,
      savedPlaces: local.savedPlaces ?? [],
      savePlaces,
      preferences,
      updatePreferences,
    }),
    [account, local, preferences, savePlaces, updatePreferences, updateProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside ProfileProvider');
  return context;
}
