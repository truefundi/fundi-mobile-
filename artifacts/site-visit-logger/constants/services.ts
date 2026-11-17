import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCachedCategories } from '@/lib/categories-api';

export type Service = {
  id?: string;
  label: string;
  slug?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Extra words a customer might search with, so "tap" still finds Plumbing. */
  keywords: string;
  /** Flat booking fee in standard local currency units (RWF) */
  bookingFee: number;
  description?: string;
  /** Name of the parent group, e.g. "Home Services". */
  category?: string;
  /** Id of the parent group (GET /catalog/categories). */
  groupId?: string;
};

/** Baseline platform Service Booking Fee in standard local currency units (RWF). */
export const DEFAULT_BOOKING_FEE = 2500;

/**
 * Standard category list mirroring the live database categories in PostgreSQL,
 * providing instant startup before network hydration and robust offline resilience.
 */
export const SERVICES: Service[] = [
  {
    label: 'Plumbing',
    slug: 'plumbing',
    icon: 'pipe-wrench',
    keywords: 'plumber water pipe leak tap toilet drain sink faucet shower pump bathroom',
    bookingFee: 3000,
    category: 'Home Services',
    description: 'Pipe leaks, taps, toilets, sinks, drainage, water tanks and heating repairs.',
  },
  {
    label: 'Electrical',
    slug: 'electrical',
    icon: 'flash-outline',
    keywords: 'electric electricity power socket wiring light switch breaker fuse appliance blackout',
    bookingFee: 3000,
    category: 'Home Services',
    description: 'Wiring, circuit breakers, light fixtures, outlets, switches and power diagnostics.',
  },
  {
    label: 'Appliance Repair',
    slug: 'appliance-repair',
    icon: 'washing-machine',
    keywords: 'appliance washing machine cooker oven tv fridge refrigerator microwave freezer dishwasher',
    bookingFee: 3500,
    category: 'Home Services',
    description: 'Refrigerators, washing machines, ovens, cookers, microwaves and small appliances.',
  },
  {
    label: 'HVAC & Refrigeration',
    slug: 'hvac-refrigeration',
    icon: 'snowflake',
    keywords: 'air conditioning ac heating cooling fan ventilation fridge refrigeration freezer cold',
    bookingFee: 4000,
    category: 'Home Services',
    description: 'AC installation and servicing, cooling systems, ventilation, and commercial refrigeration.',
  },
  {
    label: 'Carpentry',
    slug: 'carpentry',
    icon: 'saw-blade',
    keywords: 'wood furniture door cabinet table chair bed closet carpenter woodworker shelves',
    bookingFee: 2500,
    category: 'Home Services',
    description: 'Custom furniture, door fittings, cabinetry, wooden floors and general woodwork.',
  },
  {
    label: 'Masonry',
    slug: 'masonry',
    icon: 'wall',
    keywords: 'brick cement wall concrete plaster stone tiles masonry mason paving foundation',
    bookingFee: 2500,
    category: 'Home Services',
    description: 'Brickwork, plastering, wall tiling, concrete slabs, foundation and structural repairs.',
  },
  {
    label: 'Painting',
    slug: 'painting',
    icon: 'format-paint',
    keywords: 'paint painter wall color coating finish decorating interior exterior waterproof',
    bookingFee: 2500,
    category: 'Home Services',
    description: 'Interior and exterior house painting, spray finishing, waterproofing and touch-ups.',
  },
  {
    label: 'Roofing',
    slug: 'roofing',
    icon: 'home-roof',
    keywords: 'roof leak tile iron sheet gutter ceiling roofing waterproofing downpipe',
    bookingFee: 3500,
    category: 'Home Services',
    description: 'Roof leak fixes, tile replacement, gutters, downpipes and structural roof repairs.',
  },
  {
    label: 'Locksmith',
    slug: 'locksmith',
    icon: 'key-outline',
    keywords: 'lock key padlock unlock door security locksmith deadbolt cylinder handle',
    bookingFee: 2500,
    category: 'Home Services',
    description: 'Lock replacement, emergency unlocking, master keys, deadbolts and security handles.',
  },
  {
    label: 'Welding & Metalwork',
    slug: 'welding-metalwork',
    icon: 'anvil',
    keywords: 'metal weld welder iron gate railing steel fabrication welding window grille fence',
    bookingFee: 3500,
    category: 'Home Services',
    description: 'Steel gates, window grilles, iron railings, metal fences and custom fabrication.',
  },
  {
    label: 'Car & Garage',
    slug: 'car-garage',
    icon: 'car-outline',
    keywords: 'car vehicle garage engine tyre tire battery mechanic brakes oil change suspension',
    bookingFee: 4000,
    category: 'Car Services',
    description: 'Automotive diagnostics, roadside mechanical assistance, battery jump and brake service.',
  },
  {
    label: 'General Maintenance',
    slug: 'general-maintenance',
    icon: 'tools',
    keywords: 'general maintenance handyman other fix repair home odd jobs inspect',
    bookingFee: 2500,
    category: 'Home Services',
    description: 'General handyman tasks, troubleshooting unknown faults and multi-disciplinary fixes.',
  },
];

/**
 * Resolves the configured service booking fee for a given service category or label.
 * Matches case-insensitively against live dynamic database categories,
 * falling back to SERVICES list and DEFAULT_BOOKING_FEE (2,500 RWF).
 */
export function getServiceBookingFee(serviceLabel?: string): number {
  if (!serviceLabel || typeof serviceLabel !== 'string') {
    return DEFAULT_BOOKING_FEE;
  }

  const normalized = serviceLabel.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_BOOKING_FEE;
  }

  const pool = getCachedCategories() || SERVICES;

  // 1. Exact match on service label or slug
  const exact = pool.find((s) => s.label.toLowerCase() === normalized || s.slug?.toLowerCase() === normalized);
  if (exact) {
    return exact.bookingFee;
  }

  // 2. Exact match on keyword token (e.g. "ac" -> HVAC, "plumber" -> Plumbing, "mechanic" -> Car & Garage)
  const exactKeyword = pool.find((s) =>
    s.keywords.toLowerCase().split(/\s+/).includes(normalized),
  );
  if (exactKeyword) {
    return exactKeyword.bookingFee;
  }

  // 3. Label contains / is contained by query (e.g., "Plumbing Service" contains "Plumbing")
  const containsLabel = pool.find(
    (s) =>
      s.label.toLowerCase().includes(normalized) ||
      normalized.includes(s.label.toLowerCase()),
  );
  if (containsLabel) {
    return containsLabel.bookingFee;
  }

  // 4. Keyword substring match (e.g., "electrician" matches "electric", "air conditioning" matches "air")
  const keywordMatch = pool.find((s) => {
    const words = s.keywords.toLowerCase().split(/\s+/);
    return words.some((word) => normalized.includes(word) || word.includes(normalized));
  });
  if (keywordMatch) {
    return keywordMatch.bookingFee;
  }

  return DEFAULT_BOOKING_FEE;
}

/** Case-insensitive match on the label or any keyword. */
export function searchServices(query: string, customList?: Service[]): Service[] {
  const pool = customList || getCachedCategories() || SERVICES;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return pool;
  return pool.filter((service) => {
    const haystack = `${service.label} ${service.keywords}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export { getServiceIcon } from '@/lib/categories-api';
