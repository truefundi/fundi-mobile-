import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { formatMoney, getServiceBookingFee, isClosed, repairTotal } from '@/constants/jobs';
import type { Service } from '@/constants/services';
import { ActiveFilterChips, ServiceFilterSheet, ServiceSearchBar } from '@/components/search/ServiceSearch';
import { useServiceSearch } from '@/hooks/useServiceSearch';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingActionGroup } from '@/components/ui/FloatingActionGroup';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { WorkHome } from '@/components/work/WorkHome';
import { useColors } from '@/hooks/useColors';
import { useFloatingActionVisibility } from '@/hooks/useFloatingActionVisibility';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';
import { isWorkVerified } from '@/constants/work';
import { EmergencyServiceCard } from '@/components/home/EmergencyServiceCard';
import { useAds } from '@/context/AdsContext';
import { AdsCarousel } from '@/components/home/AdsCarousel';

const SCREEN_GUTTER = 20;
const GRID_GAP = 10;
/** Below this content width three cards get too narrow for their labels. */
const THREE_COLUMN_MIN = 330;
/** Home shows the first six services; the rest are one tap away, or one search. */
const HOME_SERVICE_COUNT = 6;

export interface HomeScreenProps {
  /** Explicitly toggle hiding the AI Chatbot button */
  hideBot?: boolean;
  /** Explicitly toggle hiding the emergency SOS button */
  hideSos?: boolean;
  /** Hide both floating action buttons */
  hideFloatingActions?: boolean;
  /** Custom handler for AI Chatbot press */
  onPressBot?: () => void;
  /** Custom handler for emergency SOS press */
  onPressSos?: () => void;
}

