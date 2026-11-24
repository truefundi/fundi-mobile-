import type { Coordinates } from '@/lib/location';
import type { Technician } from '@/constants/jobs';

export type MarketplaceTechnician = {
  id: string;
  name: string;
  service: string;
  services: string[];
  /** Average customer score (1-5); null until the first rating. */
  rating: number | null;
  reviewsCount: number;
  jobsCompleted: number;
  etaMinutes: number;
  yearsExperience: number;
  location: Coordinates;
  isAvailable: boolean;
  phoneNumber: string;
  avatarUrl?: string;
};

/**
 * Zero mock stores policy: No mock technicians.
 * Real marketplace technicians are fetched dynamically from the production backend endpoints:
 * GET /api/v1/jobs/matching-technicians and GET /api/v1/public/technicians.
 */
export const MOCK_MARKETPLACE_TECHNICIANS: MarketplaceTechnician[] = [];

/** "4.6 (12 reviews)", or "No reviews yet" for a technician nobody has rated. */
export function reviewsLabel(rating: number | null | undefined, count: number | null | undefined): string {
  if (rating === null || rating === undefined || !count) return 'No reviews yet';
  return `${rating.toFixed(1)} (${count} ${count === 1 ? 'review' : 'reviews'})`;
}

export function toJobTechnician(tech: MarketplaceTechnician, distanceKm?: number): Technician {
  const parts = tech.name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : tech.name.slice(0, 2).toUpperCase();

  return {
    id: tech.id,
    name: tech.name,
    skill: tech.service,
    rating: tech.rating,
    reviewsCount: tech.reviewsCount,
    jobsCompleted: tech.jobsCompleted,
    distanceKm: distanceKm ?? 1.8,
    etaMinutes: tech.etaMinutes,
    initials,
    phone: tech.phoneNumber,
    yearsExperience: tech.yearsExperience,
    location: tech.location ?? undefined,
    photoUri: tech.avatarUrl,
    avatarUrl: tech.avatarUrl,
  };
}
