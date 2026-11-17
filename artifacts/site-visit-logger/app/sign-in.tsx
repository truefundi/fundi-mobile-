import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LoginStep } from '@/components/auth/LoginStep';
import { RegisterStep } from '@/components/auth/RegisterStep';
import { WelcomeStep } from '@/components/auth/WelcomeStep';
import { OtpStep } from '@/components/auth/OtpStep';
import { PinResetFlow } from '@/components/auth/PinResetFlow';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeading } from '@/components/ui/PageHeading';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Step = 'welcome' | 'register' | 'login' | 'reset';

/**
 * Sign In Screen: Welcome, Real Backend Registration & Login with 6-digit OTP confirmation.
 */
export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { verification } = useAuth();
  const [step, setStep] = useState<Step>('welcome');

  // If a phone verification is underway, display the OTP confirmation step
  if (verification) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Platform.OS === 'web' ? 24 : insets.top + 20,
              paddingBottom: Platform.OS === 'web' ? 36 : insets.bottom + 28,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <OtpStep verification={verification} />
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  // The welcome screen is full-bleed, so it skips the padded scroll container.
  if (step === 'welcome') {
    return <WelcomeStep onRegister={() => setStep('register')} onLogin={() => setStep('login')} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'web' ? 24 : insets.top + 20,
            paddingBottom: Platform.OS === 'web' ? 36 : insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {step === 'reset' ? (
          <View style={styles.step}>
            <BackButton onPress={() => setStep('login')} testID="reset-back-button" />
            <PageHeading
              eyebrow="Forgot your PIN?"
              title="Reset your PIN"
              subtitle="We'll text a code to your phone. Enter it with a new PIN and you're signed in."
              style={styles.heading}
            />
            {/* Signing in sends the app on to home, so there is nothing more to do here. */}
            <PinResetFlow onDone={() => undefined} />
          </View>
        ) : step === 'login' ? (
          <LoginStep
            onBack={() => setStep('welcome')}
            onRegister={() => setStep('register')}
            onForgotPin={() => setStep('reset')}
          />
        ) : (
          <RegisterStep onBack={() => setStep('welcome')} onLogin={() => setStep('login')} />
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, flexGrow: 1 },
  step: { flex: 1 },
  heading: { marginTop: 14, marginBottom: 8 },
});
