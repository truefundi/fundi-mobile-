import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NATIONAL_DIGITS, NATIONAL_PREFIX } from '@/constants/auth';
import { PhoneField } from '@/components/auth/PhoneField';
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
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" testID="login-back-button" onPress={onBack} style={styles.backButton}>
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </Pressable>

      <Text style={[styles.eyebrow, { color: colors.primary }]}>WELCOME BACK</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Login</Text>

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Login"
        accessibilityState={{ disabled: !ready || isSending, busy: isSending }}
        testID="login-button"
        onPress={submit}
        disabled={!ready || isSending}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: ready && !isSending ? colors.primary : colors.muted, opacity: pressed ? 0.82 : 1 },
        ]}
      >
        {isSending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryText, { color: ready ? colors.primaryForeground : colors.mutedForeground }]}>Login</Text>
        )}
      </Pressable>

      <Pressable accessibilityRole="button" testID="go-to-register-button" onPress={onRegister} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>New to Fundi? </Text>
        <Text style={[styles.switchAction, { color: colors.primary }]}>Register</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginTop: 18, marginBottom: 7, textAlign: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 22, marginBottom: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, marginTop: 12 },
  primaryButton: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
