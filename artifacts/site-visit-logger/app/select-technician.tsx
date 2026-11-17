import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { continueToCheckout } from '@/lib/checkout-nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeading } from '@/components/ui/PageHeading';
import { toJobTechnician, type MarketplaceTechnician } from '@/constants/technicians';
import { fetchPublicTechnicians } from '@/lib/technicians-api';
import { previewMatchingTechnicians } from '@/lib/jobs-api';
import { useFundi } from '@/context/FundiContext';
import { useChat } from '@/context/ChatContext';
import { distanceMeters, formatDistance } from '@/lib/location';
import { getServiceIcon, resolveServiceCategoryId } from '@/lib/categories-api';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';

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
  const { getJob, selectTechnician, linkChatThread, addRequest, proposeTechnicianToJob } = useFundi();
  const { createOrGetThread } = useChat();
  const requestJob = jobId ? getJob(jobId) : undefined;
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');
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
  useEffect(() => {
    if (!service || locationLatitude === undefined || locationLongitude === undefined) {
      setEligibleIds(null);
      return;
    }
    let mounted = true;
    resolveServiceCategoryId(service, categoryHint)
      .then((serviceCategoryId) => previewMatchingTechnicians(serviceCategoryId, locationLatitude, locationLongitude))
      .then((matches) => {
        if (mounted) setEligibleIds(new Set(matches.map((match) => match.technicianId)));
      })
      .catch((err) => {
        // Fall back to the public list; the chat reports it if routing then fails.
        console.warn('Could not load eligible technicians:', err);
        if (mounted) setEligibleIds(null);
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

    if (eligibleIds) {
      // Backend-eligible technicians only; no loose fallback that the request could never reach.
      return apiTechnicians
        .filter((tech) => eligibleIds.has(tech.id) && (!availableOnly || tech.isAvailable))
        .map((technician) => ({
          technician,
          distance:
            locationLatitude !== undefined && locationLongitude !== undefined
              ? distanceMeters({ latitude: locationLatitude, longitude: locationLongitude }, technician.location)
              : null,
        }))
        .sort((a, b) => {
          if (sortBy === 'rating') return b.technician.rating - a.technician.rating;
          if (a.distance === null) return b.distance === null ? 0 : 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
    }

    const directFiltered = apiTechnicians.filter(
      (tech) => (!availableOnly || tech.isAvailable) && matchesService(tech),
    );

    // Fallback: if no technician directly matches the niche trade, include available specialists
    const pool = directFiltered.length > 0
      ? directFiltered
      : apiTechnicians.filter((tech) => !availableOnly || tech.isAvailable);

    return pool
      .map((technician) => ({
        technician,
        distance:
          locationLatitude !== undefined && locationLongitude !== undefined
            ? distanceMeters(
                { latitude: locationLatitude, longitude: locationLongitude },
                technician.location,
              )
            : null,
      }))
      .sort((a, b) => {
        if (sortBy === 'rating') return b.technician.rating - a.technician.rating;
        if (a.distance === null) return b.distance === null ? 0 : 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }, [apiTechnicians, eligibleIds, availableOnly, locationLatitude, locationLongitude, service, sortBy]);

  const handleSelectTech = async (tech: MarketplaceTechnician) => {
    let targetJob = requestJob;
    const requestLocation =
      locationLatitude !== undefined && locationLongitude !== undefined
        ? { latitude: locationLatitude, longitude: locationLongitude }
        : undefined;

    if (!targetJob) {
      const newJobId = await addRequest({
        service: service || 'General Maintenance',
        problem: problem || 'General Service Request',
        urgency: 'Today',
        locationLabel: locationLabel || 'Location not specified',
        locationLatitude,
        locationLongitude,
      });
      targetJob = getJob(newJobId);
    }

    if (!targetJob) return;

    const meters =
      requestLocation && tech.location ? distanceMeters(requestLocation, tech.location) : null;
    const distKm = meters !== null ? Math.round((meters / 1000) * 10) / 10 : undefined;

    selectTechnician(targetJob.id, toJobTechnician(tech, distKm));

    // Already paid: route the request straight to this technician's inbox (no second payment)
    // and continue in the chat, which shows the delivery status.
    if (targetJob.bookingFee?.status === 'PAID') {
      let proposalError: string | undefined;
      try {
        await proposeTechnicianToJob(targetJob.id, tech.id);
      } catch (err) {
        proposalError = err instanceof Error ? err.message : 'The request could not be sent to this technician.';
      }
      router.replace({
        pathname: '/chat/[id]',
        params: {
          id: targetJob.id,
          requestId: targetJob.id,
          technicianId: tech.id,
          ...(proposalError ? { proposalError } : {}),
        },
      });
      return;
    }

    // Booking fee next; an unverified phone is confirmed with a code first.
    await continueToCheckout(router, {
      requestId: targetJob.id,
      technicianId: tech.id,
      service: targetJob.service,
      categoryId: targetJob.serviceCategoryId || categoryId,
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8 }]}>
        <BackButton onPress={() => router.back()} />
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
              subtitle="Browse specialists by availability, rating, and proximity. Distance is straight-line."
            />
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
            <View style={styles.filters}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !availableOnly }}
                onPress={() => setAvailableOnly(false)}
                style={[styles.filterChip, { backgroundColor: !availableOnly ? colors.primary : colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.filterText, { color: !availableOnly ? colors.primaryForeground : colors.foreground }]}>All matches</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: availableOnly }}
                onPress={() => setAvailableOnly(true)}
                style={[styles.filterChip, { backgroundColor: availableOnly ? colors.primary : colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.filterText, { color: availableOnly ? colors.primaryForeground : colors.foreground }]}>Available</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: sortBy === 'distance' }}
                onPress={() => setSortBy('distance')}
                style={[styles.filterChip, { backgroundColor: sortBy === 'distance' ? colors.secondary : colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.filterText, { color: sortBy === 'distance' ? colors.primary : colors.foreground }]}>Nearest</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: sortBy === 'rating' }}
                onPress={() => setSortBy('rating')}
                style={[styles.filterChip, { backgroundColor: sortBy === 'rating' ? colors.secondary : colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.filterText, { color: sortBy === 'rating' ? colors.primary : colors.foreground }]}>Top rated</Text>
              </Pressable>
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
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No technicians match this service and availability filter yet.
            </Text>
          )
        }
        renderItem={({ item: { technician: item, distance } }) => (
          <Pressable
            disabled={!item.isAvailable}
            onPress={() => handleSelectTech(item)}
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
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.isAvailable ? colors.success + '20' : colors.muted }]}>
                <Text style={{ color: item.isAvailable ? colors.success : colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>
                  {item.isAvailable ? 'Available' : 'Busy'}
                </Text>
              </View>
            </View>

            <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
              <View style={styles.metaItem}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={[styles.metaText, { color: colors.foreground }]}>{item.rating} ({item.reviewsCount} reviews)</Text>
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
                      requestId: requestJob?.id,
                      service: service || item.service,
                      problem,
                      locationLabel,
                      techName: item.name,
                      techService: item.service,
                      techServices: JSON.stringify(item.services),
                      techRating: String(item.rating),
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
        )}
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
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
  profilePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});