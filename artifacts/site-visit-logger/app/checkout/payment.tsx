import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePaymentQuote } from '@/hooks/usePaymentQuote';
import { PriceBreakdown } from '@/components/checkout/PriceBreakdown';
import { ClaimStatus, PayByCode } from '@/components/checkout/PayByCode';
import { usePaymentClaim } from '@/hooks/usePaymentClaim';
import type { PaymentClaimMethod } from '@/lib/payments-api';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFundi } from '@/context/FundiContext';
import { useAuth } from '@/context/AuthContext';
import { getCachedCategories, resolveServiceCategoryId } from '@/lib/categories-api';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import { useCountdown } from '@/hooks/useCountdown';
import { type MarketplaceTechnician } from '@/constants/technicians';
import {
  FLAT_BOOKING_FEE,
  FLAT_BOOKING_FEE_CURRENCY,
  formatBookingFee,
} from '@/constants/jobs';
import { getServiceBookingFee } from '@/constants/services';
import { inferUploadMimeType } from '@/constants/uploads';
import { fetchJobPhoneStatus } from '@/lib/jobs-api';
import { TechnicianCard } from '@/components/ui/TechnicianCard';
import { ApiRequestError } from '@/lib/api';

/** Local request media as upload parts for the job create call. */
function requestMediaParts(uris: Array<string | undefined>, kind: 'photo' | 'video') {
  return uris
    .filter((uri): uri is string => Boolean(uri))
    .map((uri, index) => {
      const mimeType = inferUploadMimeType(uri) ?? (kind === 'photo' ? 'image/jpeg' : 'video/mp4');
      const extension = mimeType.split('/')[1]?.replace('quicktime', 'mov') ?? (kind === 'photo' ? 'jpg' : 'mp4');
      return { uri, mimeType, name: `${kind}_${index + 1}.${extension}` };
    });
}

/**
 * Where the booking payment comes from: a claim an admin approved ("I have
 * paid"), or, in development builds only, the API's test payment.
 */
type PaymentSource =
  | { kind: 'claim'; paymentId: string; amount: number; externalPaymentId: string }
  | { kind: 'test' };

