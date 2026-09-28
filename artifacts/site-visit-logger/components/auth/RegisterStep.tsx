import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NATIONAL_DIGITS, NATIONAL_PREFIX } from '@/constants/auth';
import { PhoneField } from '@/components/auth/PhoneField';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Props = {
  onBack: () => void;
  onLogin: () => void;
};

/** Registration: full name and a Rwandan mobile number, nothing else. */
export function RegisterStep({ onBack, onLogin }: Props) {
  const colors = useColors();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  // The country code is fixed, so the rule left to meet is 7XX XXX XXX.
  const phoneReady = digits.length === NATIONAL_DIGITS && digits.startsWith(NATIONAL_PREFIX);
  const ready = name.trim().length > 0 && phoneReady;
  const phoneStarted = digits.length > 0;

  const submit = async () => {
    if (isSending) return;
    setIsSending(true);
    setError('');
    try {
      await register(name, digits);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We could not send your code. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.step}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" testID="register-back-button" onPress={onBack} style={styles.backButton}>
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </Pressable>

      <Text style={[styles.eyebrow, { color: colors.primary }]}>CREATE YOUR ACCOUNT</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Register</Text>

      <Text style={[styles.label, { color: colors.foreground }]}>Full name</Text>
      <View style={[styles.nameField, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="person-outline" size={20} color={colors.primary} />
        <TextInput
          accessibilityLabel="Full name"
          testID="name-input"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError('');
          }}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          autoFocus={Platform.OS !== 'web'}
          style={[styles.nameInput, { color: colors.foreground }]}
        />
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>Phone number</Text>
      {/* The mask carries the format now that the written rule below is gone. */}
      <PhoneField
        value={digits}
        onChange={(value) => {
          setDigits(value);
          setError('');
        }}
        onSubmit={submit}
        placeholder="7XX XXX XXX"
        invalid={!!error || (phoneStarted && !digits.startsWith(NATIONAL_PREFIX))}
      />

      {error ? <Text testID="register-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Register"
        accessibilityState={{ disabled: !ready || isSending, busy: isSending }}
        testID="register-button"
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
          <Text style={[styles.primaryText, { color: ready ? colors.primaryForeground : colors.mutedForeground }]}>Register</Text>
        )}
      </Pressable>

      <Pressable accessibilityRole="button" testID="go-to-login-button" onPress={onLogin} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>Already have an account? </Text>
        <Text style={[styles.switchAction, { color: colors.primary }]}>Login</Text>
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
  nameField: { minHeight: 62, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  nameInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, height: '100%' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, marginTop: 12 },
  primaryButton: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
