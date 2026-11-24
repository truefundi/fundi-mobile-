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
import { openPaidChat } from '@/lib/checkout-nav';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePaymentQuote } from '@/hooks/usePaymentQuote';
import { PriceBreakdown } from '@/components/checkout/PriceBreakdown';
import { ClaimStatus, PayByCode } from '@/components/checkout/PayByCode';
import { usePaymentClaim } from '@/hooks/usePaymentClaim';
import { fetchCustomerJob, fetchJobPhoneStatus, retryJobDispatch, type BackendJob } from '@/lib/jobs-api';
import type { PaymentClaimMethod } from '@/lib/payments-api';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFundi } from '@/context/FundiContext';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { getCachedCategories, resolveServiceCategoryId } from '@/lib/categories-api';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import {
  EMERGENCY_DISPATCH_FEE,
  formatBookingFee,
} from '@/constants/jobs';
import { notify, vibrate } from '@/lib/haptics';

/** The approved "I have paid" claim, or (development builds only) the API's test payment. */
type PaymentSource =
  | { kind: 'claim'; paymentId: string; amount: number; externalPaymentId: string }
  | { kind: 'test' };

type DispatchPhase = 'REVIEW' | 'AUTHORIZING' | 'SEARCHING_DISPATCH' | 'ACCEPTED';