export default function CheckoutPaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const {
    getJob,
    markBookingFeePaid,
    linkChatThread,
    createBackendJob,
    requestPhoneVerification,
    verifyPhoneOtp,
    createBookingPayment,
    proposeTechnicianToJob,
  } = useFundi();

  const params = useLocalSearchParams<{
    requestId?: string;
    technicianId?: string;
    service?: string;
    amount?: string;
    currency?: string;
    categoryId?: string;
    phoneVerificationId?: string;
    verifiedPhone?: string;
  }>();

  const job = params.requestId ? getJob(params.requestId) : undefined;
  const technician: MarketplaceTechnician | undefined = useMemo(() => {
    if (job?.technician) {
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
    return undefined;
  }, [job?.technician]);

  const targetService = job?.service || params.service || technician?.service;
  const paidAlready = job?.bookingFee?.status === 'PAID';
  // The API prices the booking: base fee plus any charges the client pays.
  const { quote } = usePaymentQuote({
    service: targetService,
    categoryId: params.categoryId || job?.serviceCategoryId,
    requestType: job?.type === 'SOS' ? 'SOS' : 'NORMAL',
    enabled: !paidAlready,
  });
  const fallbackAmount =
    job?.bookingFee?.amount ?? (params.amount ? parseFloat(params.amount) : getServiceBookingFee(targetService));
  const bookingAmount = paidAlready ? fallbackAmount : quote?.customerTotal ?? fallbackAmount;
  const bookingCurrency = job?.bookingFee?.currency ?? params.currency ?? FLAT_BOOKING_FEE_CURRENCY;

  const [showTerms, setShowTerms] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentClaimMethod>('MTN');
  const [phoneNumber, setPhoneNumber] = useState(
    cleanAndNormalizePhone(params.verifiedPhone || account?.phone || ''),
  );
  const paymentClaim = usePaymentClaim(params.requestId || job?.id);
  // Lists show "Confirming payment" while a reported payment waits for Fundi.
  const { setPaymentReported } = useFundi();
  const claimStatus = paymentClaim.claim?.status;
  useEffect(() => {
    const requestId = params.requestId || job?.id;
    if (!requestId) return;
    setPaymentReported(requestId, claimStatus === 'PENDING' || claimStatus === 'APPROVED');
  }, [claimStatus, setPaymentReported, params.requestId, job?.id]);
  const sourceRef = useRef<PaymentSource>({ kind: 'test' });
  const continuedClaimRef = useRef<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string>('');

  // Phone verification state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(
    params.phoneVerificationId || null,
  );
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSentAt, setOtpSentAt] = useState(() => new Date().toISOString());
  const [isResendingOtp, setIsResendingOtp] = useState(false);

  const { remainingSeconds: resendSeconds } = useCountdown(otpSentAt, 60 * 1000);
  const canResendOtp = resendSeconds === 0 && !isResendingOtp;

  const isAlreadyPaid = job?.bookingFee?.status === 'PAID';
  const destinationChatId = job?.id || params.requestId;

  // Route Guard: If booking fee is already settled, redirect to chat always to prevent disruptions
  useEffect(() => {
    if (isAlreadyPaid && !isProcessing && !paymentSuccess) {
      if (destinationChatId) {
        router.replace({
          pathname: `/chat/${destinationChatId}` as any,
          params: { requestId: job?.id || params.requestId },
        });
      } else {
        router.replace('/(tabs)/chat');
      }
    }
  }, [isAlreadyPaid, isProcessing, paymentSuccess, destinationChatId, job?.id, params.requestId, router]);

  // Back guard: Prevent returning into payment once fee is confirmed or already paid (Mobile & Web)
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (paymentSuccess || isAlreadyPaid) {
          if (destinationChatId) {
            router.replace({
              pathname: `/chat/${destinationChatId}` as any,
              params: { requestId: job?.id || params.requestId },
            });
          } else {
            router.replace('/(tabs)/chat');
          }
          return true;
        }
        return false;
      });
      return () => backSub.remove();
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebPop = () => {
        if (paymentSuccess || isAlreadyPaid) {
          if (destinationChatId) {
            router.replace({
              pathname: `/chat/${destinationChatId}` as any,
              params: { requestId: job?.id || params.requestId },
            });
          } else {
            router.replace('/(tabs)/chat');
          }
        }
      };
      window.addEventListener('popstate', handleWebPop);
      return () => window.removeEventListener('popstate', handleWebPop);
    }
  }, [paymentSuccess, isAlreadyPaid, destinationChatId, job?.id, params.requestId, router]);

  const handlePay = async (source: PaymentSource) => {
    sourceRef.current = source;
    if (!params.requestId && !job?.id) {
      setPaymentError('Request reference is missing. Please go back and try again.');
      return;
    }

    setPaymentError(null);
    setOtpError(null);

    // No code yet: an account whose number is already verified needs none;
    // otherwise send one and confirm it before paying.
    if (!phoneVerificationId) {
      setIsProcessing(true);
      try {
        const status = await fetchJobPhoneStatus().catch(() => null);
        if (status?.verified) {
          await executeBookingAndCreateJob(null);
          return;
        }
        const req = await requestPhoneVerification();
        setPhoneVerificationId(req.verificationId);
        setIsProcessing(false);
        setShowOtpModal(true);
        return;
      } catch (err) {
        setIsProcessing(false);
        setPaymentError(err instanceof Error ? err.message : 'Could not request phone verification.');
        return;
      }
    }

    await executeBookingAndCreateJob(phoneVerificationId);
  };

  const handleConfirmOtpAndPay = async () => {
    if (!phoneVerificationId || otpCode.trim().length < 6) return;
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const verifyRes = await verifyPhoneOtp(phoneVerificationId, otpCode.trim());
      if (!verifyRes.verified) {
        throw new Error('Code verification failed. Check the code and try again.');
      }
      setShowOtpModal(false);
      await executeBookingAndCreateJob(phoneVerificationId);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // One job per request: a repeated tap (or a resumed screen) must not send it twice.
  const creatingRef = useRef(false);
  const executeBookingAndCreateJob = async (verificationId: string | null) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsProcessing(true);
    setPaymentError(null);

    // Matching is by distance, so a request without a map position must not be
    // sent with a made-up one. Ask the client to fix the location first.
    const latitude = job?.locationLatitude;
    const longitude = job?.locationLongitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setIsProcessing(false);
      setPaymentError(
        'This request has no map location yet. Go back, set the service location (or use your current location), then pay.',
      );
      return;
    }
    // The API refuses a job described in fewer than 10 characters; catch it before charging.
    const description = (job?.problem || '').trim();
    if (description.length < 10) {
      setIsProcessing(false);
      setPaymentError('Describe the problem in at least 10 characters. Go back and edit the request, then pay.');
      return;
    }

    const targetRequestId = params.requestId || job!.id;
    const targetServiceCategoryId = await resolveServiceCategoryId(
      targetService,
      params.categoryId || job?.serviceCategoryId,
    );
    const normalizedPhone = cleanAndNormalizePhone(phoneNumber);

    try {
      // 1. The booking payment: the one an admin approved, or a test payment in development.
      const source = sourceRef.current;
      const bookingPayment =
        source.kind === 'claim'
          ? { id: source.paymentId, amount: source.amount, externalPaymentId: source.externalPaymentId }
          : await createBookingPayment(targetServiceCategoryId, job?.type === 'SOS' ? 'SOS' : 'NORMAL', normalizedPhone);

      // 2. Create customer job on real backend
      // The price itself is agreed in the chat, so no amount is sent here.
      const photos = requestMediaParts(job?.photoUris?.length ? job.photoUris : [job?.photoUri], 'photo');
      const [video] = requestMediaParts([job?.videoUris?.[0] ?? job?.videoUri], 'video');
      const createdBackendJob = await createBackendJob({
        paymentId: bookingPayment.id,
        ...(verificationId ? { phoneVerificationId: verificationId } : {}),
        serviceCategoryId: targetServiceCategoryId,
        description,
        locationAddress: job?.locationLabel?.trim() || `${latitude}, ${longitude}`,
        latitude: latitude as number,
        longitude: longitude as number,
        requestType: job?.type === 'SOS' ? 'SOS' : 'NORMAL',
        ...(photos.length ? { photos } : {}),
        ...(video ? { video } : {}),
      }, targetRequestId);

      // 3. Route the request to the selected technician: it lands in their inbox as an
      //    incoming request they can accept or decline. A failure here must not lose the
      //    paid job, so it is reported in the chat where the client can resend or pick
      //    someone else. (The price negotiation opens automatically once they accept.)
      const techId = params.technicianId || job?.technician?.id;
      let proposalError: string | undefined;
      if (techId && job?.type !== 'SOS') {
        try {
          await proposeTechnicianToJob(createdBackendJob.id, techId);
        } catch (propErr) {
          proposalError =
            propErr instanceof Error ? propErr.message : 'The request could not be sent to this technician.';
        }
      } else if (job?.type !== 'SOS') {
        proposalError = 'No technician was selected for this request.';
      }

      // 4. Update local state and show payment success, then continue in the chat.
      const txId = bookingPayment.externalPaymentId || `TX-${Date.now().toString(36).toUpperCase()}`;
      markBookingFeePaid(createdBackendJob.id, txId, bookingPayment.amount);
      if (source.kind === 'claim') await paymentClaim.clear();
      setTransactionRef(txId);
      setIsProcessing(false);
      setPaymentSuccess(true);

      setTimeout(() => {
        router.replace({
          pathname: '/chat/[id]',
          params: {
            id: createdBackendJob.id,
            requestId: createdBackendJob.id,
            firstMessage: 'true',
            ...(techId ? { technicianId: techId } : {}),
            ...(proposalError ? { proposalError } : {}),
          },
        });
      }, 1400);
    } catch (err) {
      creatingRef.current = false;
      setIsProcessing(false);
      // The API already has this request open: continue it instead of making another.
      const existingJobId = err instanceof ApiRequestError ? err.details?.existingJobId : undefined;
      if (typeof existingJobId === 'string') {
        router.replace({ pathname: '/chat/[id]', params: { id: existingJobId, requestId: existingJobId } });
        return;
      }
      setPaymentError(err instanceof Error ? err.message : 'Payment or job creation failed. Please retry.');
    }
  };

  /** "I have paid": report the payment so an admin can match it. */
  const handleReportPaid = async () => {
    setPaymentError(null);
    const payer = cleanAndNormalizePhone(phoneNumber);
    if (payer.replace(/\D/g, '').length < 9) {
      setPaymentError('Enter the mobile money number you paid from.');
      return;
    }
    try {
      const serviceCategoryId = await resolveServiceCategoryId(
        targetService,
        params.categoryId || job?.serviceCategoryId,
      );
      await paymentClaim.submit({
        serviceCategoryId,
        requestType: job?.type === 'SOS' ? 'SOS' : 'NORMAL',
        amount: bookingAmount,
        paymentMethod: payMethod,
        paymentNumber: payer,
      });
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Your payment could not be reported. Please try again.');
    }
  };

  // Once an admin confirms the payment, send the request with it (once; the
  // status card offers "Send my request" if that attempt fails).
  const approvedClaim = paymentClaim.claim?.status === 'APPROVED' ? paymentClaim.claim : null;
  const continueWithClaim = () => {
    const payment = approvedClaim?.bookingPayment;
    if (!approvedClaim || !payment || payment.jobId) return;
    continuedClaimRef.current = approvedClaim.id;
    void handlePay({
      kind: 'claim',
      paymentId: payment.id,
      amount: payment.amount,
      externalPaymentId: `claim_${approvedClaim.id}`,
    });
  };
  useEffect(() => {
    if (!approvedClaim || continuedClaimRef.current === approvedClaim.id || isProcessing || paymentSuccess) return;
    continueWithClaim();
    // handlePay reads the latest state itself; only a newly approved claim should trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedClaim?.id, approvedClaim?.bookingPayment?.id]);

  const claimOpen = paymentClaim.claim !== null;

  const handleCancel = () => {
    // If payment was already completed, redirect to chats always
    if (paymentSuccess || isAlreadyPaid) {
      if (destinationChatId) {
        router.replace({
          pathname: `/chat/${destinationChatId}` as any,
          params: { requestId: job?.id || params.requestId },
        });
      } else {
        router.replace('/(tabs)/chat');
      }
      return;
    }
    // Opened from a notification or a resumed request: there may be nothing behind it.
    if (router.canGoBack()) router.back();
    else router.replace('/activity');
  };

  /** Picks someone else before paying; the request and its details stay the same. */
  const changeTechnician = () => {
    const requestId = job?.id || params.requestId;
    if (!requestId) return;
    router.replace({ pathname: '/select-technician', params: { jobId: requestId, service: targetService ?? '' } });
  };

  // Immediate block on web/native: Do not render payment UI if already paid
  if (isAlreadyPaid && !isProcessing && !paymentSuccess) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <BackButton onPress={handleCancel} />
        <Text style={[styles.titleTop, { color: colors.foreground }]}>Pay booking fee</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Who is being booked, so this one screen covers review and payment. */}
        {job?.technician ? (
          <View style={styles.bookingWith}>
            <TechnicianCard requestId={job.id} technician={job.technician} compact caption={`Booking for ${targetService ?? 'your request'}`} />
            {paymentClaim.claim ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={changeTechnician}
                hitSlop={8}
                style={styles.changeLink}
                testID="payment-change-technician"
              >
                <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                <Text style={[styles.changeLinkText, { color: colors.primary }]}>Change technician</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Amount Summary Banner */}
        <SectionCard emphasis>
          <Text style={[styles.amountLabel, { color: colors.primaryForeground }]}>
            TOTAL SERVICE BOOKING FEE
          </Text>
          <Text style={[styles.amountValue, { color: colors.primaryForeground }]}>
            {formatBookingFee(bookingAmount, bookingCurrency)}
          </Text>
          <Text style={[styles.amountDesc, { color: colors.secondary }]}>
            Sends your request to the technician and opens the chat. This is not the job price.
          </Text>
          <PriceBreakdown quote={quote} onEmphasis testID="payment-breakdown" />
        </SectionCard>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showTerms }}
          onPress={() => setShowTerms((open) => !open)}
          style={styles.termsToggle}
          testID="booking-fee-terms-toggle"
        >
          <Text style={[styles.termsToggleText, { color: colors.primary }]}>How the booking fee works</Text>
          <Ionicons name={showTerms ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
        </Pressable>
        {showTerms ? (
        <View style={[styles.termsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: 'time-outline' as const, text: 'Valid for 7 days from payment. The clock pauses while a technician is working with you.' },
            { icon: 'swap-horizontal-outline' as const, text: 'If the technician declines or does not answer, the same fee covers sending the request to someone else.' },
            { icon: 'chatbubbles-outline' as const, text: 'You agree the job price with the technician in the chat. Agreeing a price confirms the job and uses the fee.' },
            { icon: 'close-circle-outline' as const, text: 'You can pull out before a price is agreed and keep the remaining validity for another technician.' },
          ].map((term) => (
            <View key={term.text} style={styles.termRow}>
              <Ionicons name={term.icon} size={16} color={colors.primary} />
              <Text style={[styles.termText, { color: colors.mutedForeground }]}>{term.text}</Text>
            </View>
          ))}
        </View>
        ) : null}

        {paymentError || paymentClaim.error ? (
          <Notice tone="warning" icon="alert-circle-outline" text={(paymentError || paymentClaim.error)!} />
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
            continuing={isProcessing || paymentSuccess || showOtpModal}
          />
        ) : null}

        {/* Payment Methods */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pay with mobile money</Text>
        </View>
        <PayByCode
          method={payMethod}
          onMethodChange={setPayMethod}
          payerNumber={phoneNumber}
          onPayerNumberChange={setPhoneNumber}
          amount={bookingAmount}
          disabled={claimOpen}
        />
      </ScrollView>

      {/* Sticky bottom CTA: hidden while a reported payment is being checked. */}
      {claimOpen ? null : (
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
            label={`I have paid ${formatBookingFee(bookingAmount, bookingCurrency)}`}
            icon="checkmark-done"
            onPress={() => void handleReportPaid()}
            loading={paymentClaim.submitting}
            disabled={isProcessing}
            testID="i-have-paid-button"
          />
          {__DEV__ ? (
            <Button
              label="Test payment (development only)"
              variant="outline"
              size="small"
              onPress={() => void handlePay({ kind: 'test' })}
              disabled={isProcessing || paymentClaim.submitting}
              testID="confirm-payment-button"
            />
          ) : null}
        </View>
      )}

      {/* Phone Verification OTP Modal */}
      <Modal visible={showOtpModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border, width: '90%', maxWidth: 400 }]}>
            <View style={[styles.successIconCircle, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Verify Phone Number</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              Enter the 6-digit code we sent to your phone to confirm this request.
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
              style={[
                styles.textInput,
                {
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
                  marginTop: 8,
                },
              ]}
            />
            {/* Resend Code Button & Countdown */}
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              {canResendOtp ? (
                <Pressable
                  onPress={async () => {
                    setIsResendingOtp(true);
                    setOtpError(null);
                    setOtpCode('');
                    try {
                      const res = await requestPhoneVerification(cleanAndNormalizePhone(phoneNumber));
                      setPhoneVerificationId(res.verificationId);
                      setOtpSentAt(new Date().toISOString());
                    } catch (e: any) {
                      setOtpError(e?.message || 'Failed to resend verification code.');
                    } finally {
                      setIsResendingOtp(false);
                    }
                  }}
                  disabled={isResendingOtp}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                    {isResendingOtp ? 'Resending...' : 'Resend Code'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  Resend code in {resendSeconds}s
                </Text>
              )}
            </View>

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
                loading={isVerifyingOtp}
                disabled={otpCode.trim().length < 6}
                style={{ flex: 1 }}
                onPress={handleConfirmOtpAndPay}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Processing Modal */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Booking your request</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              Sending your request to the technician…
            </Text>
          </View>
        </View>
      </Modal>

      {/* Payment Success Modal */}
      <Modal visible={paymentSuccess} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.successIconCircle, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-sharp" size={36} color={colors.success} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Payment Confirmed!</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              Booking Fee paid successfully. Ref: {transactionRef}
            </Text>
            <View style={[styles.redirectNotice, { backgroundColor: colors.primary + '14' }]}>
              <Ionicons name="chatbubbles" size={16} color={colors.primary} />
              <Text style={[styles.redirectText, { color: colors.primary }]}>
                Opening technician chat session...
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bookingWith: { gap: 6 },
  changeLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  changeLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  termsCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, marginTop: 4 },
  termsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 },
  termsToggleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  termText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
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
  amountLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  amountValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    letterSpacing: -1,
    marginVertical: 4,
  },
  amountDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  sectionHeaderRow: {
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  channelGroup: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  channelTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  optBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },
  channelDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  textInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  inputHint: {
    fontFamily: 'Inter_400Regular',
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
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  modalDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  redirectNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  redirectText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});
