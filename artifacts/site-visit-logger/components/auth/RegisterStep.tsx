import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NATIONAL_DIGITS, NATIONAL_PREFIX } from '@/constants/auth';
import { PhoneField } from '@/components/auth/PhoneField';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
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
      <BackButton onPress={onBack} testID="register-back-button" />

      <PageHeading
        eyebrow="Step 1 of 2 · Create your account"
        title="Register"
        subtitle="We will text a code to your number to confirm it."
        style={styles.heading}
      />

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
          placeholder="Your first and last name"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
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

      <Button label="Register" onPress={submit} disabled={!ready} loading={isSending} testID="register-button" style={styles.primaryButton} />

      <Pressable accessibilityRole="button" testID="go-to-login-button" onPress={onLogin} hitSlop={8} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>Already have an account? </Text>
        <Text style={[styles.switchAction, { color: colors.primary }]}>Login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  heading: { marginTop: 14 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 22, marginBottom: 8 },
  nameField: { minHeight: 62, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  nameInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, height: '100%' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 12 },
  primaryButton: { marginTop: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, paddingVertical: 6 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
