import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '@/lib/api';
import { DEFAULT_BOOKING_FEE, type Service } from '@/constants/services';

export const CATEGORIES_STORAGE_KEY = '@fundi/categories_cache';

export interface DatabaseCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  keywords: string | null;
  visitFee: number;
  bookingFee: number;
  emergencyVisitFee: number;
  sosBookingFee: number | null;
  icon: string | null;
}

/** Icon resolver for database category slugs and names */
export function resolveCategoryIcon(
  slug?: string | null,
  name?: string | null,
  providedIcon?: string | null,
): keyof typeof MaterialCommunityIcons.glyphMap {
  if (providedIcon && providedIcon in require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json')) {
    return providedIcon as keyof typeof MaterialCommunityIcons.glyphMap;
  }

  const normalized = (slug || name || '').toLowerCase().trim();

  if (normalized.includes('plumb') || normalized.includes('water') || normalized.includes('pipe')) {
    return 'pipe-wrench';
  }
  if (normalized.includes('electr') || normalized.includes('power') || normalized.includes('wiring')) {
    return 'flash-outline';
  }
  if (normalized.includes('appliance') || normalized.includes('machine') || normalized.includes('fridge')) {
    return 'washing-machine';
  }
  if (normalized.includes('hvac') || normalized.includes('air') || normalized.includes('cooling') || normalized.includes('refrigerat')) {
    return 'snowflake';
  }
  if (normalized.includes('carpent') || normalized.includes('wood')) {
    return 'saw-blade';
  }
  if (normalized.includes('lock') || normalized.includes('key')) {
    return 'key-outline';
  }
  if (normalized.includes('mason') || normalized.includes('brick') || normalized.includes('wall')) {
    return 'wall';
  }
  if (normalized.includes('paint')) {
    return 'format-paint';
  }
  if (normalized.includes('roof')) {
    return 'home-roof';
  }
  if (normalized.includes('weld') || normalized.includes('metal')) {
    return 'anvil';
  }
  if (normalized.includes('car') || normalized.includes('garage') || normalized.includes('auto')) {
    return 'car-outline';
  }
  if (normalized.includes('truck') || normalized.includes('mechanic')) {
    return 'truck-outline';
  }
  if (normalized.includes('home') || normalized.includes('house')) {
    return 'home-outline';
  }

  return 'tools';
}

/** Resolves sensible baseline booking fee when backend database fee is not yet set (> 0) */
export function resolveDefaultBookingFee(slug?: string | null, name?: string | null, backendFee = 0): number {
  if (typeof backendFee === 'number' && backendFee > 0) {
    return backendFee;
  }

  const normalized = (slug || name || '').toLowerCase().trim();
  if (normalized.includes('hvac') || normalized.includes('truck') || normalized.includes('car')) {
    return 4000;
  }
  if (normalized.includes('appliance') || normalized.includes('weld') || normalized.includes('roof')) {
    return 3500;
  }
  if (normalized.includes('plumb') || normalized.includes('electr')) {
    return 3000;
  }
  return DEFAULT_BOOKING_FEE;
}

/** Generates rich customer search keywords for category matching */
export function resolveCategoryKeywords(slug?: string | null, name?: string | null, backendKeywords = ''): string {
  const normalized = (slug || name || '').toLowerCase().trim();
  const extraTokens: string[] = [];

  if (normalized.includes('plumb')) extraTokens.push('water', 'pipe', 'leak', 'tap', 'toilet', 'drain', 'sink', 'faucet');
  if (normalized.includes('electr')) extraTokens.push('electric', 'power', 'socket', 'wiring', 'light', 'switch', 'breaker', 'fuse');
  if (normalized.includes('appliance')) extraTokens.push('washing', 'machine', 'cooker', 'oven', 'tv', 'fridge', 'refrigerator', 'microwave');
  if (normalized.includes('hvac')) extraTokens.push('air', 'conditioning', 'ac', 'heating', 'cooling', 'fan', 'ventilation', 'fridge', 'cold');
  if (normalized.includes('carpent')) extraTokens.push('wood', 'furniture', 'door', 'cabinet', 'table', 'chair', 'bed', 'closet');
  if (normalized.includes('lock')) extraTokens.push('key', 'padlock', 'unlock', 'door', 'deadbolt', 'cylinder', 'security');
  if (normalized.includes('mason')) extraTokens.push('brick', 'cement', 'wall', 'concrete', 'plaster', 'stone', 'tiles', 'paving');
  if (normalized.includes('paint')) extraTokens.push('painter', 'color', 'coating', 'brush', 'roller', 'interior', 'exterior', 'wall');
  if (normalized.includes('roof')) extraTokens.push('leak', 'tile', 'iron', 'sheet', 'gutter', 'ceiling', 'waterproofing');
  if (normalized.includes('weld')) extraTokens.push('metal', 'welder', 'iron', 'gate', 'railing', 'steel', 'fabrication', 'window');
  if (normalized.includes('car')) extraTokens.push('vehicle', 'garage', 'engine', 'tyre', 'tire', 'battery', 'mechanic', 'brake');
  if (normalized.includes('truck')) extraTokens.push('lorry', 'machine', 'mechanical', 'generator', 'heavy');

  const combined = `${backendKeywords || ''} ${extraTokens.join(' ')}`.trim();
  return combined;
}

