import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type Service = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Extra words a customer might search with, so "tap" still finds Plumbing. */
  keywords: string;
  /** Flat booking fee in standard local currency units (RWF) */
  bookingFee: number;
};

/** Baseline platform Service Booking Fee in standard local currency units (RWF). */
export const DEFAULT_BOOKING_FEE = 2500;

/** The one list of services, shared by Home and the Services tab. */
export const SERVICES: Service[] = [
  { label: 'Car & Garage', icon: 'car-outline', keywords: 'car vehicle garage engine tyre tire battery mechanic', bookingFee: 4000 },
  { label: 'Electrical', icon: 'flash-outline', keywords: 'electric electricity power socket wiring light switch', bookingFee: 3000 },
  { label: 'Plumbing', icon: 'pipe-wrench', keywords: 'plumber water pipe leak tap toilet drain sink', bookingFee: 3000 },
  { label: 'HVAC', icon: 'snowflake', keywords: 'air conditioning ac heating cooling fan ventilation fridge', bookingFee: 5000 },
  { label: 'Home Repair', icon: 'home-outline', keywords: 'house door window roof wall paint carpentry', bookingFee: 2500 },
  { label: 'Appliance Repair', icon: 'washing-machine', keywords: 'appliance washing machine cooker oven tv fridge', bookingFee: 3500 },
  { label: 'Truck & Mechanical', icon: 'truck-outline', keywords: 'truck lorry machine mechanical generator', bookingFee: 5000 },
  { label: 'General Maintenance', icon: 'tools', keywords: 'general maintenance handyman other fix', bookingFee: 2500 },
];

/**
 * Resolves the configured service booking fee for a given service category or label.
 * Matches case-insensitively against service labels, substrings, and keywords,
 * falling back to DEFAULT_BOOKING_FEE (2,500 RWF) if unmatched.
 */
export function getServiceBookingFee(serviceLabel?: string): number {
  if (!serviceLabel || typeof serviceLabel !== 'string') {
    return DEFAULT_BOOKING_FEE;
  }

  const normalized = serviceLabel.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_BOOKING_FEE;
  }

  // 1. Exact match on service label
  const exactLabel = SERVICES.find((s) => s.label.toLowerCase() === normalized);
  if (exactLabel) {
    return exactLabel.bookingFee;
  }

  // 2. Exact match on keyword token (e.g. "ac" -> HVAC, "plumber" -> Plumbing, "mechanic" -> Car & Garage)
  const exactKeyword = SERVICES.find((s) =>
    s.keywords.toLowerCase().split(/\s+/).includes(normalized),
  );
  if (exactKeyword) {
    return exactKeyword.bookingFee;
  }

  // 3. Label contains / is contained by query (e.g., "Plumbing Service" contains "Plumbing")
  const containsLabel = SERVICES.find(
    (s) =>
      s.label.toLowerCase().includes(normalized) ||
      normalized.includes(s.label.toLowerCase()),
  );
  if (containsLabel) {
    return containsLabel.bookingFee;
  }

  // 4. Keyword substring match (e.g., "electrician" matches "electric", "air conditioning" matches "air")
  const keywordMatch = SERVICES.find((s) => {
    const words = s.keywords.toLowerCase().split(/\s+/);
    return words.some((word) => normalized.includes(word) || word.includes(normalized));
  });
  if (keywordMatch) {
    return keywordMatch.bookingFee;
  }

  return DEFAULT_BOOKING_FEE;
}

/** Case-insensitive match on the label or any keyword. */
export function searchServices(query: string): Service[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return SERVICES;
  return SERVICES.filter((service) => {
    const haystack = `${service.label} ${service.keywords}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
