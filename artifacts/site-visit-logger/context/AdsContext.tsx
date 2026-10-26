import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

export interface AdItem {
  id: string;
  title: string;
  pitch: string;
  callToAction: string;
  targetUrl: string;
  imageSource: any;
}

interface AdsContextValue {
  ads: AdItem[];
  isLoading: boolean;
  refreshAds: () => Promise<void>;
}

/**
 * Image Asset Placement Note:
 * Place your images at:
 *   1. assets/images/ads/homeshub.png
 *   2. assets/images/ads/rides.png
 *   3. assets/images/ads/eventis.png
 *
 * If local asset files are not yet present on disk,
 * the placeholder URIs below ensure the component does not crash.
 */
const MOCK_ADS: AdItem[] = [
  {
    id: 'ad-homeshub',
    title: 'HomesHub Kigali',
    pitch: 'Find apartments, houses, and premium rentals across Kigali with ease.',
    callToAction: 'Explore Houses',
    targetUrl: 'https://homeshub.rw',
    imageSource: {
      uri: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80',
    },
    // Replace with: require('../../assets/images/ads/homeshub.png') when added to assets
  },
  {
    id: 'ad-rides',
    title: 'Rides Kigali',
    pitch: 'Fast, secure, and affordable on-demand rides everywhere in Rwanda.',
    callToAction: 'Book a Ride',
    targetUrl: 'https://rides.rw',
    imageSource: {
      uri: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1000&q=80',
    },
    // Replace with: require('../../assets/images/ads/rides.png') when added to assets
  },
  {
    id: 'ad-eventis',
    title: 'Eventis Rwanda',
    pitch: 'Seamless event ticketing, concert passes, and venue coordination.',
    callToAction: 'Discover Events',
    targetUrl: 'https://eventis.rw',
    imageSource: {
      uri: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1000&q=80',
    },
    // Replace with: require('../../assets/images/ads/eventis.png') when added to assets
  },
];

const AdsContext = createContext<AdsContextValue | null>(null);

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [ads, setAds] = useState<AdItem[]>(MOCK_ADS);
  const [isLoading, setIsLoading] = useState(false);

  const refreshAds = useCallback(async () => {
    setIsLoading(true);
    try {
      // Reserved for live ads endpoint retrieval
      await new Promise((resolve) => setTimeout(resolve, 300));
      setAds(MOCK_ADS);
    } catch {
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      ads,
      isLoading,
      refreshAds,
    }),
    [ads, isLoading, refreshAds]
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds() {
  const context = useContext(AdsContext);
  if (!context) {
    throw new Error('useAds must be used within an AdsProvider');
  }
  return context;
}