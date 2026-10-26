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
import { SectionCard } from '@/components/ui/SectionCard';
import { useFundi } from '@/context/FundiContext';
import {
  MOCK_MARKETPLACE_TECHNICIANS,
  toJobTechnician,
  type MarketplaceTechnician,
} from '@/constants/technicians';
import {
  FLAT_BOOKING_FEE,
  FLAT_BOOKING_FEE_CURRENCY,
  formatBookingFee,
} from '@/constants/jobs';

export default function BookingFeeReviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getJob, createDraftRequest, selectTechnician } = useFundi();

  const params = useLocalSearchParams<{
    requestId?: string;
    technicianId?: string;
    service?: string;
    problem?: string;
    locationLabel?: string;
    address?: string;
    lat?: string;
    lng?: string;
  }>();

  const job = params.requestId ? getJob(params.requestId) : undefined;

  // Resolve technician from job or technicianId parameter
  const technician: MarketplaceTechnician | undefined = useMemo(() => {
    if (params.technicianId) {
      const match = MOCK_MARKETPLACE_TECHNICIANS.find((t) => t.id === params.technicianId);
      if (match) return match;
    }
    if (job?.technician) {
      const match = MOCK_MARKETPLACE_TECHNICIANS.find((t) => t.id === job.technician?.id);
      if (match) return match;
      return {
        id: job.technician.id,
        name: job.technician.name,
        service: job.technician.skill,
        services: [job.technician.skill],
        rating: job.technician.rating,
        reviewsCount: 45,
        jobsCompleted: job.technician.jobsCompleted,
        etaMinutes: job.technician.etaMinutes,
        yearsExperience: job.technician.yearsExperience,
        location: job.technician.location ?? { latitude: -1.9448, longitude: 30.0619 },
        isAvailable: true,
        phoneNumber: job.technician.phone,
      };
    }
    return MOCK_MARKETPLACE_TECHNICIANS[0];
  }, [job?.technician, params.technicianId]);

  const serviceName = job?.service || params.service || 'General Maintenance';
  const problemDesc = job?.problem || params.problem || 'Standard Service Request';
  const locationText = job?.locationLabel || params.locationLabel || params.address || 'Kigali, Rwanda';

  const bookingAmount = job?.bookingFee?.amount ?? FLAT_BOOKING_FEE;
  const bookingCurrency = job?.bookingFee?.currency ?? FLAT_BOOKING_FEE_CURRENCY;

  const handleProceedToPayment = () => {
    let finalRequestId = job?.id;

    if (!finalRequestId) {
      finalRequestId = createDraftRequest({
        service: serviceName,
        problem: problemDesc,
        locationLabel: locationText,
        urgency: 'Today',
        type: 'STANDARD',
        bookingFee: {
          amount: bookingAmount,
          currency: bookingCurrency,
          status: 'PENDING',
        },
      });
    }

    if (technician && finalRequestId) {
      selectTechnician(finalRequestId, toJobTechnician(technician));
    }

    router.push({
      pathname: '/checkout/payment',
      params: {
        requestId: finalRequestId,
        technicianId: technician?.id,
        amount: bookingAmount.toString(),
        currency: bookingCurrency,
      },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Header */}
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
        <Text style={[styles.titleTop, { color: colors.foreground }]}>Review Booking</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeading
          eyebrow="UPFRONT CHECKOUT"
          title="Service Booking Fee"
          subtitle="Confirm your booking fee to unlock direct messaging and coordinate the service call."
        />

        {/* Selected Technician Summary Card */}
        {technician && (
          <View style={[styles.techCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.techHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{technician.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={[styles.techName, { color: colors.foreground }]}>
                    {technician.name}
                  </Text>
                  <View style={[styles.verifiedBadge, { backgroundColor: colors.success + '1A' }]}>
                    <Ionicons name="shield-checkmark" size={13} color={colors.success} />
                    <Text style={[styles.verifiedText, { color: colors.success }]}>Verified Pro</Text>
                  </View>
                </View>
                <Text style={[styles.techSkill, { color: colors.mutedForeground }]}>
                  {technician.service}
                </Text>
              </View>
            </View>

            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
              <View style={styles.statItem}>
                <View style={styles.iconValRow}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={[styles.statVal, { color: colors.foreground }]}>
                    {technician.rating.toFixed(1)}
                  </Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  {technician.reviewsCount} reviews
                </Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={styles.iconValRow}>
                  <Ionicons name="checkmark-done-circle-outline" size={14} color={colors.primary} />
                  <Text style={[styles.statVal, { color: colors.foreground }]}>
                    {technician.jobsCompleted}
                  </Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Completed</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={styles.iconValRow}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={[styles.statVal, { color: colors.foreground }]}>
                    {technician.etaMinutes} min
                  </Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Est. ETA</Text>
              </View>
            </View>
          </View>
        )}

        {/* Flat Booking Fee Price Display */}
        <SectionCard emphasis>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceEyebrow, { color: colors.primaryForeground }]}>
              TOTAL PAYABLE UPFRONT
            </Text>
            <Text style={[styles.priceAmount, { color: colors.primaryForeground }]}>
              {formatBookingFee(bookingAmount, bookingCurrency)}
            </Text>
            <Text style={[styles.priceDesc, { color: colors.secondary }]}>
              Single flat platform Service Booking Fee
            </Text>
          </View>

          <View style={[styles.includedList, { borderTopColor: 'rgba(255,255,255,0.15)' }]}>
            <View style={styles.includedItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primaryForeground} />
              <Text style={[styles.includedText, { color: colors.primaryForeground }]}>
                Unlocks instant direct messaging with your technician
              </Text>
            </View>
            <View style={styles.includedItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primaryForeground} />
              <Text style={[styles.includedText, { color: colors.primaryForeground }]}>
                Secures technician priority scheduling
              </Text>
            </View>
            <View style={styles.includedItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primaryForeground} />
              <Text style={[styles.includedText, { color: colors.primaryForeground }]}>
                Zero hidden consultation or service guarantee fees
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Required Settlement Transparency Notice */}
        <Notice
          tone="info"
          icon="information-circle-outline"
          text="This booking fee secures your request and unlocks direct chat with your technician. The final cost of the repair/service will be agreed upon and settled directly between you and the technician."
        />

        {/* Request Context Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Service Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Category:</Text>
            <Text style={[styles.summaryVal, { color: colors.foreground }]}>{serviceName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Problem:</Text>
            <Text numberOfLines={2} style={[styles.summaryVal, { color: colors.foreground, flex: 1, textAlign: 'right' }]}>
              {problemDesc}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Location:</Text>
            <Text numberOfLines={1} style={[styles.summaryVal, { color: colors.foreground, flex: 1, textAlign: 'right' }]}>
              {locationText}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom CTA */}
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
        <View style={styles.totalRow}>
          <View>
            <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>Due now</Text>
            <Text style={[styles.footerPrice, { color: colors.foreground }]}>
              {formatBookingFee(bookingAmount, bookingCurrency)}
            </Text>
          </View>
          <Button
            label="Proceed to Pay Booking Fee"
            icon="arrow-forward"
            onPress={handleProceedToPayment}
            style={{ flex: 1, marginLeft: 16 }}
            testID="proceed-to-pay-booking-fee-button"
          />
        </View>
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
  techCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  techHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#ffffff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  techName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  techSkill: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
  },
  iconValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  priceContainer: {
    alignItems: 'flex-start',
    gap: 4,
  },
  priceEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  priceAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 38,
    letterSpacing: -1,
  },
  priceDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  includedList: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    gap: 8,
  },
  includedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  includedText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    flex: 1,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  summaryTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  summaryVal: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  footerPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
});
