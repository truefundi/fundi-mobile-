import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWork } from '@/context/WorkContext';
import { apiRequest } from '@/lib/api';

export interface AdItem {
  id: string;
  title: string;
  pitch: string;
  callToAction: string;
  /** Where tapping the ad leads; null when the ad has no link. */
  targetUrl: string | null;
  imageSource: { uri: string } | null;
  imageAlt: string | null;
}

interface AdsContextValue {
  ads: AdItem[];
  isLoading: boolean;
  refreshAds: () => Promise<void>;
  /** Counts a tap on an ad (best effort). */
  recordAdClick: (id: string) => void;
}

/** GET /api/v1/ads: an ad visible right now. */
type ApiAd = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  callToAction: string | null;
  targetUrl: string | null;
};

/** Uploaded creatives come back as API paths; hosted ones as full URLs. */
function absoluteImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  return base ? `${base}${url.startsWith('/') ? '' : '/'}${url}` : null;
}

function toAdItem(ad: ApiAd): AdItem {
  const image = absoluteImageUrl(ad.imageUrl);
  return {
    id: ad.id,
    title: ad.title,
    pitch: ad.description,
    callToAction: ad.callToAction?.trim() || 'Learn more',
    targetUrl: ad.targetUrl,
    imageSource: image ? { uri: image } : null,
    imageAlt: ad.imageAlt,
  };
}

const AdsContext = createContext<AdsContextValue | null>(null);

/** Ads already counted as seen in this app session (survives the provider remounting). */
const countedImpressions = new Set<string>();

/** The home carousel's ads, managed by admins in the dashboard (placement MOBILE_HOME). */
export function AdsProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useWork();
  const role = mode === 'working' ? 'TECHNICIAN' : 'CUSTOMER';
  const [ads, setAds] = useState<AdItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAds = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await apiRequest<ApiAd[]>(`/api/v1/ads?placement=MOBILE_HOME&role=${role}`);
      setAds(Array.isArray(rows) ? rows.map(toAdItem) : []);
    } catch {
      // No ads is a normal state: the home screen shows its emergency card instead.
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void refreshAds();
  }, [refreshAds]);

  // One impression per ad per app session.
  useEffect(() => {
    for (const ad of ads) {
      if (countedImpressions.has(ad.id)) continue;
      countedImpressions.add(ad.id);
      void apiRequest(`/api/v1/ads/${ad.id}/impression`, { method: 'POST' }).catch(() => undefined);
    }
  }, [ads]);

  const recordAdClick = useCallback((id: string) => {
    void apiRequest(`/api/v1/ads/${id}/click`, { method: 'POST' }).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ ads, isLoading, refreshAds, recordAdClick }),
    [ads, isLoading, refreshAds, recordAdClick],
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
