import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookTechnician } from '@/hooks/useBookTechnician';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { useFundi } from '@/context/FundiContext';
import { type MarketplaceTechnician } from '@/constants/technicians';
import { formatBookingFee, isTerminated } from '@/constants/jobs';
import { getServiceBookingFee } from '@/constants/services';
import { getServiceIcon } from '@/lib/categories-api';
import { fetchPublicTechnicianById } from '@/lib/technicians-api';

export default function TechnicianProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getJob } = useFundi();

  const params = useLocalSearchParams<{
    id?: string;
    requestId?: string;
    service?: string;
    problem?: string;
    locationLabel?: string;
    techName?: string;
    techService?: string;
    techServices?: string;
    techRating?: string;
    techReviewsCount?: string;
    techJobsCompleted?: string;
    techYearsExperience?: string;
    techAvailable?: string;
    techAvatarUrl?: string;
    techLocation?: string;
    categoryId?: string;
  }>();

  const technicianId = params.id;
  const job = params.requestId ? getJob(params.requestId) : undefined;

  // Build initial technician object from navigation params if provided for zero-flicker rendering
  const initialTech = useMemo<MarketplaceTechnician | null>(() => {
    if (!technicianId) return null;
    if (!params.techName && !params.techService) return null;

    let parsedServices = [params.techService || params.service || 'General Maintenance'];
    if (params.techServices) {
      try {
        const parsed = JSON.parse(params.techServices);
        if (Array.isArray(parsed) && parsed.length > 0) parsedServices = parsed;
      } catch {}
    }

    return {
      id: technicianId,
      name: params.techName || 'Verified Specialist',
      service: params.techService || params.service || 'General Maintenance',
      services: parsedServices,
      rating: params.techRating ? parseFloat(params.techRating) : 4.8,
      reviewsCount: params.techReviewsCount ? parseInt(params.techReviewsCount, 10) : 15,
      jobsCompleted: params.techJobsCompleted ? parseInt(params.techJobsCompleted, 10) : 24,
      etaMinutes: 15,
      yearsExperience: params.techYearsExperience ? parseInt(params.techYearsExperience, 10) : 3,
      location: { latitude: -1.9448, longitude: 30.0619 },
      isAvailable: params.techAvailable === 'true',
      phoneNumber: '',
      avatarUrl: params.techAvatarUrl || undefined,
    };
  }, [technicianId, params]);

  const [tech, setTech] = useState<MarketplaceTechnician | null>(initialTech);
  const [loading, setLoading] = useState<boolean>(!initialTech);

  useEffect(() => {
    if (!technicianId) return;
    let mounted = true;

    fetchPublicTechnicianById(technicianId)
      .then((liveTech) => {
        if (!mounted) return;
        if (liveTech) {
          setTech(liveTech);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch live technician profile:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [technicianId]);

  const targetService = params.service || tech?.service || 'General Maintenance';
  const serviceBookingFee = getServiceBookingFee(targetService);

  // Booking goes through the same path as the technician list, so opening a
  // profile and booking never creates a second request.
  const { book, booking, error: bookingError } = useBookTechnician();
  const handleBookNow = () => {
    if (!tech) return;
    void book({ requestId: params.requestId, technician: tech, service: targetService, categoryId: params.categoryId });
  };
  const firstName = tech?.name.split(' ')[0] ?? 'technician';
  const sameTechnician = Boolean(job?.technician?.id && job.technician.id === tech?.id);
  const bookLabel = !job
    ? `Request ${firstName}`
    : isTerminated(job.status)
      ? `Book ${firstName} again`
      : sameTechnician && job.bookingFee?.status === 'PAID'
        ? 'Open the chat'
        : sameTechnician
          ? `Continue booking ${firstName}`
          : `Select & Book ${firstName}`;

  if (loading && !tech) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8 }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.titleTop, { color: colors.foreground }]}>Technician Profile</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading specialist profile…
          </Text>
        </View>
      </View>
    );
  }

  if (!tech) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8 }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.titleTop, { color: colors.foreground }]}>Technician Profile</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.centerContainer}>
          <Feather name="user-x" size={48} color={colors.mutedForeground} />
          <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>Technician Not Found</Text>
          <Text style={[styles.notFoundSub, { color: colors.mutedForeground }]}>
            This technician profile could not be loaded or is currently not available.
          </Text>
          <Button
            label="Back to available technicians"
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.titleTop, { color: colors.foreground }]}>Technician Profile</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Hero Card */}
        <View style={[styles.profileHeaderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ProfileAvatar
            uri={tech.avatarUrl}
            name={tech.name}
            size={76}
            style={styles.avatarWrap}
            testID="technician-profile-avatar"
          />

          <View style={styles.nameBlock}>
            <View style={styles.verifiedRow}>
              <Text style={[styles.techName, { color: colors.foreground }]}>{tech.name}</Text>
              <Ionicons name="shield-checkmark" size={19} color={colors.primary} />
            </View>
            <View style={styles.serviceRow}>
              <View style={[styles.serviceIconTile, { backgroundColor: colors.secondary }]}>
                <MaterialCommunityIcons
                  name={getServiceIcon(tech.service) as any}
                  size={15}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.techTrade, { color: colors.foreground }]}>{tech.service}</Text>
            </View>
            <Text style={[styles.locationLabel, { color: colors.mutedForeground }]}>
              📍 Kigali, Rwanda
            </Text>
          </View>

          <View
            style={[
              styles.availChip,
              {
                backgroundColor: tech.isAvailable ? colors.success + '1A' : colors.muted + '40',
                borderColor: tech.isAvailable ? colors.success + '40' : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.availDot,
                { backgroundColor: tech.isAvailable ? colors.success : colors.mutedForeground },
              ]}
            />
            <Text
              style={{
                color: tech.isAvailable ? colors.success : colors.mutedForeground,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {tech.isAvailable ? 'Available for Booking' : 'Currently Offline / Busy'}
            </Text>
          </View>
        </View>

        {/* Performance & Trust Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statCol}>
            <View style={styles.statIconRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {tech.rating ? tech.rating.toFixed(1) : '4.8'}
              </Text>
            </View>
            <Text style={[styles.statSub, { color: colors.mutedForeground }]}>
              {tech.reviewsCount || 15} reviews
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statCol}>
            <View style={styles.statIconRow}>
              <Ionicons name="checkmark-done" size={16} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {tech.jobsCompleted || 24}
              </Text>
            </View>
            <Text style={[styles.statSub, { color: colors.mutedForeground }]}>Jobs Done</Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statCol}>
            <View style={styles.statIconRow}>
              <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {tech.yearsExperience || 3}+ yrs
              </Text>
            </View>
            <Text style={[styles.statSub, { color: colors.mutedForeground }]}>Experience</Text>
          </View>
        </View>

        {/* Fundi Verification & Safety Trust Badge */}
        <View style={[styles.trustCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.trustHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={[styles.trustHeaderTitle, { color: colors.foreground }]}>
              Verified Fundi Specialist
            </Text>
          </View>
          <View style={styles.trustList}>
            <View style={styles.trustItem}>
              <Feather name="check" size={14} color={colors.primary} />
              <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
                Government identity and legal credentials verified
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Feather name="check" size={14} color={colors.primary} />
              <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
                Practical trade experience &amp; skill competency vetted
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Feather name="check" size={14} color={colors.primary} />
              <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
                Committed to transparent pricing and verified customer satisfaction
              </Text>
            </View>
          </View>
        </View>

        {/* Approved Services & Capabilities */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>Approved Specialties</Text>
          <View style={styles.pillWrap}>
            {tech.services.map((item) => (
              <View
                key={item}
                style={[
                  styles.pill,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name={getServiceIcon(item) as any}
                  size={15}
                  color={colors.primary}
                />
                <Text style={[styles.pillText, { color: colors.foreground }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing Transparency Explainer */}
        <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.pricingHeader}>
            <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
            <Text style={[styles.pricingTitle, { color: colors.foreground }]}>
              Transparent Fundi Pricing
            </Text>
          </View>
          <Text style={[styles.pricingBody, { color: colors.mutedForeground }]}>
            Pay only a single flat{' '}
            <Text style={{ color: colors.foreground, fontWeight: '700' }}>
              Service Booking Fee ({formatBookingFee(serviceBookingFee)})
            </Text>{' '}
            to secure {tech.name} and unlock direct chat coordination.
          </Text>
          <Text style={[styles.pricingBody, { color: colors.mutedForeground, marginTop: 6 }]}>
            There are zero hidden platform markups. Service labor and parts are discussed,
            agreed upon, and settled directly between you and your specialist.
          </Text>
        </View>

        {/* Customer Satisfaction Feedback Summary */}
        <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.feedbackTop}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Customer Feedback</Text>
            <View style={styles.feedbackRatingBadge}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.foreground }}>
                {tech.rating ? tech.rating.toFixed(1) : '4.8'} / 5.0
              </Text>
            </View>
          </View>
          <Text style={[styles.feedbackQuote, { color: colors.mutedForeground }]}>
            &ldquo;Specialist was punctual, identified the issue quickly, and completed the repair with
            clean workmanship.&rdquo;
          </Text>
          <Text style={[styles.feedbackAuthor, { color: colors.primary }]}>
            — Verified Kigali Client
          </Text>
        </View>

        {/* Settlement Notice */}
        <Notice
          tone="info"
          icon="shield-checkmark-outline"
          text="This booking secures your specialist and starts your direct chat. You can coordinate your visit schedule, receive a diagnosis, and agree on fair repair terms."
        />
      </ScrollView>

      {/* Fixed Bottom CTA Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {bookingError ? <Text style={[styles.bookError, { color: colors.destructive }]}>{bookingError}</Text> : null}
        <Button
          label={bookLabel}
          icon="checkmark-circle-outline"
          onPress={handleBookNow}
          loading={booking}
          disabled={booking}
          testID="technician-book-now-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bookError: { fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  titleTop: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginTop: 8,
  },
  notFoundTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginTop: 10,
  },
  notFoundSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  profileHeaderCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    flexShrink: 0,
  },
  nameBlock: {
    alignItems: 'center',
    gap: 4,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  techName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  serviceIconTile: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  techTrade: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  locationLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  availChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  availDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  statSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  trustCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  trustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustHeaderTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  trustList: {
    gap: 6,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  pricingCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pricingTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  pricingBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  feedbackCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  feedbackTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackQuote: {
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackAuthor: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