/** Jobs on the API have UUIDs; phone-only drafts have ids like job-123-abc. */
const API_JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    createBackendJob,
    createBookingPayment,
    requestPhoneVerification,
    verifyPhoneOtp,
  } = useFundi();
  const { createOrGetThread, openConversation } = useChat();

  const params = useLocalSearchParams<{
    requestId?: string;
    jobId?: string;
    service?: string;
    problem?: string;
    locationLabel?: string;
    address?: string;
    categoryId?: string;
  }>();

  const targetRequestId = params.requestId || params.jobId;
  const initialJob = targetRequestId ? getJob(targetRequestId) : undefined;
  // A paid emergency nobody has taken yet is already being dispatched: follow it.
  const alreadyDispatching = Boolean(
    initialJob && API_JOB_ID.test(initialJob.id) && initialJob.bookingFee?.status === 'PAID' && !initialJob.technician,
  );

  const [phase, setPhase] = useState<DispatchPhase>(alreadyDispatching ? 'SEARCHING_DISPATCH' : 'REVIEW');
  /** The emergency on the server (its id replaces the phone's draft id once paid). */
  const [dispatchJobId, setDispatchJobId] = useState<string | null>(alreadyDispatching ? initialJob!.id : null);
  const [liveJob, setLiveJob] = useState<BackendJob | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [payMethod, setPayMethod] = useState<PaymentClaimMethod>('MTN');
  const [phoneNumber, setPhoneNumber] = useState(account?.phone ?? '');
  const [sosError, setSosError] = useState<string | null>(null);
  const paymentClaim = usePaymentClaim(targetRequestId);
  // Lists show "Confirming payment" while a reported payment waits for Fundi.
  const { setPaymentReported } = useFundi();
  const claimStatus = paymentClaim.claim?.status;
  useEffect(() => {
    const requestId = targetRequestId;
    if (!requestId) return;
    setPaymentReported(requestId, claimStatus === 'PENDING' || claimStatus === 'APPROVED');
  }, [claimStatus, setPaymentReported, targetRequestId]);
  const sourceRef = useRef<PaymentSource>({ kind: 'test' });
  const continuedClaimRef = useRef<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string>('');

  // Phone verification state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

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
    if (job?.bookingFee?.status === 'PAID' && job.technician && phase === 'REVIEW') {
      openPaidChat(router, { id: job.id, requestId: job.id, type: 'SOS' });
    }
  }, [targetRequestId, getJob, phase, router]);

  // Hardware back guard during emergency broadcast
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'AUTHORIZING' || phase === 'ACCEPTED') return true; // Payment or hand-over in progress.
      if (phase === 'SEARCHING_DISPATCH') {
        // The search continues on the server; the request stays in Activity.
        router.replace('/');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase, router]);

  // Resolve service & job details
  const activeJob = targetRequestId ? getJob(targetRequestId) : undefined;
  const serviceName = activeJob?.service || params.service || 'Emergency Service';
  const problemDesc = activeJob?.problem || params.problem || 'Critical emergency assistance required';
  const locationLabel = activeJob?.locationLabel || params.locationLabel || params.address || 'Current GPS Location';
  const sosPaid = activeJob?.bookingFee?.status === 'PAID';
  // The API prices the emergency booking: SOS fee plus any charges the client pays.
  const { quote: sosQuote } = usePaymentQuote({
    service: serviceName,
    categoryId: params.categoryId || activeJob?.serviceCategoryId,
    requestType: 'SOS',
    enabled: !sosPaid,
  });
  const dispatchFee = sosPaid
    ? activeJob?.bookingFee?.amount ?? EMERGENCY_DISPATCH_FEE
    : sosQuote?.customerTotal ?? activeJob?.bookingFee?.amount ?? EMERGENCY_DISPATCH_FEE;

  // Follow the real dispatch: who is being asked, and whether someone accepted.
  useEffect(() => {
    if (phase !== 'SEARCHING_DISPATCH' || !dispatchJobId) return;
    let stopped = false;
    const check = async () => {
      try {
        const job = await fetchCustomerJob(dispatchJobId);
        if (stopped) return;
        setLiveJob(job);
        if (job.currentTechnician && ['ASSIGNED', 'IN_PROGRESS', 'PAUSED'].includes(job.status)) {
          setPhase('ACCEPTED');
          notify('success');
          vibrate();
          await openConversation(job.id).catch(() => undefined);
          setTimeout(() => openPaidChat(router, { id: job.id, requestId: job.id, type: 'SOS', firstMessage: 'true' }), 1500);
        }
      } catch {
        // A missed check is retried on the next tick.
      }
    };
    void check();
    const timer = setInterval(() => void check(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dispatchJobId]);

  // A one-second clock for the offer countdown.
  useEffect(() => {
    if (phase !== 'SEARCHING_DISPATCH') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const activeOffer = liveJob?.activeOffer ?? null;
  const offerSecondsLeft = activeOffer?.expiresAt
    ? Math.max(0, Math.ceil((new Date(activeOffer.expiresAt).getTime() - now) / 1000))
    : null;
  const nobodyLeft = liveJob?.status === 'OPEN' && liveJob.dispatchStatus === 'EXHAUSTED' && !activeOffer;
  const jobEnded = liveJob ? ['CANCELLED', 'FAILED', 'COMPLETED'].includes(liveJob.status) : false;
  const searching = !nobodyLeft && !jobEnded;

  /** Asks the technicians who have not been asked yet (POST retry-dispatch). */
  const retrySearch = async () => {
    if (!dispatchJobId || retrying) return;
    setRetrying(true);
    setSosError(null);
    try {
      setLiveJob(await retryJobDispatch(dispatchJobId));
    } catch (err) {
      setSosError(err instanceof Error ? err.message : 'The search could not be restarted. Try again.');
    } finally {
      setRetrying(false);
    }
  };

  const handleAuthorizeAndBroadcast = async (source: PaymentSource) => {
    sourceRef.current = source;
    setSosError(null);
    vibrate();

    // An account whose number is already verified needs no code; otherwise confirm one first.
    if (!phoneVerificationId) {
      setPhase('AUTHORIZING');
      try {
        const status = await fetchJobPhoneStatus().catch(() => null);
        if (status?.verified) {
          await executeSosBroadcast(null);
          return;
        }
        const req = await requestPhoneVerification();
        setPhoneVerificationId(req.verificationId);
        setPhase('REVIEW');
        setShowOtpModal(true);
        return;
      } catch (err) {
        setSosError(err instanceof Error ? err.message : 'Could not verify your phone number.');
        setPhase('REVIEW');
        return;
      }
    }

    await executeSosBroadcast(phoneVerificationId);
  };

  const handleConfirmOtpAndBroadcast = async () => {
    if (!phoneVerificationId || otpCode.trim().length < 6) return;
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const verifyRes = await verifyPhoneOtp(phoneVerificationId, otpCode.trim());
      if (!verifyRes.verified) {
        throw new Error('Verification code invalid.');
      }
      setShowOtpModal(false);
      await executeSosBroadcast(phoneVerificationId);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const executeSosBroadcast = async (verificationId: string | null) => {
    setPhase('AUTHORIZING');
    // The API refuses a job described in fewer than 10 characters; catch it before using the payment.
    if (problemDesc.trim().length < 10) {
      setSosError('Describe the emergency in at least 10 characters. Go back and edit the request.');
      setPhase('REVIEW');
      return;
    }
    // Technicians are found by distance: never send a made-up location.
    const latitude = activeJob?.locationLatitude;
    const longitude = activeJob?.locationLongitude;
    if (latitude === undefined || longitude === undefined) {
      setSosError('We do not have the emergency location on the map. Go back and set the address or use your current location.');
      setPhase('REVIEW');
      return;
    }
    try {
      const targetServiceCategoryId = await resolveServiceCategoryId(
        serviceName,
        params.categoryId || activeJob?.serviceCategoryId,
      );
      const normalizedPhone = cleanAndNormalizePhone(phoneNumber);

      const source = sourceRef.current;
      const bookingPayment =
        source.kind === 'claim'
          ? { id: source.paymentId, amount: source.amount, externalPaymentId: source.externalPaymentId }
          : await createBookingPayment(targetServiceCategoryId, 'SOS', normalizedPhone);

      const createdBackendJob = await createBackendJob({
        paymentId: bookingPayment.id,
        ...(verificationId ? { phoneVerificationId: verificationId } : {}),
        description: problemDesc.trim(),
        serviceCategoryId: targetServiceCategoryId,
        locationAddress: locationLabel,
        latitude,
        longitude,
        offeredAmount: dispatchFee,
        requestType: 'SOS',
      }, targetRequestId);

      const txId = bookingPayment.externalPaymentId || `TX-SOS-${Date.now().toString(36).toUpperCase()}`;
      setTransactionRef(txId);
      markBookingFeePaid(createdBackendJob.id, txId, bookingPayment.amount);
      if (source.kind === 'claim') await paymentClaim.clear();
      notify('success');

      // Follow the real dispatch from here.
      setDispatchJobId(createdBackendJob.id);
      setLiveJob(createdBackendJob);
      setPhase('SEARCHING_DISPATCH');
    } catch (err) {
      setSosError(err instanceof Error ? err.message : 'The emergency request could not be sent. Please try again.');
      setPhase('REVIEW');
    }
  };

  /** "I have paid": report the payment so an admin can match it. */
  const handleReportPaid = async () => {
    setSosError(null);
    const payer = cleanAndNormalizePhone(phoneNumber);
    if (payer.replace(/\D/g, '').length < 9) {
      setSosError('Enter the mobile money number you paid from.');
      return;
    }
    try {
      const serviceCategoryId = await resolveServiceCategoryId(
        serviceName,
        params.categoryId || activeJob?.serviceCategoryId,
      );
      await paymentClaim.submit({
        serviceCategoryId,
        requestType: 'SOS',
        amount: dispatchFee,
        paymentMethod: payMethod,
        paymentNumber: payer,
      });
    } catch (err) {
      setSosError(err instanceof Error ? err.message : 'Your payment could not be reported. Please try again.');
    }
  };

  // Once an admin confirms the payment, broadcast the emergency with it (once).
  const approvedClaim = paymentClaim.claim?.status === 'APPROVED' ? paymentClaim.claim : null;
  const continueWithClaim = () => {
    const payment = approvedClaim?.bookingPayment;
    if (!approvedClaim || !payment || payment.jobId) return;
    continuedClaimRef.current = approvedClaim.id;
    void handleAuthorizeAndBroadcast({
      kind: 'claim',
      paymentId: payment.id,
      amount: payment.amount,
      externalPaymentId: `claim_${approvedClaim.id}`,
    });
  };
  useEffect(() => {
    if (!approvedClaim || continuedClaimRef.current === approvedClaim.id || phase !== 'REVIEW') return;
    continueWithClaim();
    // Only a newly approved claim should trigger the broadcast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedClaim?.id, approvedClaim?.bookingPayment?.id]);

  const claimOpen = paymentClaim.claim !== null;

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
        <ScrollView
          contentContainerStyle={[
            styles.radarContainer,
            { paddingTop: Platform.OS === 'web' ? 24 : insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Radar Header Badge */}
          <View style={styles.radarHeaderBadge}>
            <View style={styles.blinkingDot} />
            <Text style={styles.radarHeaderBadgeText}>{searching ? 'SOS SEARCH ACTIVE' : 'SEARCH STOPPED'}</Text>
          </View>

          {/* Radar Animation */}
          <View style={[styles.radarCircleWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Concentric Pulse Rings: only while technicians are being asked */}
            {(searching ? [pulse1, pulse2, pulse3] : []).map((pulseVal, index) => (
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
            {searching ? (
            <Animated.View
              style={[
                styles.radarScanArm,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            />
            ) : null}


            {/* Glowing Core Beacon */}
            <View style={styles.radarCenterCore}>
              <Ionicons name="radio" size={30} color="#ffffff" />
            </View>
          </View>

          {/* Live status from the server */}
          <View style={styles.radarCopySection}>
            <Text style={[styles.radarMainTitle, { color: colors.foreground }]} testID="radar-search-title">
              {nobodyLeft
                ? 'No technician is free right now'
                : jobEnded
                  ? 'This emergency request has ended'
                  : activeOffer
                    ? `Asking ${activeOffer.technicianName}`
                    : 'Finding the nearest available technician…'}
            </Text>
            <Text style={[styles.radarSubtitle, { color: colors.mutedForeground }]}>
              {nobodyLeft
                ? 'Every nearby technician for this service was asked. Your payment still covers the emergency: try again, or check back from Activity.'
                : jobEnded
                  ? 'Open it from Activity to see what happened.'
                  : 'Technicians are asked one at a time, nearest first. Each has 30 seconds to accept.'}
            </Text>
            {activeOffer && offerSecondsLeft !== null ? (
              <View style={[styles.responseWindowPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={14} color={colors.destructive} />
                <Text style={[styles.responseWindowPillText, { color: colors.foreground }]} testID="sos-offer-countdown">
                  {offerSecondsLeft > 0 ? `${offerSecondsLeft}s to accept` : 'Moving to the next technician…'}
                  {activeOffer.distanceMeters ? ` · ${(activeOffer.distanceMeters / 1000).toFixed(1)} km away` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.tickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tickerRow}>
              <Ionicons name="checkmark-circle" size={17} color={colors.success} />
              <Text style={[styles.tickerText, { color: colors.foreground }]}>Emergency fee paid</Text>
            </View>
            <View style={styles.tickerRow}>
              <Ionicons name="checkmark-circle" size={17} color={colors.success} />
              <Text style={[styles.tickerText, { color: colors.foreground }]} numberOfLines={2}>
                Location sent: {liveJob?.location?.address ?? locationLabel}
              </Text>
            </View>
            <View style={styles.tickerRow}>
              {nobodyLeft || jobEnded ? (
                <Ionicons name="alert-circle" size={17} color={colors.destructive} />
              ) : (
                <ActivityIndicator size="small" color={colors.destructive} />
              )}
              <Text style={[styles.tickerText, { color: colors.foreground }]}>
                {nobodyLeft
                  ? 'Nobody accepted yet'
                  : jobEnded
                    ? 'Search stopped'
                    : 'Waiting for a technician to accept'}
              </Text>
            </View>
          </View>

          {sosError ? (
            <View style={{ width: '100%', marginTop: 12 }}>
              <Notice tone="warning" icon="alert-circle-outline" text={sosError} />
            </View>
          ) : null}

          <View style={styles.searchActions}>
            {nobodyLeft ? (
              <Button
                label={retrying ? 'Asking again…' : 'Try again'}
                icon="refresh"
                loading={retrying}
                onPress={() => void retrySearch()}
                testID="sos-retry-button"
                style={{ backgroundColor: colors.destructive, borderColor: colors.destructive }}
                textColor="#ffffff"
              />
            ) : null}
            <Button
              label={nobodyLeft || jobEnded ? 'Back to home' : 'Keep searching in the background'}
              variant="outline"
              size="small"
              onPress={() => router.replace('/')}
              testID="sos-leave-button"
            />
          </View>
        </ScrollView>
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
                Sent to the nearest available technicians, one at a time, until one accepts.
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
                  <Text style={styles.responseBadgeText}>PRIORITY</Text>
                </View>
              </View>
              <PriceBreakdown quote={sosQuote} testID="sos-fee-breakdown" />
              <Text style={[styles.feeSubtext, { color: colors.mutedForeground }]}>
                Paid once. It covers this emergency until a technician accepts it.
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

            {/* PAY BY MOBILE MONEY CODE */}
            <SectionCard title="Pay with mobile money">
              <Text style={[styles.paymentSubtext, { color: colors.mutedForeground }]}>
                Pay the emergency fee to Fundi's code, then tap "I have paid". The emergency is broadcast as soon as the
                payment is confirmed.
              </Text>
              {sosError || paymentClaim.error ? (
                <Notice tone="warning" icon="alert-circle-outline" text={(sosError || paymentClaim.error)!} />
              ) : null}
              {paymentClaim.claim ? (
                <ClaimStatus
                  claim={paymentClaim.claim}
                  checking={paymentClaim.checking}
                  onCheck={() => void paymentClaim.refresh()}
                  onRetry={() => {
                    continuedClaimRef.current = null;
                    void paymentClaim.clear();
                  }}
                  onContinue={continueWithClaim}
                  continuing={phase !== 'REVIEW' || showOtpModal}
                />
              ) : null}
              <PayByCode
                method={payMethod}
                onMethodChange={setPayMethod}
                payerNumber={phoneNumber}
                onPayerNumberChange={setPhoneNumber}
                amount={dispatchFee}
                disabled={claimOpen}
                tone="danger"
              />
            </SectionCard>
          </ScrollView>

          {/* Sticky bottom CTA: hidden while a reported payment is being checked. */}
          {claimOpen ? null : (
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
                label={`I have paid ${formatBookingFee(dispatchFee)}`}
                icon="checkmark-done"
                loading={paymentClaim.submitting}
                disabled={phase === 'AUTHORIZING'}
                onPress={() => void handleReportPaid()}
                testID="i-have-paid-button"
                // The one action on an emergency: solid red in both themes.
                style={[styles.authorizeButton, { backgroundColor: colors.destructive, borderColor: colors.destructive }]}
                textColor="#ffffff"
              />
              {__DEV__ ? (
                <Button
                  label="Test payment (development only)"
                  variant="outline"
                  size="small"
                  loading={phase === 'AUTHORIZING'}
                  disabled={paymentClaim.submitting}
                  onPress={() => void handleAuthorizeAndBroadcast({ kind: 'test' })}
                  testID="authorize-and-broadcast-button"
                />
              ) : null}
            </View>
          )}
        </>
      )}

      {/* Phone Verification OTP Modal */}
      <Modal visible={showOtpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, width: '90%', maxWidth: 400 }]}>
            <View style={[styles.modalIconRing, { backgroundColor: colors.primary }]}>
              <Ionicons name="shield-checkmark" size={32} color="#ffffff" />
            </View>

            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Verify Phone Number</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Enter the 6-digit code we sent to your phone to confirm this emergency request.
            </Text>

            {otpError && (
              <Text style={{ color: colors.destructive, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                {otpError}
              </Text>
            )}

            <TextInput
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="123456"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              style={{
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 22,
                fontWeight: '700',
                textAlign: 'center',
                letterSpacing: 6,
                width: '100%',
                marginTop: 10,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 14 }}>
              <Button
                label="Cancel"
                variant="outline"
                size="small"
                style={{ flex: 1 }}
                onPress={() => {
                  setShowOtpModal(false);
                  setOtpCode('');
                  setOtpError(null);
                }}
              />
              <Button
                label="Verify & send"
                size="small"
                style={{ flex: 1, backgroundColor: colors.destructive, borderColor: colors.destructive }}
                textColor="#ffffff"
                loading={isVerifyingOtp}
                disabled={otpCode.trim().length < 6}
                onPress={handleConfirmOtpAndBroadcast}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MATCH ACCEPTANCE CELEBRATION MODAL
         ========================================================================= */}
      <Modal visible={phase === 'ACCEPTED'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalIconRing}>
              <Ionicons name="checkmark-done" size={36} color="#ffffff" />
            </View>

            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Technician accepted</Text>

            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              {liveJob?.currentTechnician?.fullName ?? 'A technician'} took your emergency. Agree on the work in the chat.
            </Text>

            <ActivityIndicator size="small" color={colors.destructive} style={{ marginTop: 16 }} />
            <Text style={[styles.modalRoutingText, { color: colors.mutedForeground }]}>Opening the chat…</Text>
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
    flexGrow: 1,
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

  searchActions: {
    width: '100%',
    gap: 10,
    marginTop: 16,
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
  modalRoutingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 6,
  },
});
