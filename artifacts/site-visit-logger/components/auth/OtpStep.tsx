import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPhone, OTP_LENGTH, RESEND_AFTER_MS } from '@/constants/auth';
import { useAuth, type Verification } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useCountdown } from '@/hooks/useCountdown';

/** The last step of registration: the code created when the number was sent. */
export function OtpStep({ verification }: { verification: Verification }) {
  const colors = useColors();
  const { verifyCode, resendCode, cancelVerification } = useAuth();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { remainingSeconds } = useCountdown(verification.sentAt, RESEND_AFTER_MS);
  // A customer out of tries needs a new code now, not after the timer.
  const canResend = remainingSeconds === 0 || verification.attemptsLeft <= 0;

  const submit = async (entered: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');
    try {
      await verifyCode(entered);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We could not check that code. Try again.');
      setCode('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      input.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const resend = async () => {
    setIsResending(true);
    setError('');
    setCode('');
    try {
      await resendCode();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We could not send a new code. Try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.step}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="verify-back-button"
        onPress={cancelVerification}
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </Pressable>

      <Text style={[styles.eyebrow, { color: colors.primary }]}>{verification.intent === 'login' ? 'WELCOME BACK' : 'STEP 2 OF 2'}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {verification.intent === 'login' ? 'Confirm it is you' : 'Verify your number'}
      </Text>
      <Text style={[styles.phone, { color: colors.foreground }]}>{formatPhone(verification.phone)}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Enter the ${OTP_LENGTH} digit code`}
        onPress={() => input.current?.focus()}
        style={styles.cellRow}
      >
        {Array.from({ length: OTP_LENGTH }).map((_, index) => {
          const digit = code[index] ?? '';
          const active = index === code.length;
          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  backgroundColor: colors.card,
                  borderColor: error ? colors.destructive : active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.cellText, { color: colors.foreground }]}>{digit}</Text>
            </View>
          );
        })}
        <TextInput
          ref={input}
          accessibilityLabel="Verification code"
          testID="otp-input"
          value={code}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
            setCode(digits);
            setError('');
            if (digits.length === OTP_LENGTH) submit(digits);
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

      {error ? <Text testID="otp-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Verify"
        accessibilityState={{ disabled: code.length !== OTP_LENGTH || isVerifying, busy: isVerifying }}
        testID="verify-code-button"
        onPress={() => submit(code)}
        disabled={code.length !== OTP_LENGTH || isVerifying}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: code.length === OTP_LENGTH && !isVerifying ? colors.primary : colors.muted,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        {isVerifying ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryText, { color: code.length === OTP_LENGTH ? colors.primaryForeground : colors.mutedForeground }]}>
            Verify
          </Text>
        )}
      </Pressable>

      <View style={styles.resendRow}>
        {canResend ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Send a new code" testID="resend-code-button" onPress={resend} disabled={isResending}>
            <Text style={[styles.resendAction, { color: colors.primary }]}>{isResending ? 'Sending…' : 'Send a new code'}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.resendWait, { color: colors.mutedForeground }]}>You can ask for a new code in {remainingSeconds}s</Text>
        )}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Use another number" testID="use-another-number-button" onPress={cancelVerification} style={styles.changeRow}>
        <Text style={[styles.changeText, { color: colors.mutedForeground }]}>Wrong number? </Text>
        <Text style={[styles.changeAction, { color: colors.primary }]}>Use another one</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginTop: 18, marginBottom: 7, textAlign: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  phone: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginTop: 9 },
  cellRow: { flexDirection: 'row', gap: 10, marginTop: 26 },
  cell: { flex: 1, height: 66, maxWidth: 72, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: 'Inter_700Bold', fontSize: 26 },
  // Covers the cells so a tap anywhere on the row opens the keypad.
  hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0, color: 'transparent' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, marginTop: 12 },
  primaryButton: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  resendRow: { alignItems: 'center', marginTop: 18, minHeight: 20 },
  resendAction: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  resendWait: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  changeRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  changeText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  changeAction: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
