import type { Service } from '@/constants/services';

export type ServiceSort = 'relevance' | 'name' | 'fee-low' | 'fee-high';

/** Everything the customer can narrow the service list by, apart from the keywords. */
export type ServiceFilters = {
  /** Parent groups (GET /catalog/categories); empty means every group. */
  groupIds: string[];
  /** Highest booking fee to show, in RWF; null means any fee. */
  maxFee: number | null;
  sort: ServiceSort;
};

export const DEFAULT_FILTERS: ServiceFilters = { groupIds: [], maxFee: null, sort: 'relevance' };

export const FEE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Any fee', value: null },
  { label: 'Up to RWF 2,500', value: 2500 },
  { label: 'Up to RWF 3,500', value: 3500 },
  { label: 'Up to RWF 5,000', value: 5000 },
];

export const SORT_OPTIONS: { label: string; value: ServiceSort }[] = [
  { label: 'Best match', value: 'relevance' },
  { label: 'Name A–Z', value: 'name' },
  { label: 'Lowest fee', value: 'fee-low' },
  { label: 'Highest fee', value: 'fee-high' },
];

/** How many filters differ from the defaults, for the badge on the filter button. */
export function activeFilterCount(filters: ServiceFilters): number {
  return (filters.groupIds.length > 0 ? 1 : 0) + (filters.maxFee !== null ? 1 : 0) + (filters.sort !== 'relevance' ? 1 : 0);
}

/** The group a service belongs to, tolerating caches written before groups were mapped. */
export function groupOf(service: Service): { id?: string; name: string } {
  const raw = service.category as unknown;
  if (raw && typeof raw === 'object') {
    const group = raw as { id?: string; name?: string };
    return { id: service.groupId ?? group.id, name: group.name ?? 'Other services' };
  }
  return { id: service.groupId, name: (raw as string | undefined) || 'Other services' };
}

function terms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * How well a service matches the keywords: name hits outrank keyword hits, and
 * a service the server matched (by its own keywords) always counts.
 * 0 means no match.
 */
function score(service: Service, words: string[], serverIds: Set<string>): number {
  if (words.length === 0) return 1;
  const name = service.label.toLowerCase();
  const keywords = `${service.keywords} ${service.description ?? ''} ${groupOf(service).name}`.toLowerCase();
  let total = 0;
  for (const word of words) {
    if (name.startsWith(word)) total += 4;
    else if (name.includes(word)) total += 3;
    else if (keywords.includes(word)) total += 1;
    else if (!(service.id && serverIds.has(service.id))) return 0;
  }
  if (service.id && serverIds.has(service.id)) total += 1;
  return total;
}

/** Applies keywords, filters and sort to the catalog. */
export function applyServiceSearch(
  services: Service[],
  query: string,
  filters: ServiceFilters,
  serverIds: Set<string> = new Set(),
): Service[] {
  const words = terms(query);
  const ranked = services
    .filter((service) => filters.groupIds.length === 0 || filters.groupIds.includes(groupOf(service).id ?? ''))
    .filter((service) => filters.maxFee === null || service.bookingFee <= filters.maxFee)
    .map((service) => ({ service, score: score(service, words, serverIds) }))
    .filter((entry) => entry.score > 0);

  ranked.sort((a, b) => {
    switch (filters.sort) {
      case 'fee-low':
        return a.service.bookingFee - b.service.bookingFee || a.service.label.localeCompare(b.service.label);
      case 'fee-high':
        return b.service.bookingFee - a.service.bookingFee || a.service.label.localeCompare(b.service.label);
      case 'name':
        return a.service.label.localeCompare(b.service.label);
      default:
        return b.score - a.score || a.service.label.localeCompare(b.service.label);
    }
  });
  return ranked.map((entry) => entry.service);
}

/** Popular words from the catalog's keywords, offered as one-tap searches. */
export function suggestedKeywords(services: Service[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // One or two words per service keeps the suggestions varied.
  for (let round = 0; round < 2 && out.length < limit; round += 1) {
    for (const service of services) {
      const word = service.keywords.split(/\s+/).filter((w) => w.length > 2)[round];
      if (word && !seen.has(word)) {
        seen.add(word);
        out.push(word);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}
