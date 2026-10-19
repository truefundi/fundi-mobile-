import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PIN_LENGTH } from '@/constants/auth';
import { DEFAULT_COUNTRY, type Country } from '@/constants/countries';
import { PhoneField } from '@/components/auth/PhoneField';
import { PinField } from '@/components/auth/PinField';
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
 * Login step: Enter registered phone number and 5-digit PIN.
 */
export function LoginStep({ onBack, onRegister }: Props) {
  const colors = useColors();
  const { login } = useAuth();

  const [digits, setDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const minPhoneDigits = selectedCountry.nationalDigits ? selectedCountry.nationalDigits - 1 : 7;
  const phoneValid = digits.length >= minPhoneDigits;
  const pinValid = pin.length === PIN_LENGTH;
  const ready = phoneValid && pinValid;

  const submit = async () => {
    if (!ready || isLoggingIn) return;
    setIsLoggingIn(true);
    setError('');

    try {
      const fullPhoneNumber = `${selectedCountry.dialCode}${digits.replace(/^0+/, '')}`;
      await login(fullPhoneNumber, pin);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <View style={styles.step}>
      <BackButton onPress={onBack} testID="login-back-button" />

      <PageHeading
        eyebrow="Welcome back"
        title="Login"
        subtitle="Enter your phone number and 5-digit PIN to sign in."
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
        placeholder={selectedCountry.sampleNumber}
        testID="login-phone-input"
        autoFocus
      />

      {/* 5-Digit PIN Input */}
      <View style={styles.pinSection}>
        <PinField
          value={pin}
          onChange={(val) => {
            setPin(val);
            setError('');
          }}
          label="Enter your 5-digit PIN"
          testID="login-pin-input"
        />
      </View>

      {/* Error Output */}
      {error ? (
        <Text testID="login-error" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      {/* Submit Button */}
      <Button
        label="Login"
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
  pinSection: { marginTop: 16 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 12 },
  primaryButton: { marginTop: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, paddingVertical: 10 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
