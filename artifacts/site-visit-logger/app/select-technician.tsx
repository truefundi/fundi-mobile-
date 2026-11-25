import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeading } from '@/components/ui/PageHeading';
import { reviewsLabel, type MarketplaceTechnician } from '@/constants/technicians';
import { fetchPublicTechnicians } from '@/lib/technicians-api';
import { previewMatchingTechnicians, rememberRequestRoute, type MatchingTechnicianItem } from '@/lib/jobs-api';
import { useFundi } from '@/context/FundiContext';
import { useBookTechnician } from '@/hooks/useBookTechnician';
import { Notice } from '@/components/ui/Notice';
import { distanceMeters, formatDistance } from '@/lib/location';
import { getServiceIcon, resolveServiceCategoryId } from '@/lib/categories-api';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';


type SortKey = 'distance' | 'rating' | 'jobs' | 'experience';
type FilterKey = 'near' | 'rated' | 'experienced';

/** "Within 5 km" (straight line). */
const NEAR_METERS = 5000;

const SORTS: Array<{ key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'distance', label: 'Nearest', icon: 'navigate-outline' },
  { key: 'rating', label: 'Top rated', icon: 'star-outline' },
  { key: 'jobs', label: 'Most jobs', icon: 'checkmark-done-outline' },
  { key: 'experience', label: 'Most experienced', icon: 'briefcase-outline' },
];

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'near', label: 'Within 5 km' },
  { key: 'rated', label: '4★ and up' },
  { key: 'experienced', label: '5+ years' },
];

