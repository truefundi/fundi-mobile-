import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Notice } from '@/components/ui/Notice';
import { StageScreen } from '@/components/ui/StageScreen';
import { OTP_LENGTH, formatPhone } from '@/constants/auth';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useCountdown } from '@/hooks/useCountdown';
import { cleanAndNormalizePhone } from '@/lib/auth-api';
import { fetchJobPhoneStatus, requestJobPhoneVerification, verifyJobPhone } from '@/lib/jobs-api';

const RESEND_COOLDOWN_MS = 60_000;

/**
 * Reached from Profile: confirm the account's number with an SMS code, or
 * confirm a new one, which then becomes the number you sign in with. A
 * verified number lets requests skip the code step.
 */
export default function VerifyNumberScreen() {
  const colors = useColors();
  const router = useRouter();
  const { account, adoptVerifiedPhone } = useAuth();

  const [status, setStatus] = useState<{ phoneNumber: string; verified: boolean } | null>(null);
  const [phoneInput, setPhoneInput] = useState(account?.phone ?? '');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(() => new Date(0).toISOString());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { remainingSeconds } = useCountdown(sentAt, RESEND_COOLDOWN_MS);

  useEffect(() => {
    let active = true;
    fetchJobPhoneStatus()
      .then((result) => {
        if (active) setStatus({ phoneNumber: result.phoneNumber, verified: result.verified });
      })
      .catch(() => {
        if (active) setStatus({ phoneNumber: account?.phone ?? '', verified: false });
      });
    return () => {
      active = false;
    };
  }, [account?.phone]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const target = cleanAndNormalizePhone(phoneInput.trim());
  const isNewNumber = !!status && target !== cleanAndNormalizePhone(status.phoneNumber);
  const alreadyVerified = !!status?.verified && !isNewNumber;

  const sendCode = async () => {
    setError(null);
    if (target.replace(/\D/g, '').length < 12) {
      setError('Enter a full Rwandan mobile number, e.g. 0788 123 456.');
      return;
    }
    setBusy('send');
    try {
      const res = (await requestJobPhoneVerification(target)) as Awaited<ReturnType<typeof requestJobPhoneVerification>> & {
        verified?: boolean;
      };
      if (res.verified && !res.verificationId) {
        setDone(`${formatPhone(target)} is already verified.`);
        setStatus({ phoneNumber: target, verified: true });
        return;
      }
      setVerificationId(res.verificationId);
      setSentTo(target);
      setSentAt(new Date().toISOString());
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The code could not be sent. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmCode = async () => {
    if (!verificationId || code.trim().length !== OTP_LENGTH) return;
    setError(null);
    setBusy('verify');
    try {
      const res = await verifyJobPhone(verificationId, code.trim());
      await adoptVerifiedPhone(res.phoneNumber);
      setStatus({ phoneNumber: res.phoneNumber, verified: true });
      setVerificationId(null);
      setSentTo(null);
      setPhoneInput(res.phoneNumber);
      setDone(
        isNewNumber
          ? `${formatPhone(res.phoneNumber)} is verified and is now the number you sign in with.`
          : `${formatPhone(res.phoneNumber)} is verified. Your requests no longer ask for a code.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work. Check it and try again.');
      setCode('');
    } finally {
      setBusy(null);
    }
  };

  const footer = done ? (
    <Button label="Done" icon="checkmark" onPress={leave} testID="verify-number-done" />
  ) : verificationId ? (
    <Button
      label="Verify number"
      icon="shield-checkmark"
      onPress={() => void confirmCode()}
      loading={busy === 'verify'}
      disabled={code.trim().length !== OTP_LENGTH || busy !== null}
      testID="verify-number-confirm"
    />
  ) : (
    <Button
      label={alreadyVerified ? 'Already verified' : 'Send code'}
      icon={alreadyVerified ? 'checkmark-circle' : 'chatbubble-ellipses-outline'}
      onPress={() => void sendCode()}
      loading={busy === 'send'}
      disabled={!status || alreadyVerified || busy !== null}
      testID="verify-number-send"
    />
  );

  return (
    <StageScreen
      eyebrow="Profile"
      title="Verify your number"
      subtitle="A verified number lets you send requests without entering a code each time."
      onBack={leave}
      footer={footer}
    >
      {!status ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View
            testID="verify-number-status"
            style={[
              styles.statusCard,
              {
                backgroundColor: status.verified ? colors.successMuted : colors.warningMuted,
                borderColor: status.verified ? colors.success : colors.warningMuted,
              },
            ]}
          >
            <Ionicons
              name={status.verified ? 'shield-checkmark' : 'alert-circle-outline'}
              size={22}
              color={status.verified ? colors.success : colors.warningForeground}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>{formatPhone(status.phoneNumber)}</Text>
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                {status.verified ? 'Verified' : 'Not verified yet: requests ask for a code until it is.'}
              </Text>
            </View>
          </View>

          {done ? <Notice tone="success" icon="checkmark-circle-outline" text={done} testID="verify-number-success" /> : null}

          {!done ? (
            <View>
              <FieldLabel label="Phone number" required style={{ marginTop: 8 }} />
              <TextInput
                accessibilityLabel="Phone number"
                testID="verify-number-phone"
                value={phoneInput}
                onChangeText={(value) => {
                  setPhoneInput(value);
                  setVerificationId(null);
                  setSentTo(null);
                  setError(null);
                }}
                editable={busy === null}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="0788 123 456"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {isNewNumber
                  ? 'Once verified, this new number replaces your current one: you will sign in with it.'
                  : 'We send a 6-digit code to this number.'}
              </Text>
            </View>
          ) : null}

          {verificationId && sentTo && !done ? (
            <View>
              <FieldLabel label={`Code sent to ${formatPhone(sentTo)}`} style={{ marginTop: 8 }} />
              <TextInput
                accessibilityLabel="Verification code"
                testID="verify-number-code"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                placeholder="••••••"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  styles.codeInput,
                  { backgroundColor: colors.card, borderColor: colors.primary, color: colors.foreground },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void sendCode()}
                disabled={remainingSeconds > 0 || busy !== null}
                hitSlop={6}
                testID="verify-number-resend"
                style={{ alignSelf: 'flex-start', marginTop: 10 }}
              >
                <Text
                  style={[
                    styles.resend,
                    { color: remainingSeconds > 0 ? colors.mutedForeground : colors.primary },
                  ]}
                >
                  {remainingSeconds > 0 ? `Send again in ${remainingSeconds}s` : 'Send the code again'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {error ? <Notice tone="warning" icon="alert-circle-outline" text={error} testID="verify-number-error" /> : null}
        </>
      )}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  statusText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Inter_500Medium', fontSize: 15 },
  codeInput: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 6 },
  resend: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
