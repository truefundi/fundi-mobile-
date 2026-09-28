import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type Visit = {
  id: string;
  siteName: string;
  notes: string;
  photoUri: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  createdAt: string;
};

type VisitsContextValue = {
  visits: Visit[];
  isHydrated: boolean;
  addVisit: (visit: Omit<Visit, 'id' | 'createdAt'>) => Promise<void>;
  removeVisit: (id: string) => Promise<void>;
};

const STORAGE_KEY = '@site-visit-logger/visits';
const VisitsContext = createContext<VisitsContextValue | undefined>(undefined);

export function VisitsProvider({ children }: { children: ReactNode }) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored) {
          try {
            setVisits(JSON.parse(stored) as Visit[]);
          } catch {
            setVisits([]);
          }
        }
        setIsHydrated(true);
      })
      .catch(() => {
        if (mounted) setIsHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = async (next: Visit[]) => {
    setVisits(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const value = useMemo<VisitsContextValue>(
    () => ({
      visits,
      isHydrated,
      addVisit: async (visit) => {
        const nextVisit: Visit = {
          ...visit,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
        };
        await persist([nextVisit, ...visits]);
      },
      removeVisit: async (id) => {
        await persist(visits.filter((visit) => visit.id !== id));
      },
    }),
    [isHydrated, visits],
  );

  return <VisitsContext.Provider value={value}>{children}</VisitsContext.Provider>;
}

export function useVisits() {
  const context = useContext(VisitsContext);
  if (!context) throw new Error('useVisits must be used inside VisitsProvider');
  return context;
}