export default function HomeScreen({
  hideBot,
  hideSos,
  hideFloatingActions,
  onPressBot,
  onPressSos,
}: HomeScreenProps = {}) {
  const colors = useColors();
  const bottomPadding = useTabScreenPadding();
  // Card widths are computed from the real screen width rather than percentages,
  // which overflowed once the gaps were added and broke the grid on most phones.
  const { width } = useWindowDimensions();
  const contentWidth = width - SCREEN_GUTTER * 2;
  const columns = contentWidth >= THREE_COLUMN_MIN ? 3 : 2;
  const cardWidth = Math.floor((contentWidth - GRID_GAP * (columns - 1)) / columns);
  const router = useRouter();
  const { jobs } = useFundi();
  const { mode, status } = useWork();
  // Only a verified worker has a job list to search.
  const searchingJobs = mode === 'working' && isWorkVerified(status);
  const [jobQuery, setJobQuery] = useState('');
  const search = useServiceSearch();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { activeJob, recent } = useMemo(() => {
    const open = jobs.filter((job) => !isClosed(job.status));
    return {
      activeJob: open[0],
      recent: jobs.filter((job) => job.status === 'COMPLETED').slice(0, 3),
    };
  }, [jobs]);

  const isSearching = search.isFiltering;
  const hasQuery = search.query.trim().length > 0;
  // A search or filter looks through every service, not just the six on show.
  const shownServices = isSearching ? search.results : search.services.slice(0, HOME_SERVICE_COUNT);

  // Compute visibility based on mode, active job state, search input, and explicit overrides
  const { hideBot: computedHideBot, hideSos: computedHideSos } = useFloatingActionVisibility({
    hideAll: hideFloatingActions,
    hideBot,
    hideSos,
    mode,
    isSearching,
    activeJob,
  });

  const requestService = (service: Service | string) => {
    const name = typeof service === 'string' ? service : service.label;
    const categoryId = typeof service === 'string' ? undefined : service.id;
    router.push({ pathname: '/request', params: { service: name, ...(categoryId ? { categoryId } : {}) } });
  };

  // Get the Ads if available
  const { ads, isLoading } = useAds();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />

      <ScrollView
        contentContainerStyle={[styles.safeArea, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searchingJobs ? (
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={19} color={colors.mutedForeground} />
            <TextInput
              accessibilityLabel="Search jobs"
              testID="home-job-search-input"
              value={jobQuery}
              onChangeText={setJobQuery}
              placeholder="Search jobs near you"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>
        ) : mode === 'working' ? (
          // Not verified yet: the shortcut leads to the screen explaining why.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find a technician"
            testID="home-search-button"
            onPress={() => router.navigate('/services')}
            style={({ pressed }) => [styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="search" size={19} color={colors.mutedForeground} />
            <Text style={[styles.searchText, { color: colors.mutedForeground }]}>Find a technician</Text>
          </Pressable>
        ) : (
          <>
            <ServiceSearchBar
              value={search.query}
              onChange={search.setQuery}
              filterCount={search.filterCount}
              onOpenFilters={() => setFiltersOpen(true)}
              testID="home-search"
            />
            <ActiveFilterChips filters={search.filters} groups={search.groups} onChange={search.setFilters} />
          </>
        )}
        {mode === 'working' ? (
          <WorkHome query={jobQuery} />
        ) : (
          <>
            {activeJob ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open your ${activeJob.service} job`}
                testID="home-active-job-button"
                onPress={() => router.push(`/job/${activeJob.id}`)}
                style={({ pressed }) => [styles.activeCard, { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={styles.activeCopy}>
                  <Text style={[styles.activeKicker, { color: colors.primary }]}>JOB IN PROGRESS</Text>
                  <Text style={[styles.activeTitle, { color: colors.foreground }]} numberOfLines={1}>{activeJob.service}</Text>
                  <View style={styles.activeBadgeRow}>
                    <StatusBadge status={activeJob.status} />
                  </View>
                </View>
                <View style={[styles.activeOpen, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.activeOpenText, { color: colors.primary }]}>Open</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </Pressable>
            ) : null}

              {isSearching ? null : !isLoading && ads && ads.length > 0 ? (
                <AdsCarousel ads={ads} />
            ) : (
              <EmergencyServiceCard />
            )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]} numberOfLines={1}>
                {hasQuery
                  ? `Results for "${search.query.trim()}"`
                  : isSearching
                    ? `${shownServices.length} service${shownServices.length === 1 ? '' : 's'}`
                    : 'What service do you need?'}
              </Text>
              <Pressable onPress={() => router.navigate('/services')} testID="see-all-services-button" hitSlop={10}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
              </Pressable>
            </View>
            {shownServices.length === 0 ? (
              <EmptyState
                icon="search"
                title={search.filterCount ? 'No service matches these filters' : 'No service matches that'}
                text={
                  search.filterCount
                    ? 'Loosen a filter, or describe the problem in a general request and we will match you with the right technician.'
                    : 'Describe the problem in a general request and we will match you with the right technician.'
                }
                action={{ label: 'Start a general request', onPress: () => requestService('General Maintenance'), testID: 'home-search-general-request' }}
              />
            ) : (
              <View style={styles.categoryGrid}>
                {shownServices.map((service) => (
                  <ServiceCard key={service.id || service.slug || service.label} service={service} width={cardWidth} onPress={() => requestService(service)} />
                ))}
              </View>
            )}

            {isSearching ? null : (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent services</Text>
                  <Pressable onPress={() => router.navigate('/activity')} testID="see-all-activity-button" hitSlop={10}>
                    <Text style={[styles.seeAll, { color: colors.primary }]}>View all</Text>
                  </Pressable>
                </View>
                <View style={styles.recentList}>
                  {recent.length === 0 ? (
                    <View style={[styles.recentEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.recentIcon, { backgroundColor: colors.muted }]}>
                        <Feather name="clock" size={18} color={colors.mutedForeground} />
                      </View>
                      <Text style={[styles.recentEmptyText, { color: colors.mutedForeground }]}>
                        Your completed repairs and invoices will be listed here.
                      </Text>
                    </View>
                  ) : (
                    recent.map((job) => (
                      <Pressable
                        key={job.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${job.service}`}
                        testID={`home-recent-${job.reference}`}
                        onPress={() => router.push(`/job/${job.id}`)}
                        style={({ pressed }) => [styles.recentCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
                      >
                        <View style={[styles.recentIcon, { backgroundColor: colors.secondary }]}>
                          <MaterialCommunityIcons name="wrench-outline" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.recentCopy}>
                          <Text style={[styles.recentTitle, { color: colors.foreground }]} numberOfLines={1}>{job.service}</Text>
                          <Text style={[styles.recentMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {job.technician?.name ?? 'Unmatched'} Â· Completed
                          </Text>
                        </View>
                        <View style={styles.recentAmount}>
                          <Text style={[styles.amount, { color: colors.foreground }]}>
                            {formatMoney(repairTotal(job) > 0 ? repairTotal(job) : (job.bookingFee?.amount ?? getServiceBookingFee(job.service)))}
                          </Text>
                          <Text style={[styles.recentMeta, { color: colors.mutedForeground }]}>
                            {new Date(job.completedAt ?? job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <FloatingActionGroup
        hideBot={computedHideBot}
        hideSos={computedHideSos}
        onPressBot={onPressBot}
        onPressSos={onPressSos}
      />
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

function ServiceCard({ service, width, onPress }: { service: Service; width: number; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Request ${service.label}`}
      testID={`service-${service.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.categoryCard, { width, backgroundColor: colors.card, borderColor: pressed ? colors.primary : colors.border }]}
    >
      <View style={[styles.categoryIcon, { backgroundColor: colors.secondary }]}>
        <MaterialCommunityIcons name={service.icon} size={22} color={colors.primary} />
      </View>
      <Text style={[styles.categoryLabel, { color: colors.foreground }]}>{service.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { paddingHorizontal: SCREEN_GUTTER, gap: 17, paddingTop: 17 },
  searchBar: { minHeight: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6 },
  // minWidth 0 lets the field shrink; otherwise it pushes the buttons off-screen.
  searchInput: { flex: 1, minWidth: 0, fontFamily: 'Inter_500Medium', fontSize: 14, minHeight: 48 },
  searchText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14 },
  emergency: { minHeight: 112, borderRadius: 18, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  emergencyCopy: { flex: 1 },
  emergencyKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  emergencyTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 6 },
  emergencyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 5 },
  emergencyButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 2 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25, flexShrink: 1 },
  seeAll: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  // No fixed height: a card grows with its label (large system font sizes
  // included), and the row stretches its neighbours to match.
  categoryCard: { minHeight: 96, borderWidth: 1, borderRadius: 14, padding: 11, justifyContent: 'space-between' },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16, marginTop: 10 },
  recentList: { gap: 10 },
  recentCard: { minHeight: 68, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recentCopy: { flex: 1 },
  recentTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  recentMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  recentAmount: { alignItems: 'flex-end' },
  recentEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  recentEmptyText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  activeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  activeCopy: { flex: 1 },
  activeKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  activeTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 5 },
  activeBadgeRow: { marginTop: 8 },
  activeOpen: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 16, paddingLeft: 12, paddingRight: 8, paddingVertical: 7 },
  activeOpenText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});


