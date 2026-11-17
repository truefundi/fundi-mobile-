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
  /** Opens the forgotten-PIN reset. */
  onForgotPin: () => void;
};

type LoginMode = 'pin' | 'otp';

/**
 * Login step: Supports fast PIN authentication as well as SMS OTP login fallback.
 */
export function LoginStep({ onBack, onRegister, onForgotPin }: Props) {
  const colors = useColors();
  const { login, loginWithOtp } = useAuth();

  const [mode, setMode] = useState<LoginMode>('pin');
  const [digits, setDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const minPhoneDigits = selectedCountry.nationalDigits ? selectedCountry.nationalDigits - 1 : 7;
  const phoneValid = digits.length >= minPhoneDigits;
  const pinValid = pin.length === PIN_LENGTH;
  const ready = mode === 'pin' ? phoneValid && pinValid : phoneValid;

  const submit = async () => {
    if (!ready || isLoggingIn) return;
    setIsLoggingIn(true);
    setError('');

    try {
      const fullPhoneNumber = `${selectedCountry.dialCode}${digits.replace(/^0+/, '')}`;
      if (mode === 'pin') {
        await login(fullPhoneNumber, pin);
      } else {
        await loginWithOtp(fullPhoneNumber);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Sign in failed. Please check your credentials.');
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
        subtitle={
          mode === 'pin'
            ? 'Enter your phone number and 5-digit PIN to sign in.'
            : 'Enter your phone number to receive a 6-digit verification code.'
        }
        style={styles.heading}
      />

      {/* Mode Selector Pill */}
      <View style={[styles.modeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode('pin');
            setError('');
          }}
          style={[
            styles.modeButton,
            mode === 'pin' && { backgroundColor: colors.primary },
          ]}
        >
          <Text
            style={[
              styles.modeButtonText,
              { color: mode === 'pin' ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            PIN Sign In
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode('otp');
            setError('');
          }}
          style={[
            styles.modeButton,
            mode === 'otp' && { backgroundColor: colors.primary },
          ]}
        >
          <Text
            style={[
              styles.modeButtonText,
              { color: mode === 'otp' ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            SMS Code
          </Text>
        </Pressable>
      </View>

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
        placeholder={selectedCountry.sampleNumber ?? '7XX XXX XXX'}
        testID="login-phone-input"
        autoFocus
      />

      {/* PIN Field (shown only in PIN mode) */}
      {mode === 'pin' ? (
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
      ) : null}

      {/* Error Output */}
      {error ? (
        <Text testID="login-error" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      {/* Submit Button */}
      <Button
        label={mode === 'pin' ? 'Sign in' : 'Send code'}
        onPress={submit}
        disabled={!ready}
        loading={isLoggingIn}
        testID="login-button"
        style={styles.primaryButton}
      />

      {/* Secondary Mode Switch */}
      {mode === 'pin' ? (
        <Pressable
          accessibilityRole="button"
          testID="login-forgot-pin"
          onPress={onForgotPin}
          hitSlop={8}
          style={styles.otpFallbackRow}
        >
          <Text style={[styles.otpFallbackText, { color: colors.primary }]}>Forgot PIN? Reset it</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode('pin');
            setError('');
          }}
          hitSlop={8}
          style={styles.otpFallbackRow}
        >
          <Text style={[styles.otpFallbackText, { color: colors.primary }]}>
            Sign in with PIN instead
          </Text>
        </Pressable>
      )}

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
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginTop: 6,
    marginBottom: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 18, marginBottom: 8 },
  pinSection: { marginTop: 14 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 14 },
  primaryButton: { marginTop: 22 },
  otpFallbackRow: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  otpFallbackText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, paddingVertical: 10 },
  switchText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  switchAction: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
