import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import { OTP_LENGTH } from '@/constants/auth';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';
import { useColors } from '@/hooks/useColors';
import { useCountdown } from '@/hooks/useCountdown';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import { resolveServiceCategoryId } from '@/lib/categories-api';
import { fetchJobPhoneStatus } from '@/lib/jobs-api';
import { notify } from '@/lib/haptics';

const RESEND_COOLDOWN_MS = 60 * 1000;

export default function VerifyPhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string;
    technicianId?: string;
    service?: string;
    categoryId?: string;
    urgency?: string;
    amount?: string;
    currency?: string;
    phone?: string;
  }>();

  const { account } = useAuth();
  const { requestPhoneVerification, verifyPhoneOtp } = useFundi();

  // Initial phone determination
  const initialRawPhone = params.phone || account?.phone || '0788123456';
  const initialNormalized = cleanAndNormalizePhone(initialRawPhone);

  const [phone, setPhone] = useState(initialNormalized);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(initialNormalized);

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(() => new Date().toISOString());
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isExpiredOrInvalid, setIsExpiredOrInvalid] = useState(false);

  const inputRef = useRef<TextInputInstance>(null);
  const hasRequestedInitial = useRef(false);
  // Until the account's verified status is known nothing is shown, so a verified
  // account passes through without the code screen flashing up.
  const [checkingStatus, setCheckingStatus] = useState(true);

  // 60-second cooldown timer
  const { remainingSeconds } = useCountdown(sentAt, RESEND_COOLDOWN_MS);
  const canResend = remainingSeconds === 0 && !isRequesting;

  // Send OTP
  const sendVerificationCode = async (targetPhone: string) => {
    setIsRequesting(true);
    setError(null);
    setInfoMessage(null);
    setIsExpiredOrInvalid(false);
    setCode('');

    const formatted = cleanAndNormalizePhone(targetPhone);
    try {
      const response = await requestPhoneVerification(formatted);
      setVerificationId(response.verificationId);
      setSentAt(new Date().toISOString());
      setInfoMessage(`Verification code sent to ${formatted}`);
      await notify('success');
      setTimeout(() => inputRef.current?.focus(), 150);
    } catch (err: any) {
      const msg = err?.message || 'Could not send verification code. Please check the phone number.';
      setError(msg);
      await notify('error');
    } finally {
      setIsRequesting(false);
    }
  };

  // On load: an account whose number is already verified skips the code and
  // goes straight to the booking fee. Otherwise the code is sent right away.
  useEffect(() => {
    if (hasRequestedInitial.current) return;
    hasRequestedInitial.current = true;
    let active = true;
    (async () => {
      setIsRequesting(true);
      try {
        const status = await fetchJobPhoneStatus();
        const sameNumber = !params.phone || cleanAndNormalizePhone(params.phone) === cleanAndNormalizePhone(status.phoneNumber);
        if (active && status.verified && sameNumber) {
          const finalCategoryId = await resolveServiceCategoryId(params.service, params.categoryId);
          router.replace({
            pathname: '/checkout/booking-fee',
            params: {
              requestId: params.requestId,
              technicianId: params.technicianId,
              service: params.service,
              categoryId: finalCategoryId,
              verifiedPhone: cleanAndNormalizePhone(status.phoneNumber),
              amount: params.amount,
              currency: params.currency,
            },
          });
          return;
        }
      } catch {
        // Status unavailable: fall back to verifying with a code.
      }
      if (!active) return;
      setCheckingStatus(false);
      await sendVerificationCode(phone);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Submit entered OTP
  const handleVerify = async (otpToVerify: string) => {
    if (!verificationId) {
      setError('Please request a verification code first.');
      return;
    }
    if (otpToVerify.length !== OTP_LENGTH) {
      setError(`Please enter the complete ${OTP_LENGTH}-digit code.`);
      return;
    }

    setIsVerifying(true);
    setError(null);
    setIsExpiredOrInvalid(false);

    try {
      const verifyRes = await verifyPhoneOtp(verificationId, otpToVerify.trim());
      await notify('success');

      // Resolve the actual backend service category UUID
      const finalCategoryId = await resolveServiceCategoryId(params.service, params.categoryId);

      // Navigate smoothly to Booking Fee checkout screen
      router.replace({
        pathname: '/checkout/booking-fee',
        params: {
          requestId: params.requestId,
          technicianId: params.technicianId,
          service: params.service,
          categoryId: finalCategoryId,
          phoneVerificationId: verifyRes.verificationId || verificationId,
          verifiedPhone: cleanAndNormalizePhone(phone),
          amount: params.amount,
          currency: params.currency,
        },
      });
    } catch (err: any) {
      const rawMsg = err?.message || '';
      const isExpired = rawMsg.toLowerCase().includes('expired') || rawMsg.toLowerCase().includes('already used');
      const isInvalid = rawMsg.toLowerCase().includes('incorrect') || rawMsg.toLowerCase().includes('invalid');

      setIsExpiredOrInvalid(true);
      if (isExpired) {
        setError('This verification code has expired. Please request a new code.');
      } else if (isInvalid) {
        setError('Incorrect verification code. Please check the code and try again.');
      } else {
        setError(rawMsg || 'Verification failed. Please try again.');
      }
      setCode('');
      await notify('error');
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    sendVerificationCode(phone);
  };

  const handleSavePhone = () => {
    const normalized = cleanAndNormalizePhone(phoneInput);
    if (!/^\+250(?:78|79|72|73)\d{7}$/.test(normalized)) {
      setError('Enter a valid Rwandan mobile number (e.g. +250 788 123 456).');
      return;
    }
    setPhone(normalized);
    setIsEditingPhone(false);
    sendVerificationCode(normalized);
  };

  if (checkingStatus) {
    return (
      <View style={[styles.container, styles.checking, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <Text style={[styles.titleTop, { color: colors.foreground }]}>Phone Verification</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeading
          eyebrow="SECURITY VERIFICATION"
          title="Verify Your Phone"
          subtitle={`We protect your service booking with phone verification. A ${OTP_LENGTH}-digit code was sent via SMS.`}
        />

        {/* Phone display / edit card */}
        <View style={[styles.phoneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.phoneHeaderRow}>
            <View style={styles.phoneIconWrap}>
              <Text style={{ fontSize: 20 }}>🇷🇼</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.phoneLabel, { color: colors.mutedForeground }]}>
                Verification Phone Number
              </Text>
              {!isEditingPhone ? (
                <Text style={[styles.phoneValue, { color: colors.foreground }]}>
                  {phone}
                </Text>
              ) : (
                <View style={styles.editRow}>
                  <TextInput
                    style={[
                      styles.phoneInput,
                      { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    placeholder="+250 788 123 456"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                    autoFocus
                  />
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSavePhone}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Send Code</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {!isEditingPhone && (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setPhoneInput(phone);
                  setIsEditingPhone(true);
                }}
              >
                <Feather name="edit-2" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Info Banner */}
        {infoMessage && !error && (
          <View style={[styles.banner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.bannerText, { color: colors.primary }]}>{infoMessage}</Text>
          </View>
        )}

        {/* Error Banner */}
        {error && (
          <View style={[styles.banner, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive + '30' }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={[styles.bannerText, { color: colors.destructive }]}>{error}</Text>
              {isExpiredOrInvalid && canResend && (
                <Pressable onPress={handleResend} style={{ marginTop: 6 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                    Request a new code now →
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* OTP Input Boxes */}
        <View style={styles.otpSection}>
          <Text style={[styles.otpSectionLabel, { color: colors.mutedForeground }]}>
            ENTER 6-DIGIT CODE
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Enter the ${OTP_LENGTH} digit code`}
            onPress={() => inputRef.current?.focus()}
            style={styles.cellRow}
          >
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const digit = code[index] ?? '';
              const active = index === code.length && !isVerifying;
              const hasDigit = Boolean(digit);

              return (
                <View
                  key={index}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: colors.card,
                      borderColor: error
                        ? colors.destructive
                        : active
                        ? colors.primary
                        : hasDigit
                        ? colors.foreground + '40'
                        : colors.border,
                      borderWidth: active ? 2 : 1.5,
                    },
                  ]}
                >
                  <Text style={[styles.cellText, { color: colors.foreground }]}>{digit}</Text>
                </View>
              );
            })}

            <TextInput
              ref={inputRef}
              accessibilityLabel="Verification code"
              testID="job-otp-input"
              value={code}
              onChangeText={(value) => {
                const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
                setCode(digits);
                setError(null);
                if (digits.length === OTP_LENGTH) {
                  handleVerify(digits);
                }
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={OTP_LENGTH}
              autoFocus={Platform.OS !== 'web'}
              caretHidden
              style={styles.hiddenInput}
            />
          </Pressable>
        </View>

        {/* Resend Code Section with 60-second Countdown */}
        <View style={styles.resendContainer}>
          <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
            Didn't receive the code?
          </Text>

          {canResend ? (
            <Pressable
              onPress={handleResend}
              style={[styles.resendButton, { borderColor: colors.primary }]}
              disabled={isRequesting}
            >
              {isRequesting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.resendButtonContent}>
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.resendActiveText, { color: colors.primary }]}>Resend Code</Text>
                </View>
              )}
            </Pressable>
          ) : (
            <View style={[styles.resendDisabledBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="time-outline" size={15} color={colors.mutedForeground} style={{ marginRight: 5 }} />
              <Text style={[styles.countdownText, { color: colors.mutedForeground }]}>
                Resend code in <Text style={{ fontWeight: '700', color: colors.foreground }}>{remainingSeconds}s</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Verify & Continue Button */}
        <View style={styles.footerSection}>
          <Button
            label={isVerifying ? 'Verifying Code...' : 'Verify & Continue to Booking'}
            onPress={() => handleVerify(code)}
            disabled={code.length !== OTP_LENGTH || isVerifying}
            loading={isVerifying}
            icon="arrow-forward"
            testID="phone-verify-continue-btn"
          />

          <View style={styles.secureNote}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.secureText, { color: colors.mutedForeground }]}>
              Verified by Fundi Secure SMS Authentication
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  checking: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleTop: {
    fontSize: 17,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  phoneCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  phoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000008',
  },
  phoneLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  phoneValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phoneInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  smallBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginLeft: 6,
  },
  otpSection: {
    marginTop: 10,
    marginBottom: 24,
    alignItems: 'center',
  },
  otpSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  cellRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    position: 'relative',
    width: '100%',
  },
  cell: {
    width: 48,
    height: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 22,
    fontWeight: '700',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  resendText: {
    fontSize: 13,
    marginBottom: 8,
  },
  resendButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendActiveText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resendDisabledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  countdownText: {
    fontSize: 13,
  },
  footerSection: {
    marginTop: 'auto',
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 6,
  },
  secureText: {
    fontSize: 12,
  },
});
