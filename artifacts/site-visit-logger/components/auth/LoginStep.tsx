import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_COUNTRY, type Country } from '@/constants/countries';
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

/**
 * Login step: Enter registered phone number to receive a 6-digit OTP code from the backend.
 */
export function LoginStep({ onBack, onRegister }: Props) {
  const colors = useColors();
  const { login } = useAuth();

  const [digits, setDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const minPhoneDigits = selectedCountry.nationalDigits ? selectedCountry.nationalDigits - 1 : 7;
  const phoneValid = digits.length >= minPhoneDigits;
  const ready = phoneValid;

  const submit = async () => {
    if (!ready || isLoggingIn) return;
    setIsLoggingIn(true);
    setError('');

    try {
      const fullPhoneNumber = `${selectedCountry.dialCode}${digits.replace(/^0+/, '')}`;
      await login(fullPhoneNumber);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Login failed. Please check your phone number.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <View style={styles.step}>
      <BackButton onPress={onBack} testID="login-back-button" />

      <PageHeading
        eyebrow="Welcome back"
        title="Sign in"
        subtitle="Enter your phone number to receive a 6-digit verification code."
        style={styles.heading}
      />

      {/* Phone Number Field */}
      <Text style={[styles.label, { color: colors.foreground }]}>Phone number</Text>
      <PhoneField
        value={digits}
        onChange={(value) => {
          setDigits(value);
          setError('');
        }}
        selectedCountry={selectedCountry}
        onCountryChange={(country) => {
          setSelectedCountry(country);
          setError('');
        }}
        placeholder="7XX XXX XXX"
        testID="login-phone-input"
        autoFocus
      />

      {/* Error Output */}
      {error ? (
        <Text testID="login-error" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      {/* Submit Button */}
      <Button
        label="Send code"
        onPress={submit}
        disabled={!ready}
        loading={isLoggingIn}
        testID="login-button"
        style={styles.primaryButton}
      />

      {/* Switch to Register */}
      <Pressable
        accessibilityRole="button"
        testID="go-to-register-button"
        onPress={onRegister}
        hitSlop={8}
        style={styles.switchRow}
      >
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>New to Fundi? </Text>
        <Text style={[styles.switchAction, { color: colors.primary }]}>Register</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  heading: { marginTop: 14, marginBottom: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 20, marginBottom: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 14 },
  primaryButton: { marginTop: 24 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, paddingVertical: 10 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
