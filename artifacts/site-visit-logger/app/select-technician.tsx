import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeading } from '@/components/ui/PageHeading';
import { MOCK_MARKETPLACE_TECHNICIANS, toJobTechnician, type MarketplaceTechnician } from '@/constants/technicians';
import { useFundi } from '@/context/FundiContext';
import { useChat } from '@/context/ChatContext';
import { distanceMeters, formatDistance } from '@/lib/location';

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
  } = useLocalSearchParams<{
    jobId?: string;
    category?: string;
    service?: string;
    description?: string;
    problem?: string;
    location?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
  }>();
  const { getJob, selectTechnician, linkChatThread, addRequest } = useFundi();
  const { createOrGetThread } = useChat();
  const requestJob = jobId ? getJob(jobId) : undefined;
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const service = requestJob?.service ?? category ?? serviceParam;
  const problem = requestJob?.problem ?? description ?? problemParam;
  const locationLabel = requestJob?.locationLabel ?? locationParam ?? addressParam;
  const locationLatitude =
    requestJob?.locationLatitude ?? (latParam ? parseFloat(latParam) : undefined);
  const locationLongitude =
    requestJob?.locationLongitude ?? (lngParam ? parseFloat(lngParam) : undefined);

  const technicians = useMemo(() => {
    const requestedService = (service ?? '').toLowerCase();
    const matchesService = (tech: MarketplaceTechnician) => {
      if (!requestedService) return true;
      return tech.services.some((offered) => offered.toLowerCase() === requestedService) ||
        (requestedService === 'emergency service' && tech.services.includes('General Maintenance'));
    };

    return MOCK_MARKETPLACE_TECHNICIANS
      .filter((tech) => (!availableOnly || tech.isAvailable) && matchesService(tech))
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
  }, [availableOnly, locationLatitude, locationLongitude, service, sortBy]);

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

    selectTechnician(targetJob.id, toJobTechnician(tech, requestLocation));
    router.push({
      pathname: '/checkout/booking-fee',
      params: {
        requestId: targetJob.id,
        technicianId: tech.id,
      },
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
                      <Text style={[styles.prefillValue, { color: colors.foreground }]}>{service}</Text>
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
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No technicians match this service and availability filter yet.
          </Text>
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
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>{item.name[0]}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.techName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.techService, { color: colors.mutedForeground }]}>{item.service}</Text>
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
                onPress={() => {
                  router.push({
                    pathname: `/technician/${item.id}` as any,
                    params: {
                      requestId: requestJob?.id,
                      service,
                      problem,
                      locationLabel,
                    },
                  });
                }}
                style={{ paddingVertical: 4, paddingHorizontal: 6 }}
              >
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.primary }}>Profile →</Text>
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
});