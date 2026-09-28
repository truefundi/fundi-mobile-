/**
 * Stand-in work for the technician side.
 *
 * The rules a technician registers under and the work they agree to take.
 * Jobs themselves are real records from FundiContext, not seed data.
 */

import { initialsOf } from './auth';
import { type Technician } from './jobs';

/**
 * Nobody is hired on their word alone. A technician registers under a trade and
 * proves it: a national ID, and at least one certificate for the trade claimed.
 * Until that is reviewed they cannot go online, so customers only ever reach
 * technicians whose papers someone has actually read.
 */
export const TRADES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Appliance Repair',
  'Car & Garage',
  'Truck & Mechanical',
  'Home Repair',
  'General Maintenance',
] as const;

export type Trade = (typeof TRADES)[number];

/** none: never applied. pending: documents submitted. verified: may go online. */
export type WorkStatus = 'none' | 'pending' | 'verified';

export type WorkProfile = {
  trade: Trade;
  yearsExperience: number;
  /** Photographed national ID. */
  idPhotoUri: string;
  /** Photographed trade certificates — at least one. */
  certificateUris: string[];
  submittedAt: string;
};

/**
 * How long the simulated review takes. Real verification is a person reading
 * documents, so this stands in for a queue that takes hours or days.
 */
export const REVIEW_MS = 8000;

/** What a technician controls about the work they are sent. */
export type WorkSettings = {
  /** Job types they want offers for. Only verified trades actually match. */
  trades: Trade[];
  radiusKm: number;
  maxJobsPerDay: number;
  hours: HoursWindow;
};

/** Named windows rather than a time picker — quicker to set, easier to read. */
export type HoursWindow = 'mornings' | 'days' | 'evenings' | 'always';

export const HOURS: Record<HoursWindow, { label: string; detail: string }> = {
  mornings: { label: 'Mornings', detail: '6am – 12pm' },
  days: { label: 'Days', detail: '8am – 6pm' },
  evenings: { label: 'Evenings', detail: '4pm – 10pm' },
  always: { label: 'Any time', detail: 'Around the clock' },
};

export const RADIUS_OPTIONS = [5, 10, 20, 40];
export const MAX_JOBS_OPTIONS = [2, 4, 6, 8];

export const DEFAULT_SETTINGS: WorkSettings = { trades: [], radiusKm: 10, maxJobsPerDay: 4, hours: 'days' };

/**
 * Accounts that are already verified technicians.
 *
 * Stands in for a reviewer having read someone's documents and approved them,
 * so a demo account can go online without walking the application first. Keyed
 * by E.164 number. Delete this the moment real verification exists.
 */
export const PRE_VERIFIED: Record<string, { trade: Trade; yearsExperience: number }> = {
  // Ganza — 0788587421
  '+250788587421': { trade: 'Electrical', yearsExperience: 6 },
};

/**
 * The signed-in worker, in the shape the customer's screens already render.
 *
 * Rating and jobs-completed start from nothing because this person has no
 * history on the platform yet — inventing a 4.8 would be a lie the customer
 * acts on.
 */
export function technicianFromAccount(
  name: string,
  phone: string,
  profile: { trade: Trade; yearsExperience: number } | null,
  radiusKm: number,
  jobsCompleted: number,
): Technician {
  return {
    id: `me:${phone}`,
    name,
    skill: profile?.trade ?? 'General Maintenance',
    rating: 0,
    jobsCompleted,
    distanceKm: radiusKm,
    etaMinutes: Math.max(5, Math.round(radiusKm * 1.6)),
    initials: initialsOf(name),
    phone,
    yearsExperience: profile?.yearsExperience ?? 0,
  };
}
