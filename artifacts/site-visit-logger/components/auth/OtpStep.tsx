import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPhone, OTP_LENGTH, RESEND_AFTER_MS } from '@/constants/auth';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
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
  const canResend = remainingSeconds === 0;

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
      <BackButton onPress={cancelVerification} testID="verify-back-button" />

      <PageHeading
        eyebrow={verification.intent === 'login' ? 'Welcome back' : 'Step 2 of 2'}
        title={verification.intent === 'login' ? 'Confirm it is you' : 'Verify your number'}
        subtitle={`Enter the ${OTP_LENGTH}-digit code we sent to`}
        style={styles.heading}
      />
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

      <Button
        label="Verify"
        onPress={() => submit(code)}
        disabled={code.length !== OTP_LENGTH}
        loading={isVerifying}
        testID="verify-code-button"
        style={styles.primaryButton}
      />

      <View style={styles.resendRow}>
        {canResend ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Send a new code" testID="resend-code-button" onPress={resend} disabled={isResending} hitSlop={10}>
            <Text style={[styles.resendAction, { color: colors.primary }]}>{isResending ? 'Sending…' : 'Send a new code'}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.resendWait, { color: colors.mutedForeground }]}>You can ask for a new code in {remainingSeconds}s</Text>
        )}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Use another number" testID="use-another-number-button" onPress={cancelVerification} hitSlop={8} style={styles.changeRow}>
        <Text style={[styles.changeText, { color: colors.mutedForeground }]}>Wrong number? </Text>
        <Text style={[styles.changeAction, { color: colors.primary }]}>Use another one</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  heading: { marginTop: 14 },
  phone: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 4 },
  cellRow: { flexDirection: 'row', gap: 10, marginTop: 26 },
  // Cells share the row width, so a 320pt phone still fits all of them.
  cell: { flex: 1, height: 62, maxWidth: 72, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: 'Inter_700Bold', fontSize: 26 },
  // Covers the cells so a tap anywhere on the row opens the keypad.
  hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0, color: 'transparent' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 12 },
  primaryButton: { marginTop: 20 },
  resendRow: { alignItems: 'center', marginTop: 18, minHeight: 20 },
  resendAction: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  resendWait: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  changeRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14, paddingVertical: 6 },
  changeText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  changeAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