/** Converts database category to frontend Service format */
export function mapDatabaseCategoryToService(dbCategory: DatabaseCategory): Service {
  return {
    id: dbCategory.id,
    label: dbCategory.name,
    slug: dbCategory.slug,
    icon: resolveCategoryIcon(dbCategory.slug, dbCategory.name, dbCategory.icon),
    keywords: resolveCategoryKeywords(dbCategory.slug, dbCategory.name, dbCategory.keywords ?? ''),
    bookingFee: resolveDefaultBookingFee(dbCategory.slug, dbCategory.name, dbCategory.bookingFee ?? dbCategory.visitFee),
    description: dbCategory.description || undefined,
    category: dbCategory.category || 'Home Services',
  };
}

/** In-memory cache of currently loaded categories */
let inMemoryCategories: Service[] | null = null;

export function getCachedCategories(): Service[] | null {
  return inMemoryCategories;
}

/** Fetches real categories from the database API with caching */
export async function fetchCategories(): Promise<Service[]> {
  try {
    const rawCategories = await apiRequest<DatabaseCategory[]>('/api/v1/catalog/categories');
    if (Array.isArray(rawCategories) && rawCategories.length > 0) {
      const services = rawCategories.map(mapDatabaseCategoryToService);
      inMemoryCategories = services;
      await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(services)).catch(() => {});
      return services;
    }
  } catch (err) {
    // If API is temporarily unreachable, attempt reading from persistent storage
    const cached = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY).catch(() => null);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Service[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryCategories = parsed;
          return parsed;
        }
      } catch {}
    }
    throw err;
  }

  return [];
}

/** Hook to fetch, cache, and search real service categories from the database */
export function useCategories() {
  const [categories, setCategories] = useState<Service[]>(() => inMemoryCategories ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!inMemoryCategories || inMemoryCategories.length === 0);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsLoading(true);
    setError(null);

    // 1. Check local async storage cache first if inMemory is empty
    if (!inMemoryCategories || inMemoryCategories.length === 0) {
      try {
        const cachedRaw = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as Service[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryCategories = parsed;
            setCategories(parsed);
          }
        }
      } catch {}
    }

    // 2. Fetch fresh live categories from the database API
    try {
      const liveServices = await fetchCategories();
      if (liveServices.length > 0) {
        setCategories(liveServices);
      }
    } catch (fetchError) {
      console.warn('Unable to fetch live categories from database, using cached/fallback:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Could not refresh categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const search = useCallback((query: string): Service[] => {
    const list = categories.length > 0 ? categories : inMemoryCategories ?? [];
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return list;
    return list.filter((service) => {
      const haystack = `${service.label} ${service.keywords}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [categories]);

  const getBookingFee = useCallback((serviceLabel?: string): number => {
    if (!serviceLabel || typeof serviceLabel !== 'string') return DEFAULT_BOOKING_FEE;
    const normalized = serviceLabel.trim().toLowerCase();
    const list = categories.length > 0 ? categories : inMemoryCategories ?? [];

    const exactMatch = list.find((s) => s.label.toLowerCase() === normalized || s.slug?.toLowerCase() === normalized);
    if (exactMatch) return exactMatch.bookingFee;

    const tokenMatch = list.find((s) =>
      s.keywords.toLowerCase().split(/\s+/).includes(normalized),
    );
    if (tokenMatch) return tokenMatch.bookingFee;

    const containsMatch = list.find((s) =>
      s.label.toLowerCase().includes(normalized) || normalized.includes(s.label.toLowerCase()),
    );
    if (containsMatch) return containsMatch.bookingFee;

    return resolveDefaultBookingFee(null, serviceLabel);
  }, [categories]);

  return {
    categories,
    isLoading,
    error,
    refresh: () => loadCategories(true),
    search,
    getBookingFee,
  };
}
