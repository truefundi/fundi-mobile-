import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LoginStep } from '@/components/auth/LoginStep';
import { RegisterStep } from '@/components/auth/RegisterStep';
import { WelcomeStep } from '@/components/auth/WelcomeStep';
import { OtpStep } from '@/components/auth/OtpStep';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Step = 'welcome' | 'register' | 'login';

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
        {step === 'login' ? (
          <LoginStep onBack={() => setStep('welcome')} onRegister={() => setStep('register')} />
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
});
