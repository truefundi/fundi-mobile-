import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  onLogin: () => void;
};

/**
 * Registration: full name, phone number with country code, 5-digit PIN, and PIN confirmation.
 */
export function RegisterStep({ onBack, onLogin }: Props) {
  const colors = useColors();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone validation based on selected country
  const minPhoneDigits = selectedCountry.nationalDigits ? selectedCountry.nationalDigits - 1 : 7;
  const phoneValid = digits.length >= minPhoneDigits;

  // PIN validation
  const pinValid = pin.length === PIN_LENGTH;
  const confirmPinValid = confirmPin.length === PIN_LENGTH;
  const pinsMatch = pin === confirmPin;
  const pinMismatch = confirmPin.length === PIN_LENGTH && !pinsMatch;

  const ready = name.trim().length >= 3 && phoneValid && pinValid && confirmPinValid && pinsMatch;

  const submit = async () => {
    if (!ready || isSubmitting) return;

    if (!pinsMatch) {
      setError('PINs do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const fullPhoneNumber = `${selectedCountry.dialCode}${digits.replace(/^0+/, '')}`;
      await register(name, fullPhoneNumber, pin, 'CUSTOMER');
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
        subtitle="Set up your profile and create a secure 5-digit PIN."
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

      {/* 5-Digit Create PIN */}
      <View style={styles.pinSection}>
        <PinField
          value={pin}
          onChange={(val) => {
            setPin(val);
            setError('');
          }}
          label="Create a 5-digit PIN"
          testID="create-pin-input"
        />
      </View>

      {/* 5-Digit Confirm PIN */}
      <View style={styles.pinSection}>
        <PinField
          value={confirmPin}
          onChange={(val) => {
            setConfirmPin(val);
            setError('');
          }}
          label="Confirm your 5-digit PIN"
          error={pinMismatch ? 'PINs do not match' : undefined}
          testID="confirm-pin-input"
        />
      </View>

      {/* Error Message */}
      {error ? (
        <Text testID="register-error" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      {/* Submit Button */}
      <Button
        label="Register"
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
  pinSection: { marginTop: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 12 },
  primaryButton: { marginTop: 22 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, paddingVertical: 10 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
