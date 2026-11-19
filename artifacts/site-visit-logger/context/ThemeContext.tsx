import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_KEY } from '@/constants/storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('light');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') {
          setThemeState(saved);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  const setTheme = async (newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
    } catch {
      // non-critical persistence failure
    }
  };

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    return theme === 'dark' ? 'dark' : 'light';
  }, [theme]);

  const toggleTheme = async () => {
    const nextTheme: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setTheme(nextTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Graceful fallback if invoked outside of ThemeProvider
    return {
      theme: 'system',
      resolvedTheme: 'light',
      isDark: false,
      setTheme: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
}