export default function SelectTechnicianScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    jobId,
    category,
    service: serviceParam,
    description,
    problem: problemParam,
    location: locationParam,
    address: addressParam,
    latitude: latParam,
    longitude: lngParam,
    categoryId,
  } = useLocalSearchParams<{
    jobId?: string;
    category?: string;
    categoryId?: string;
    service?: string;
    description?: string;
    problem?: string;
    location?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
  }>();
  const { getJob } = useFundi();
  const requestJob = jobId ? getJob(jobId) : undefined;
  // The list only holds technicians who can take the job now; these narrow and order it.
  const [sortBy, setSortBy] = useState<SortKey>('distance');
  const [only, setOnly] = useState<Record<FilterKey, boolean>>({ near: false, rated: false, experienced: false });
  const activeFilters = (Object.keys(only) as FilterKey[]).filter((key) => only[key]);
  const toggleFilter = (key: FilterKey) => setOnly((current) => ({ ...current, [key]: !current[key] }));
  const clearFilters = () => setOnly({ near: false, rated: false, experienced: false });
  const [apiTechnicians, setApiTechnicians] = useState<MarketplaceTechnician[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(true);

  const service = requestJob?.service ?? category ?? serviceParam;
  const problem = requestJob?.problem ?? description ?? problemParam;
  const locationLabel = requestJob?.locationLabel ?? locationParam ?? addressParam;
  const locationLatitude =
    requestJob?.locationLatitude ?? (latParam ? parseFloat(latParam) : undefined);
  const locationLongitude =
    requestJob?.locationLongitude ?? (lngParam ? parseFloat(lngParam) : undefined);

  // The backend only accepts a request for technicians it considers eligible for this job
  // (right service, within range, online). Ask it for that list so the client can't pick
  // someone the request would never reach.
  const categoryHint = requestJob?.serviceCategoryId || categoryId;
  const [eligibleIds, setEligibleIds] = useState<Set<string> | null>(null);
  // Offline technicians can still be sent a request; they have two hours to reply.
  const [offlineMatches, setOfflineMatches] = useState<MatchingTechnicianItem[]>([]);
  // Technicians who work as an approved company: the request goes to the company.
  const [companies, setCompanies] = useState<Map<string, { id: string; name: string }>>(new Map());
  useEffect(() => {
    if (!service || locationLatitude === undefined || locationLongitude === undefined) {
      setEligibleIds(null);
      setOfflineMatches([]);
      return;
    }
    let mounted = true;
    resolveServiceCategoryId(service, categoryHint)
      .then((serviceCategoryId) =>
        previewMatchingTechnicians(serviceCategoryId, locationLatitude, locationLongitude, { includeOffline: true }),
      )
      .then((matches) => {
        if (!mounted) return;
        const offline = (match: MatchingTechnicianItem) => match.availabilityStatus === 'OFFLINE';
        setEligibleIds(new Set(matches.filter((match) => !offline(match)).map((match) => match.technicianId)));
        setOfflineMatches(matches.filter(offline));
        setCompanies(
          new Map(
            matches.flatMap((match) => (match.company ? [[match.technicianId, match.company] as const] : [])),
          ),
        );
      })
      .catch((err) => {
        // Fall back to the public list; the chat reports it if routing then fails.
        console.warn('Could not load eligible technicians:', err);
        if (mounted) {
          setEligibleIds(null);
          setOfflineMatches([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [service, categoryHint, locationLatitude, locationLongitude]);

  useEffect(() => {
    let mounted = true;
    setLoadingTechs(true);
    fetchPublicTechnicians()
      .then((techs) => {
        if (!mounted) return;
        setApiTechnicians(techs);
      })
      .catch((err) => {
        console.warn('Could not fetch public technicians:', err);
      })
      .finally(() => {
        if (mounted) setLoadingTechs(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const technicians = useMemo(() => {
    const requestedService = (service ?? '').toLowerCase().trim();
    const matchesService = (tech: MarketplaceTechnician) => {
      if (!requestedService) return true;
      // 1. Direct match in offered services
      const directMatch = tech.services.some((offered) => {
        const offNorm = offered.toLowerCase().trim();
        return (
          offNorm === requestedService ||
          offNorm.includes(requestedService) ||
          requestedService.includes(offNorm)
        );
      });
      if (directMatch) return true;

      // 2. Skill/trade title match (e.g. "HVAC & Appliance Specialist" matches "HVAC & Refrigeration")
      const titleNorm = tech.service.toLowerCase().trim();
      if (titleNorm.includes(requestedService) || requestedService.includes(titleNorm)) {
        return true;
      }

      // 3. Emergency / SOS fallback
      if (requestedService.includes('emergency') || requestedService.includes('sos')) {
        return tech.services.includes('General Maintenance') || tech.services.includes('Home Repair');
      }

      return false;
    };

    // Backend-eligible technicians only when the API told us who they are; no loose
    // fallback that the request could never reach. Otherwise match by service name.
    const pool = eligibleIds
      ? apiTechnicians.filter((tech) => eligibleIds.has(tech.id))
      : (() => {
          const direct = apiTechnicians.filter(matchesService);
          return direct.length > 0 ? direct : apiTechnicians;
        })();

    const rows = pool.map((technician) => ({
      technician,
      distance:
        locationLatitude !== undefined && locationLongitude !== undefined
          ? distanceMeters({ latitude: locationLatitude, longitude: locationLongitude }, technician.location)
          : null,
    }));

    const filtered = rows.filter(({ technician, distance }) => {
      if (only.near && (distance === null || distance > NEAR_METERS)) return false;
      if (only.rated && (technician.rating === null || technician.rating < 4 || !technician.reviewsCount)) return false;
      if (only.experienced && technician.yearsExperience < 5) return false;
      return true;
    });

    const byDistance = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
      if (a.distance === null) return b.distance === null ? 0 : 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    };
    return filtered.sort((a, b) => {
      if (sortBy === 'rating') {
        return (
          (b.technician.rating ?? -1) - (a.technician.rating ?? -1) ||
          b.technician.reviewsCount - a.technician.reviewsCount ||
          byDistance(a, b)
        );
      }
      if (sortBy === 'jobs') return b.technician.jobsCompleted - a.technician.jobsCompleted || byDistance(a, b);
      if (sortBy === 'experience') return b.technician.yearsExperience - a.technician.yearsExperience || byDistance(a, b);
      return byDistance(a, b);
    });
  }, [apiTechnicians, eligibleIds, only, locationLatitude, locationLongitude, service, sortBy]);

  const offlineTechnicians = useMemo(
    () =>
      offlineMatches
        .map((match) => {
          const services = match.serviceExperiences
            .map((row) => row.category?.name ?? row.customName ?? '')
            .filter(Boolean);
          const technician: MarketplaceTechnician = {
            id: match.technicianId,
            name: match.fullName,
            service: services[0] ?? service ?? 'Technician',
            services,
            rating: null,
            reviewsCount: 0,
            jobsCompleted: 0,
            etaMinutes: 0,
            yearsExperience: match.yearsOfExperience,
            location: undefined as unknown as MarketplaceTechnician['location'],
            isAvailable: true,
            phoneNumber: '',
            avatarUrl: match.profilePictureUrl ?? undefined,
          };
          return { technician, distance: match.distanceMeters, place: match.publicLocationLabel };
        })
        .filter(({ technician, distance }) => {
          if (only.near && (distance === null || distance > NEAR_METERS)) return false;
          if (only.rated) return false; // no ratings shown for these
          if (only.experienced && technician.yearsExperience < 5) return false;
          return true;
        })
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)),
    [offlineMatches, only, service],
  );

  // Booking goes through one shared path so a request is never created twice.
  const { book, booking, error: bookingError } = useBookTechnician();
  const handleSelectTech = (tech: MarketplaceTechnician, offline = false) => {
    // The request goes to their company, or as the two-hour offline request.
    const company = companies.get(tech.id);
    rememberRequestRoute(tech.id, company ? { companyId: company.id } : { offline });
    const requestLocation =
      locationLatitude !== undefined && locationLongitude !== undefined
        ? { latitude: locationLatitude, longitude: locationLongitude }
        : undefined;
    const meters = requestLocation && tech.location ? distanceMeters(requestLocation, tech.location) : null;
    void book({
      requestId: jobId || requestJob?.id,
      technician: tech,
      distanceKm: meters !== null ? Math.round((meters / 1000) * 10) / 10 : undefined,
      service,
      categoryId: categoryHint,
    });
  };

  /** One technician card; offline ones get the two-hour request. */
  const renderCard = (item: MarketplaceTechnician, distance: number | null, offline = false) => {
    const company = companies.get(item.id);
    return (
          <Pressable
            disabled={!item.isAvailable || booking}
            onPress={() => handleSelectTech(item, offline)}
            testID={offline ? `offline-tech-${item.id}` : `tech-card-${item.id}`}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: item.isAvailable ? 1 : 0.6 },
            ]}
          >
            <View style={styles.cardHeader}>
              <ProfileAvatar
                uri={item.avatarUrl}
                name={item.name}
                size={44}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.techName, { color: colors.foreground }]}>{item.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <MaterialCommunityIcons
                    name={getServiceIcon(item.service) as any}
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={[styles.techService, { color: colors.mutedForeground }]}>{item.service}</Text>
                </View>
                {company ? (
                  <View style={styles.companyRow} testID={`tech-company-${item.id}`}>
                    <Ionicons name="business-outline" size={12} color={colors.primary} />
                    <Text style={[styles.companyText, { color: colors.primary }]} numberOfLines={1}>
                      Company · {company.name}
                    </Text>
                  </View>
                ) : null}
              </View>
              {offline ? (
                <View style={[styles.statusBadge, { backgroundColor: colors.muted }]}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>Offline</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: item.isAvailable ? colors.success + '20' : colors.muted }]}>
                  <Text style={{ color: item.isAvailable ? colors.success : colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>
                    {item.isAvailable ? 'Available' : 'Busy'}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <View style={styles.metaItem}>
                {offline ? (
                  <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                ) : (
                  <Ionicons name="star" size={14} color="#F59E0B" />
                )}
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {offline ? 'Replies within 2 hours' : reviewsLabel(item.rating, item.reviewsCount)}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {formatDistance(distance) ?? 'Distance unavailable'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name} profile`}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({
                    pathname: `/technician/${item.id}` as any,
                    params: {
                      requestId: jobId || requestJob?.id,
                      service: service || item.service,
                      problem,
                      locationLabel,
                      techName: item.name,
                      techService: item.service,
                      techServices: JSON.stringify(item.services),
                      techRating: item.rating === null ? '' : String(item.rating),
                      techReviewsCount: String(item.reviewsCount),
                      techJobsCompleted: String(item.jobsCompleted),
                      techYearsExperience: String(item.yearsExperience),
                      techAvailable: item.isAvailable ? 'true' : 'false',
                      techAvatarUrl: item.avatarUrl || '',
                      techLocation: item.location ? `${item.location.latitude},${item.location.longitude}` : '',
                    },
                  });
                }}
                style={[styles.profilePill, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.profilePillText, { color: colors.primary }]}>Profile →</Text>
              </Pressable>
            </View>
          </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8 }]}>
        {/* Back to the request review (or wherever the list was opened from). */}
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/activity'))} />
        <Text style={[styles.titleTop, { color: colors.foreground }]}>Choose Technician</Text>
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={technicians}
        keyExtractor={(item) => item.technician.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <PageHeading
              eyebrow={service || 'Available Specialists'}
              title="Select an available technician"
              subtitle="Everyone here can take this job now. Sort or narrow the list; distance is a straight line."
            />
            {bookingError ? <Notice tone="warning" icon="alert-circle-outline" text={bookingError} /> : null}
            {(service || problem || locationLabel) && (
              <View style={[styles.prefillBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.prefillBannerTop}>
                  <View style={[styles.prefillIconWrap, { backgroundColor: colors.primary + '18' }]}>
                    <Ionicons name="repeat" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.prefillTitle, { color: colors.foreground }]}>
                      {requestJob?.status === 'CANCELLED' || requestJob?.status === 'DECLINED'
                        ? 'Rebooking Service Request'
                        : 'Pre-filled Request Details'}
                    </Text>
                    <Text style={[styles.prefillSub, { color: colors.mutedForeground }]}>
                      Select the next available technician to continue your request.
                    </Text>
                  </View>
                </View>
                <View style={[styles.prefillContent, { borderTopColor: colors.border }]}>
                  {service ? (
                    <View style={styles.prefillItem}>
                      <Text style={[styles.prefillLabel, { color: colors.mutedForeground }]}>Category:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <MaterialCommunityIcons
                          name={getServiceIcon(service) as any}
                          size={15}
                          color={colors.primary}
                        />
                        <Text style={[styles.prefillValue, { color: colors.foreground }]}>{service}</Text>
                      </View>
                    </View>
                  ) : null}
                  {problem ? (
                    <View style={styles.prefillItem}>
                      <Text style={[styles.prefillLabel, { color: colors.mutedForeground }]}>Description:</Text>
                      <Text numberOfLines={2} style={[styles.prefillValue, { color: colors.foreground, flex: 1 }]}>
                        {problem}
                      </Text>
                    </View>
                  ) : null}
                  {locationLabel ? (
                    <View style={styles.prefillItem}>
                      <Text style={[styles.prefillLabel, { color: colors.mutedForeground }]}>Location:</Text>
                      <Text numberOfLines={1} style={[styles.prefillValue, { color: colors.foreground, flex: 1 }]}>
                        {locationLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}
            <View style={styles.controls}>
              <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>Sort by</Text>
              <View style={styles.filters} accessibilityRole="radiogroup">
                {SORTS.map((option) => {
                  const selected = sortBy === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setSortBy(option.key)}
                      testID={`tech-sort-${option.key}`}
                      style={[
                        styles.filterChip,
                        { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border },
                      ]}
                    >
                      <Ionicons name={option.icon} size={13} color={selected ? colors.primaryForeground : colors.mutedForeground} />
                      <Text style={[styles.filterText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>Show only</Text>
              <View style={styles.filters}>
                {FILTERS.map((option) => {
                  const on = only[option.key];
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      onPress={() => toggleFilter(option.key)}
                      testID={`tech-filter-${option.key}`}
                      style={[
                        styles.filterChip,
                        { backgroundColor: on ? colors.primary + '18' : colors.card, borderColor: on ? colors.primary : colors.border },
                      ]}
                    >
                      <Ionicons
                        name={on ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={on ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.filterText, { color: on ? colors.primary : colors.foreground }]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {!loadingTechs ? (
                <View style={styles.resultRow}>
                  <Text style={[styles.resultText, { color: colors.mutedForeground }]} testID="tech-result-count">
                    {technicians.length} {technicians.length === 1 ? 'technician' : 'technicians'}
                    {activeFilters.length ? (technicians.length === 1 ? ' matches your filters' : ' match your filters') : ' for this request'}
                  </Text>
                  {activeFilters.length ? (
                    <Pressable accessibilityRole="button" onPress={clearFilters} hitSlop={6} testID="tech-clear-filters">
                      <Text style={[styles.clearText, { color: colors.primary }]}>Clear filters</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingTechs ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, marginTop: 8 }]}>
                Finding verified technicians…
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, paddingVertical: 0 }]}>
                {activeFilters.length
                  ? 'No technician matches these filters.'
                  : offlineTechnicians.length
                    ? 'Nobody is online for this right now. You can still send it to an offline technician below.'
                    : 'No technician for this service is available near this address right now.'}
              </Text>
              {activeFilters.length ? (
                <Pressable accessibilityRole="button" onPress={clearFilters} testID="tech-empty-clear">
                  <Text style={[styles.clearText, { color: colors.primary }]}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item: { technician, distance } }) => renderCard(technician, distance)}
        ListFooterComponent={
          offlineTechnicians.length ? (
            <View style={styles.offlineSection} testID="offline-technicians">
              <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>Offline technicians</Text>
              <Text style={[styles.offlineHint, { color: colors.mutedForeground }]}>
                Not online now, but you can still send them your request. They have 2 hours to reply; if they don't, your booking fee still covers another technician.
              </Text>
              {offlineTechnicians.map(({ technician, distance }) => (
                <React.Fragment key={technician.id}>{renderCard(technician, distance, true)}</React.Fragment>
              ))}
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleTop: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 12 },
  listHeader: { gap: 16, marginBottom: 8 },
  controls: { gap: 8 },
  controlLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  resultText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  clearText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  filterText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  prefillBanner: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  prefillBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prefillIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  prefillTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  prefillSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  prefillContent: { paddingTop: 8, borderTopWidth: 1, gap: 4 },
  prefillItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  prefillLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  prefillValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  techName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  techService: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  profilePill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  companyText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, flexShrink: 1 },
  offlineSection: { gap: 12, marginTop: 20 },
  offlineHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  profilePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});