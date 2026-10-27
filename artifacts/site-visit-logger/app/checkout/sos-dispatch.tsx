import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFundi } from '@/context/FundiContext';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import {
  MOCK_MARKETPLACE_TECHNICIANS,
  toJobTechnician,
  type MarketplaceTechnician,
} from '@/constants/technicians';
import {
  EMERGENCY_DISPATCH_FEE,
  formatBookingFee,
} from '@/constants/jobs';
import { notify, vibrate } from '@/lib/haptics';

type PaymentChannel = 'MTN_MOMO' | 'AIRTEL_MONEY' | 'CARD_WALLET';

interface PaymentOption {
  id: PaymentChannel;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'MTN_MOMO',
    title: 'MTN Mobile Money',
    detail: 'Instant push prompt (USSD confirmation)',
    icon: 'phone-portrait-outline',
    badge: 'Popular in Rwanda',
  },
  {
    id: 'AIRTEL_MONEY',
    title: 'Airtel Money',
    detail: 'Instant mobile wallet prompt',
    icon: 'phone-portrait-outline',
  },
  {
    id: 'CARD_WALLET',
    title: 'Credit / Debit Card or Wallet',
    detail: 'Instant authorization',
    icon: 'card-outline',
  },
];

type DispatchPhase = 'REVIEW' | 'AUTHORIZING' | 'SEARCHING_DISPATCH' | 'ACCEPTED';

