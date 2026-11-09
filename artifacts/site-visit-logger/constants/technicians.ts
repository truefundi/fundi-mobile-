import type { Coordinates } from '@/lib/location';
import type { Technician } from '@/constants/jobs';

export type MarketplaceTechnician = {
  id: string;
  name: string;
  service: string;
  services: string[];
  rating: number;
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
