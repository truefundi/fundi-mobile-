import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { WorkSettings } from '@/components/work/WorkSettings';
import { WorkLocked } from '@/components/work/WorkLocked';
import { AppHeader } from '@/components/ui/AppHeader';
import { PageHeading } from '@/components/ui/PageHeading';
import {
  ActiveFilterChips,
  KeywordSuggestions,
  ServiceFilterSheet,
  ServiceSearchBar,
} from '@/components/search/ServiceSearch';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatBookingFee } from '@/constants/jobs';
import type { Service } from '@/constants/services';
import { useServiceSearch } from '@/hooks/useServiceSearch';
import { groupOf } from '@/lib/service-search';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';

const SCREEN_GUTTER = 20;
const GRID_GAP = 11;

export default function ServicesScreen() {
  const colors = useColors();
  const bottomPadding = useTabScreenPadding();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Two columns on every phone, sized from the real width so the gap never
  // pushes the second card onto its own row.
  const cardWidth = Math.floor((width - SCREEN_GUTTER * 2 - GRID_GAP) / 2);
  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  const search = useServiceSearch();
  const { isLoading, refresh } = search;
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const displayedServices = search.results;
  const hasQuery = search.query.trim().length > 0;
  // Browsing (no keywords, best-match order): show the services under their groups.
  // Searching or sorting: one flat list in the chosen order.
  const sections: { title: string | null; items: Service[] }[] =
    hasQuery || search.filters.sort !== 'relevance'
      ? [{ title: null, items: displayedServices }]
      : Object.values(
          displayedServices.reduce<Record<string, { title: string; items: Service[] }>>((acc, service) => {
            const group = groupOf(service);
            const key = group.id ?? group.name;
            (acc[key] ??= { title: group.name, items: [] }).items.push(service);
            return acc;
          }, {}),
        );
  const requestService = (service: Service) =>
    router.push({ pathname: '/request', params: { service: service.label, ...(service.id ? { categoryId: service.id } : {}) } });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 18, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <PageHeading
          eyebrow={inWork ? 'Your work' : 'Find a Fundi'}
          title={inWork ? 'What you take on' : 'What can we fix?'}
          subtitle={
            inWork
              ? 'Set the work you want and Fundi only sends jobs that fit.'
              : 'Choose a service and tell us what is going on. We will match you with the right technician.'
          }
        />
        {working ? (
          <WorkSettings />
        ) : locked ? (
          <WorkLocked />
        ) : (
          <>
            <View style={styles.searchWrap}>
              <ServiceSearchBar
                value={search.query}
                onChange={search.setQuery}
                filterCount={search.filterCount}
                onOpenFilters={() => setFiltersOpen(true)}
                placeholder="Search services or problems"
                testID="services-search"
              />
              <ActiveFilterChips filters={search.filters} groups={search.groups} onChange={search.setFilters} />
              {!hasQuery ? <KeywordSuggestions words={search.suggestions} onPick={search.setQuery} /> : null}
            </View>

            {search.isFiltering && displayedServices.length > 0 ? (
              <Text testID="services-result-count" style={[styles.resultCount, { color: colors.mutedForeground }]}>
                {displayedServices.length} of {search.services.length} services
                {hasQuery ? ` for "${search.query.trim()}"` : ''}
              </Text>
            ) : null}

            {isLoading && search.services.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Loading services...
                </Text>
              </View>
            ) : displayedServices.length === 0 ? (
              <View style={styles.empty}>
                <EmptyState
                  icon="search"
                  title={search.filterCount ? 'No service matches these filters' : 'No service matches that'}
                  text="Try other words or loosen a filter. You can also describe the problem in a general request."
                  action={{
                    label: search.filterCount ? 'Clear filters' : 'Clear search',
                    onPress: () => (search.filterCount ? search.resetFilters() : search.setQuery('')),
                    testID: 'services-empty-reset',
                  }}
                />
              </View>
            ) : (
              sections.map((section) => (
                <View key={section.title ?? 'all'}>
                  {section.title && sections.length > 1 ? (
                    <Text style={[styles.groupTitle, { color: colors.foreground }]}>{section.title}</Text>
                  ) : null}
                  <View style={styles.grid}>
                    {section.items.map((service) => (
                      <Pressable
                        key={service.id || service.slug || service.label}
                        accessibilityRole="button"
                        accessibilityLabel={`Request ${service.label}`}
                        testID={`services-${service.label}`}
                        onPress={() => requestService(service)}
                        style={({ pressed }) => [
                          styles.card,
                          { width: cardWidth, backgroundColor: colors.card, borderColor: pressed ? colors.primary : colors.border },
                        ]}
                      >
                        <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
                          <MaterialCommunityIcons name={service.icon} size={27} color={colors.primary} />
                        </View>
                        <Text style={[styles.label, { color: colors.foreground }]}>{service.label}</Text>
                        <Text style={[styles.fee, { color: colors.mutedForeground }]}>Booking fee {formatBookingFee(service.bookingFee)}</Text>
                        {/* The arrow sits inside the text, held to "service" by a no-break
                            space, so on narrow cards it wraps with the word, not alone. */}
                        <Text style={[styles.link, { color: colors.primary }]}>
                          {'Request service '}
                          <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            )}
            <View style={[styles.helpCard, { backgroundColor: colors.primary }]}>
              <Text style={[styles.helpKicker, { color: colors.secondary }]}>CAN&apos;T FIND IT?</Text>
              <Text style={[styles.helpTitle, { color: colors.primaryForeground }]}>Tell us what you need</Text>
              <Text style={[styles.helpText, { color: colors.secondary }]}>
                Our general maintenance specialists can help diagnose unusual problems.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a request"
                testID="general-request-button"
                onPress={() => router.push({ pathname: '/request', params: { service: 'General Maintenance' } })}
                style={({ pressed }) => [styles.helpButton, { backgroundColor: colors.primaryForeground, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.helpButtonText, { color: colors.primary }]}>Start a request</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
      <ServiceFilterSheet
        visible={filtersOpen}
        filters={search.filters}
        groups={search.groups}
        countFor={search.countFor}
        onApply={search.setFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingContainer: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  searchWrap: { marginTop: 18 },
  resultCount: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 16 },
  empty: { marginTop: 22 },
  groupTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2, marginTop: 24, marginBottom: -10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginTop: 22 },
  card: { minHeight: 145, borderRadius: 16, borderWidth: 1, padding: 13, justifyContent: 'space-between' },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 19, marginTop: 13 },
  fee: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, marginTop: 4 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, marginTop: 8 },
  helpCard: { borderRadius: 18, padding: 18, marginTop: 22 },
  helpKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  helpTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 7 },
  helpText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  helpButton: { minHeight: 44, borderRadius: 22, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 18, marginTop: 15 },
  helpButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