export default function SosDispatchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const {
    getJob,
    createDraftRequest,
    markBookingFeePaid,
    assignEmergencyTechnician,
    linkChatThread,
  } = useFundi();
  const { createOrGetThread } = useChat();

  const params = useLocalSearchParams<{
    requestId?: string;
    jobId?: string;
    service?: string;
    problem?: string;
    locationLabel?: string;
    address?: string;
  }>();

  const targetRequestId = params.requestId || params.jobId;
  const initialJob = targetRequestId ? getJob(targetRequestId) : undefined;

  const [phase, setPhase] = useState<DispatchPhase>(
    initialJob?.status === 'SEARCHING_DISPATCH' ? 'SEARCHING_DISPATCH' : 'REVIEW'
  );
  const [selectedChannel, setSelectedChannel] = useState<PaymentChannel>('MTN_MOMO');
  const [phoneNumber, setPhoneNumber] = useState(account?.phone ?? '0788123456');
  const [matchedSpecialist, setMatchedSpecialist] = useState<MarketplaceTechnician | null>(null);
  const [transactionRef, setTransactionRef] = useState<string>('');

  // Radar animation values
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;
  const radarSweep = useRef(new Animated.Value(0)).current;

  // Radar pulse animation loop
  useEffect(() => {
    if (phase !== 'SEARCHING_DISPATCH') return;

    const createPulseAnim = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const anim1 = createPulseAnim(pulse1, 0);
    const anim2 = createPulseAnim(pulse2, 800);
    const anim3 = createPulseAnim(pulse3, 1600);

    const sweepAnim = Animated.loop(
      Animated.timing(radarSweep, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    anim1.start();
    anim2.start();
    anim3.start();
    sweepAnim.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      sweepAnim.stop();
    };
  }, [phase, pulse1, pulse2, pulse3, radarSweep]);

  // Route guard: if already assigned and paid, go directly to chat
  useEffect(() => {
    const job = targetRequestId ? getJob(targetRequestId) : undefined;
    if (job?.bookingFee?.status === 'PAID' && job.technician && job.chatThreadId && phase === 'REVIEW') {
      router.replace({
        pathname: `/chat/${job.chatThreadId}` as any,
        params: {
          requestId: job.id,
          type: 'SOS',
        },
      });
    }
  }, [targetRequestId, getJob, phase, router]);

  // Hardware back guard during emergency broadcast
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'SEARCHING_DISPATCH' || phase === 'AUTHORIZING' || phase === 'ACCEPTED') {
        return true; // Prevent accidental exit while dispatching
      }
      return false;
    });
    return () => sub.remove();
  }, [phase]);

  // Resolve service & job details
  const activeJob = targetRequestId ? getJob(targetRequestId) : undefined;
  const serviceName = activeJob?.service || params.service || 'Emergency Service';
  const problemDesc = activeJob?.problem || params.problem || 'Critical emergency assistance required';
  const locationLabel = activeJob?.locationLabel || params.locationLabel || params.address || 'Current GPS Location';
  const dispatchFee = activeJob?.bookingFee?.amount ?? EMERGENCY_DISPATCH_FEE;

  // Broadcast step logs for radar screen
  const [broadcastStep, setBroadcastStep] = useState(0);

  useEffect(() => {
    if (phase !== 'SEARCHING_DISPATCH') return;

    const t1 = setTimeout(() => setBroadcastStep(1), 800);
    const t2 = setTimeout(() => setBroadcastStep(2), 1700);
    const t3 = setTimeout(() => setBroadcastStep(3), 2600);

    // After broadcast duration, match nearest available technician
    const tAccept = setTimeout(() => {
      handleTechnicianAcceptance();
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tAccept);
    };
  }, [phase]);

  const handleAuthorizeAndBroadcast = () => {
    vibrate();
    setPhase('AUTHORIZING');

    // Simulate instant gateway authorization (1s)
    setTimeout(() => {
      let finalId = targetRequestId;
      if (!finalId) {
        finalId = createDraftRequest({
          service: serviceName,
          problem: problemDesc,
          locationLabel,
          urgency: 'Emergency',
          type: 'SOS',
          status: 'SEARCHING_DISPATCH',
          bookingFee: {
            amount: dispatchFee,
            currency: 'RWF',
            status: 'PENDING',
          },
        });
      }

      const txId = `TX-SOS-${Date.now().toString(36).toUpperCase()}`;
      setTransactionRef(txId);

      // 1. Confirm payment and transition request to SEARCHING_DISPATCH
      markBookingFeePaid(finalId, txId);
      notify('success');

      // 2. Switch to radar search pulse screen
      setPhase('SEARCHING_DISPATCH');
    }, 1100);
  };

  const handleTechnicianAcceptance = () => {
    const finalId = targetRequestId || activeJob?.id;
    if (!finalId) return;

    // Pick top available technician for emergency response
    const selectedTech: MarketplaceTechnician =
      MOCK_MARKETPLACE_TECHNICIANS.find((t) => t.isAvailable) ?? MOCK_MARKETPLACE_TECHNICIANS[0];

    setMatchedSpecialist(selectedTech);
    setPhase('ACCEPTED');
    notify('success');
    vibrate();

    // 1. Assign technician to job and transition to ACCEPTED
    assignEmergencyTechnician(finalId, toJobTechnician(selectedTech));

    const updatedJob = getJob(finalId);

    // 2. Create or link emergency chat thread with type: 'SOS'
    const threadId = createOrGetThread(
      selectedTech.name,
      'technician',
      finalId,
      {
        id: finalId,
        serviceName: updatedJob?.service ?? 'Emergency SOS',
        problem: updatedJob?.problem ?? 'Emergency Request',
        address: updatedJob?.locationLabel ?? '',
        thumbnailUri: updatedJob?.photoUris?.[0] ?? updatedJob?.photoUri,
        photos: updatedJob?.photoUris ?? (updatedJob?.photoUri ? [updatedJob.photoUri] : []),
        videos: updatedJob?.videoUris ?? (updatedJob?.videoUri ? [updatedJob.videoUri] : []),
        createdAt: updatedJob?.createdAt ?? new Date().toISOString(),
        status: 'ACCEPTED',
        type: 'SOS',
        bookingFee: updatedJob?.bookingFee,
      },
      selectedTech.phoneNumber,
      selectedTech.location
    );

    linkChatThread(finalId, threadId);

    // 3. Route directly to /chat/[id]?type=SOS
    setTimeout(() => {
      router.replace({
        pathname: `/chat/${threadId}` as any,
        params: {
          requestId: finalId,
          type: 'SOS',
          firstMessage: 'true',
        },
      });
    }, 1300);
  };

  const spin = radarSweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* =========================================================================
          RADAR SEARCH PULSE SCREEN (Phase: SEARCHING_DISPATCH)
         ========================================================================= */}
      {phase === 'SEARCHING_DISPATCH' ? (
        <View style={[styles.radarContainer, { paddingTop: Platform.OS === 'web' ? 24 : insets.top + 16 }]}>
          {/* Radar Header Badge */}
          <View style={styles.radarHeaderBadge}>
            <View style={styles.blinkingDot} />
            <Text style={styles.radarHeaderBadgeText}>SOS BROADCAST ACTIVE</Text>
          </View>

          {/* Radar Animation */}
          <View style={[styles.radarCircleWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Concentric Pulse Rings */}
            {[pulse1, pulse2, pulse3].map((pulseVal, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.radarPulseRing,
                  {
                    transform: [
                      {
                        scale: pulseVal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 2.5],
                        }),
                      },
                    ],
                    opacity: pulseVal.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [0.8, 0.35, 0],
                    }),
                  },
                ]}
              />
            ))}

            {/* Rotating Scan Line */}
            <Animated.View
              style={[
                styles.radarScanArm,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            />

            {/* Nearby detected technician blips */}
            <View style={[styles.techBlip, { top: 38, left: 52 }]} />
            <View style={[styles.techBlip, { bottom: 44, right: 48 }]} />
            <View style={[styles.techBlip, { top: 72, right: 38 }]} />

            {/* Glowing Core Beacon */}
            <View style={styles.radarCenterCore}>
              <Ionicons name="radio" size={30} color="#ffffff" />
            </View>
          </View>

          {/* Radar Copy & Live Status */}
          <View style={styles.radarCopySection}>
            <Text style={[styles.radarMainTitle, { color: colors.foreground }]} testID="radar-search-title">
              Alerting nearby emergency technicians...
            </Text>
            <Text style={[styles.radarSubtitle, { color: colors.mutedForeground }]}>
              Broadcasting your GPS location to verified on-call specialists within 5km radius.
            </Text>

            <View style={[styles.responseWindowPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="flash" size={14} color="#ef4444" />
              <Text style={[styles.responseWindowPillText, { color: colors.foreground }]}>Expected Response: 5–15 mins</Text>
            </View>
          </View>

          {/* Live Broadcast Tickers */}
          <View style={[styles.tickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tickerRow}>
              <Ionicons name="checkmark-circle" size={17} color="#16a34a" />
              <Text style={[styles.tickerText, { color: colors.foreground }]}>
                Emergency GPS coordinates broadcasted
              </Text>
            </View>

            <View style={styles.tickerRow}>
              {broadcastStep >= 1 ? (
                <Ionicons name="checkmark-circle" size={17} color="#16a34a" />
              ) : (
                <ActivityIndicator size="small" color="#ef4444" />
              )}
              <Text style={[styles.tickerText, { color: broadcastStep >= 1 ? colors.foreground : colors.mutedForeground }]}>
                {broadcastStep >= 1
                  ? '4 verified specialists alerted in sector'
                  : 'Scanning local emergency technician network...'}
              </Text>
            </View>

            <View style={styles.tickerRow}>
              {broadcastStep >= 2 ? (
                <Ionicons name="checkmark-circle" size={17} color="#16a34a" />
              ) : (
                <ActivityIndicator size="small" color="#ef4444" />
              )}
              <Text style={[styles.tickerText, { color: broadcastStep >= 2 ? colors.foreground : colors.mutedForeground }]}>
                {broadcastStep >= 2
                  ? 'Priority SOS push notification delivered'
                  : 'Delivering priority alert...'}
              </Text>
            </View>

            <View style={styles.tickerRow}>
              {broadcastStep >= 3 ? (
                <ActivityIndicator size="small" color="#16a34a" />
              ) : (
                <Ionicons name="time-outline" size={17} color={colors.mutedForeground} />
              )}
              <Text style={[styles.tickerText, { color: broadcastStep >= 3 ? colors.foreground : colors.mutedForeground }]}>
                Awaiting fastest technician acceptance & lock...
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* =========================================================================
            EMERGENCY DISPATCH CHECKOUT & REVIEW SCREEN (Phase: REVIEW / AUTHORIZING)
           ========================================================================= */
        <>
          {/* Clean Minimal Header */}
          <View
            style={[
              styles.topBar,
              {
                paddingTop: Platform.OS === 'web' ? 14 : insets.top + 8,
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <BackButton
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              testID="sos-dispatch-back-button"
            />
            <View style={styles.sosInlineBadge}>
              <View style={styles.sosDot} />
              <Text style={styles.sosInlineBadgeText}>SOS Priority</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Screen Heading */}
            <View style={styles.screenHeadingWrap}>
              <Text style={[styles.screenHeadingTitle, { color: colors.foreground }]}>Emergency Dispatch</Text>
              <Text style={[styles.screenHeadingSub, { color: colors.mutedForeground }]}>
                Instant network broadcast · 5–15 min expected response
              </Text>
            </View>

            {/* UPFRONT EMERGENCY DISPATCH FEE CARD */}
            <View style={[styles.feeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.feeTopRow}>
                <View>
                  <Text style={[styles.feeCategoryLabel, { color: colors.mutedForeground }]}>DISPATCH CALLOUT FEE</Text>
                  <Text style={[styles.feeAmountText, { color: colors.foreground }]}>{formatBookingFee(dispatchFee)}</Text>
                </View>
                <View style={styles.responseBadge}>
                  <Ionicons name="flash" size={13} color="#ef4444" />
                  <Text style={styles.responseBadgeText}>5–15 MIN ETA</Text>
                </View>
              </View>
              <Text style={[styles.feeSubtext, { color: colors.mutedForeground }]}>
                Locks priority callout and initiates instant specialist broadcast.
              </Text>
            </View>

            {/* REQUEST DETAILS SUMMARY */}
            <SectionCard title="Emergency Request Summary">
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Service</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{serviceName}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Location</Text>
                <View style={styles.summaryLocationRow}>
                  <Ionicons name="location" size={15} color="#ef4444" />
                  <Text style={[styles.summaryValue, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>
                    {locationLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Details</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]} numberOfLines={3}>
                  {problemDesc}
                </Text>
              </View>
            </SectionCard>

            {/* ONE-TAP PAYMENT CHANNEL SELECTOR */}
            <SectionCard title="Payment Authorization Method">
              <Text style={[styles.paymentSubtext, { color: colors.mutedForeground }]}>
                One-tap mobile money push or card authorization to initiate emergency broadcast.
              </Text>

              <View style={styles.paymentOptionsList}>
                {PAYMENT_OPTIONS.map((opt) => {
                  const isSelected = selectedChannel === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setSelectedChannel(opt.id)}
                      style={[
                        styles.paymentOptionCard,
                        {
                          backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.06)' : colors.card,
                          borderColor: isSelected ? '#ef4444' : colors.border,
                        },
                      ]}
                    >
                      <View style={[styles.paymentIconWrap, { backgroundColor: isSelected ? '#ef4444' : colors.muted }]}>
                        <Ionicons
                          name={opt.icon}
                          size={18}
                          color={isSelected ? '#ffffff' : colors.foreground}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.paymentTitle, { color: colors.foreground }]}>{opt.title}</Text>
                          {opt.badge && (
                            <View style={[styles.momoPopularBadge, { backgroundColor: colors.secondary }]}>
                              <Text style={[styles.momoPopularText, { color: colors.mutedForeground }]}>{opt.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.paymentDetail, { color: colors.mutedForeground }]}>
                          {opt.detail}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? '#ef4444' : colors.mutedForeground}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {/* Mobile Number for push confirmation */}
              {(selectedChannel === 'MTN_MOMO' || selectedChannel === 'AIRTEL_MONEY') && (
                <View style={styles.phoneInputWrap}>
                  <Text style={[styles.phoneLabel, { color: colors.foreground }]}>
                    Mobile Money Number for Prompt:
                  </Text>
                  <View style={[styles.phoneInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.phonePrefix, { color: colors.mutedForeground }]}>+250</Text>
                    <TextInput
                      accessibilityLabel="Mobile Money Number"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      placeholder="078..."
                      placeholderTextColor={colors.mutedForeground}
                      style={[styles.phoneInput, { color: colors.foreground }]}
                    />
                  </View>
                </View>
              )}
            </SectionCard>
          </ScrollView>

          {/* STICKY BOTTOM ONE-TAP AUTHORIZATION CTA */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 12,
              },
            ]}
          >
            <Button
              label={`Authorize & Broadcast (${formatBookingFee(dispatchFee)})`}
              icon="flash"
              variant="danger"
              loading={phase === 'AUTHORIZING'}
              onPress={handleAuthorizeAndBroadcast}
              testID="authorize-and-broadcast-button"
              style={styles.authorizeButton}
            />
            <Text style={[styles.bottomSecurityNote, { color: colors.mutedForeground }]}>
              🔒 Instant 256-bit encrypted checkout · No manual technician delays
            </Text>
          </View>
        </>
      )}

      {/* =========================================================================
          MATCH ACCEPTANCE CELEBRATION MODAL
         ========================================================================= */}
      <Modal visible={phase === 'ACCEPTED'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalIconRing}>
              <Ionicons name="checkmark-done" size={36} color="#ffffff" />
            </View>

            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Emergency Technician Assigned!
            </Text>

            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {matchedSpecialist?.name} has accepted your emergency broadcast and is en route.
            </Text>

            <View style={[styles.modalEtaBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="time" size={17} color="#ef4444" />
              <Text style={[styles.modalEtaText, { color: colors.foreground }]}>
                Estimated Arrival: {matchedSpecialist?.etaMinutes ?? 8} mins
              </Text>
            </View>

            <ActivityIndicator size="small" color="#ef4444" style={{ marginTop: 16 }} />
            <Text style={[styles.modalRoutingText, { color: colors.mutedForeground }]}>
              Opening emergency direct chat...
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  sosInlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sosDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  sosInlineBadgeText: {
    color: '#ef4444',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  screenHeadingWrap: {
    marginBottom: 4,
  },
  screenHeadingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  screenHeadingSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 3,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  feeCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  feeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeCategoryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  feeAmountText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    marginTop: 2,
  },
  feeSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  responseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  responseBadgeText: {
    color: '#ef4444',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  summaryItem: {
    marginBottom: 10,
  },
  summaryLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  summaryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 12,
  },
  paymentOptionsList: {
    gap: 8,
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  paymentIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  momoPopularBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  momoPopularText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },
  paymentDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  phoneInputWrap: {
    marginTop: 14,
  },
  phoneLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  phonePrefix: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginRight: 6,
  },
  phoneInput: {
    flex: 1,
    height: 44,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  authorizeButton: {
    minHeight: 50,
  },
  bottomSecurityNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
  },

  // RADAR SCREEN STYLES
  radarContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  radarHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 24,
  },
  blinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  radarHeaderBadgeText: {
    color: '#ef4444',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  radarCircleWrapper: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 18,
    borderWidth: 1,
  },
  radarPulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  radarScanArm: {
    position: 'absolute',
    width: 100,
    height: 2,
    backgroundColor: '#ef4444',
    left: 100,
    transformOrigin: 'left center',
    opacity: 0.5,
  },
  techBlip: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  radarCenterCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCopySection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  radarMainTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    textAlign: 'center',
  },
  radarSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  responseWindowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 10,
  },
  responseWindowPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  tickerCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tickerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    textAlign: 'center',
  },
  modalSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  modalEtaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 14,
  },
  modalEtaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  modalRoutingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 6,
  },
});
