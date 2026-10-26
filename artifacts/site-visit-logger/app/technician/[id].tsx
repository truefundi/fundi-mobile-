import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PageHeading } from '@/components/ui/PageHeading';
import { useFundi } from '@/context/FundiContext';
import {
  MOCK_MARKETPLACE_TECHNICIANS,
  toJobTechnician,
  type MarketplaceTechnician,
} from '@/constants/technicians';
import { FLAT_BOOKING_FEE, FLAT_BOOKING_FEE_CURRENCY, formatBookingFee } from '@/constants/jobs';

export default function TechnicianProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getJob, createDraftRequest, selectTechnician } = useFundi();

  const {
    id: technicianId,
    requestId,
    service,
    problem,
    locationLabel,
  } = useLocalSearchParams<{
    id?: string;
    requestId?: string;
    service?: string;
    problem?: string;
    locationLabel?: string;
  }>();

  const job = requestId ? getJob(requestId) : undefined;

  const tech: MarketplaceTechnician | undefined = useMemo(() => {
    const found = MOCK_MARKETPLACE_TECHNICIANS.find((t) => t.id === technicianId);
    return found || MOCK_MARKETPLACE_TECHNICIANS[0];
  }, [technicianId]);

  const handleBookNow = () => {
    let finalRequestId = job?.id;

    if (!finalRequestId) {
      finalRequestId = createDraftRequest({
        service: service || tech?.service || 'General Maintenance',
        problem: problem || 'General Service Request',
        locationLabel: locationLabel || 'Kigali, Rwanda',
        urgency: 'Today',
        type: 'STANDARD',
        bookingFee: {
          amount: FLAT_BOOKING_FEE,
          currency: FLAT_BOOKING_FEE_CURRENCY,
          status: 'PENDING',
        },
      });
    }

    if (tech && finalRequestId) {
      selectTechnician(finalRequestId, toJobTechnician(tech));
    }

    // Explicitly route to Booking Fee review screen instead of launching chat immediately
    router.push({
      pathname: '/checkout/booking-fee',
      params: {
        requestId: finalRequestId,
        technicianId: tech?.id,
      },
    });
  };

  if (!tech) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.titleTop, { color: colors.foreground }]}>Technician Not Found</Text>
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
        {/* Header Profile Card */}
        <View style={[styles.profileHeaderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatarBig, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarBigText}>{tech.name[0]}</Text>
          </View>

          <View style={styles.nameBlock}>
            <View style={styles.verifiedRow}>
              <Text style={[styles.techName, { color: colors.foreground }]}>{tech.name}</Text>
              <Ionicons name="shield-checkmark" size={18} color={colors.success} />
            </View>
            <Text style={[styles.techTrade, { color: colors.mutedForeground }]}>{tech.service}</Text>
          </View>

          <View style={[styles.availChip, { backgroundColor: tech.isAvailable ? colors.success + '1A' : colors.muted }]}>
            <View
              style={[
                styles.availDot,
                { backgroundColor: tech.isAvailable ? colors.success : colors.mutedForeground },
              ]}
            />
            <Text style={{ color: tech.isAvailable ? colors.success : colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>
              {tech.isAvailable ? 'Available Now for Booking' : 'Currently Busy'}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statCol}>
            <View style={styles.statIconRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{tech.rating.toFixed(1)}</Text>
            </View>
            <Text style={[styles.statSub, { color: colors.mutedForeground }]}>{tech.reviewsCount} reviews</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <View style={styles.statIconRow}>
              <Ionicons name="checkmark-done" size={16} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{tech.jobsCompleted}</Text>
            </View>
            <Text style={[styles.statSub, { color: colors.mutedForeground }]}>Jobs Done</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <View style={styles.statIconRow}>
              <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{tech.yearsExperience} yrs</Text>
            </View>
            <Text style={[styles.statSub, { color: colors.mutedForeground }]}>Experience</Text>
          </View>
        </View>

        {/* Pricing Transparency Explainer */}
        <View style={[styles.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.pricingHeader}>
            <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
            <Text style={[styles.pricingTitle, { color: colors.foreground }]}>Transparent Fundi Pricing</Text>
          </View>
          <Text style={[styles.pricingBody, { color: colors.mutedForeground }]}>
            Pay only a single flat <Text style={{ color: colors.foreground, fontWeight: '700' }}>Service Booking Fee ({formatBookingFee()})</Text> to secure this technician and unlock direct chat.
          </Text>
          <Text style={[styles.pricingBody, { color: colors.mutedForeground, marginTop: 6 }]}>
            There are zero consultation or guarantee fees. Labor and repair materials are negotiated and settled directly with {tech.name}.
          </Text>
        </View>

        {/* Services & Trade Capabilities */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>Offered Services</Text>
          <View style={styles.pillWrap}>
            {tech.services.map((item) => (
              <View key={item} style={[styles.pill, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
                <Ionicons name="construct-outline" size={14} color={colors.primary} />
                <Text style={[styles.pillText, { color: colors.primary }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Settlement Notice */}
        <Notice
          tone="info"
          icon="shield-checkmark-outline"
          text="This booking fee secures your request and unlocks direct chat with your technician. The final cost of the repair/service will be agreed upon and settled directly between you and the technician."
        />
      </ScrollView>

      {/* Fixed Bottom CTA */}
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
        <Button
          label="Book Now"
          icon="calendar-outline"
          onPress={handleBookNow}
          testID="technician-book-now-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  profileHeaderCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  avatarBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#ffffff',
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
  techTrade: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  availChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
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
    backgroundColor: '#e5e7eb',
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
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
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
