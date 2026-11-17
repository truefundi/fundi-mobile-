import { useEffect, useMemo, useState } from 'react';
import { SERVICES } from '@/constants/services';
import { fetchCatalogGroups, searchCatalogServiceIds, useCategories, type CatalogGroup } from '@/lib/categories-api';
import {
  activeFilterCount,
  applyServiceSearch,
  DEFAULT_FILTERS,
  groupOf,
  suggestedKeywords,
  type ServiceFilters,
} from '@/lib/service-search';

/** Groups survive across screens, so the filter sheet opens instantly. */
let cachedGroups: CatalogGroup[] | null = null;
const SERVER_SEARCH_DELAY_MS = 300;

/**
 * Keyword search plus filters over the service catalog. Matches locally as the
 * customer types, and also asks the catalog's search endpoint so keywords set
 * by admins count even before the cached list is refreshed.
 */
export function useServiceSearch() {
  const { categories, isLoading, refresh } = useCategories();
  const services = categories.length > 0 ? categories : SERVICES;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ServiceFilters>(DEFAULT_FILTERS);
  const [serverIds, setServerIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<CatalogGroup[]>(() => cachedGroups ?? []);

  useEffect(() => {
    if (cachedGroups) return;
    fetchCatalogGroups()
      .then((list) => {
        cachedGroups = list;
        setGroups(list);
      })
      .catch(() => undefined);
  }, []);

  // Debounced server search; local matching already shows results meanwhile.
  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setServerIds(new Set());
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCatalogServiceIds(text)
        .then((ids) => {
          if (!cancelled) setServerIds(new Set(ids));
        })
        .catch(() => undefined);
    }, SERVER_SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Groups from the catalog, or, offline, the ones the services themselves name.
  const groupOptions = useMemo<CatalogGroup[]>(() => {
    if (groups.length > 0) return groups;
    const byId = new Map<string, CatalogGroup>();
    for (const service of services) {
      const group = groupOf(service);
      if (group.id && !byId.has(group.id)) byId.set(group.id, { id: group.id, name: group.name });
    }
    return [...byId.values()];
  }, [groups, services]);

  const results = useMemo(() => applyServiceSearch(services, query, filters, serverIds), [services, query, filters, serverIds]);
  const filterCount = activeFilterCount(filters);
  const suggestions = useMemo(() => suggestedKeywords(services), [services]);

  return {
    services,
    results,
    query,
    setQuery,
    filters,
    setFilters,
    resetFilters: () => setFilters(DEFAULT_FILTERS),
    filterCount,
    /** True when keywords or any filter is narrowing the list. */
    isFiltering: query.trim().length > 0 || filterCount > 0,
    groups: groupOptions,
    suggestions,
    isLoading,
    refresh,
    /** How many services a given set of filters would show, for the sheet's button. */
    countFor: (next: ServiceFilters) => applyServiceSearch(services, query, next, serverIds).length,
  };
}
