import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEFAULT_COUNTRY, type Country } from '@/constants/countries';
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

/**
 * Registration: full name and phone number with country code.
 * Submitting dispatches a 6-digit OTP code to the phone for verification.
 */
export function RegisterStep({ onBack, onLogin }: Props) {
  const colors = useColors();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone validation based on selected country
  const minPhoneDigits = selectedCountry.nationalDigits ? selectedCountry.nationalDigits - 1 : 7;
  const phoneValid = digits.length >= minPhoneDigits;

  const ready = name.trim().length >= 3 && phoneValid;

  const submit = async () => {
    if (!ready || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const fullPhoneNumber = `${selectedCountry.dialCode}${digits.replace(/^0+/, '')}`;
      await register(name, fullPhoneNumber, undefined, 'CUSTOMER');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.step}>
      <BackButton onPress={onBack} testID="register-back-button" />

      <PageHeading
        eyebrow="Create your account"
        title="Register"
        subtitle="Set up your profile and enter your phone number to get started."
        style={styles.heading}
      />

      {/* Full Name Field */}
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
          placeholder="First and last name"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          autoFocus={Platform.OS !== 'web'}
          style={[styles.nameInput, { color: colors.foreground }]}
        />
      </View>

      {/* Phone Number Field with Country Selector */}
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
        testID="register-phone-input"
      />

      {/* Error Message */}
      {error ? (
        <Text testID="register-error" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      {/* Submit Button */}
      <Button
        label="Continue"
        onPress={submit}
        disabled={!ready}
        loading={isSubmitting}
        testID="register-button"
        style={styles.primaryButton}
      />

      {/* Switch to Login */}
      <Pressable
        accessibilityRole="button"
        testID="go-to-login-button"
        onPress={onLogin}
        hitSlop={8}
        style={styles.switchRow}
      >
        <Text style={[styles.switchText, { color: colors.mutedForeground }]}>Already have an account? </Text>
        <Text style={[styles.switchAction, { color: colors.primary }]}>Login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flex: 1 },
  heading: { marginTop: 14, marginBottom: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 18, marginBottom: 8 },
  nameField: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  nameInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, height: '100%' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 14 },
  primaryButton: { marginTop: 24 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, paddingVertical: 10 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
