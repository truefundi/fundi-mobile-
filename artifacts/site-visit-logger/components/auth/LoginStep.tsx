import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NATIONAL_DIGITS, NATIONAL_PREFIX } from '@/constants/auth';
import { PhoneField } from '@/components/auth/PhoneField';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Props = {
  onBack: () => void;
  onRegister: () => void;
};

/** Signing back in needs the registered number and nothing else — no code. */
export function LoginStep({ onBack, onRegister }: Props) {
  const colors = useColors();
  const { login } = useAuth();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const ready = digits.length === NATIONAL_DIGITS && digits.startsWith(NATIONAL_PREFIX);
  const phoneStarted = digits.length > 0;

  const submit = async () => {
    if (!ready || isSending) return;
    setIsSending(true);
    setError('');
    try {
      await login(digits);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We could not send your code. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.step}>
      <BackButton onPress={onBack} testID="login-back-button" />

      <PageHeading eyebrow="Welcome back" title="Login" subtitle="Enter the number you registered with." style={styles.heading} />

      <Text style={[styles.label, { color: colors.foreground }]}>Phone number</Text>
      <PhoneField
        value={digits}
        onChange={(value) => {
          setDigits(value);
          setError('');
        }}
        onSubmit={submit}
        placeholder="7XX XXX XXX"
        invalid={!!error || (phoneStarted && !digits.startsWith(NATIONAL_PREFIX))}
        autoFocus
        testID="login-phone-input"
      />

      {error ? <Text testID="login-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <Button label="Login" onPress={submit} disabled={!ready} loading={isSending} testID="login-button" style={styles.primaryButton} />

      <Pressable accessibilityRole="button" testID="go-to-register-button" onPress={onRegister} hitSlop={8} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>New to Fundi? </Text>
        <Text style={[styles.switchAction, { color: colors.primary }]}>Register</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  heading: { marginTop: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 24, marginBottom: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 12 },
  primaryButton: { marginTop: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, paddingVertical: 6 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
