import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LoginStep } from '@/components/auth/LoginStep';
import { OtpStep } from '@/components/auth/OtpStep';
import { RegisterStep } from '@/components/auth/RegisterStep';
import { WelcomeStep } from '@/components/auth/WelcomeStep';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Step = 'welcome' | 'register' | 'login';

/**
 * Everything a signed-out customer can do: the welcome screen, registration
 * (full name and number), login (number only) and the code both end in.
 *
 * The steps live in one screen so an abandoned form cannot be reached again
 * through the back stack, and so the pending code — which is what decides the
 * verify step — survives a reload.
 */
export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { verification } = useAuth();
  const [step, setStep] = useState<Step>('welcome');

  // The welcome screen is full-bleed, so it skips the padded scroll container.
  if (!verification && step === 'welcome') {
    return <WelcomeStep onRegister={() => setStep('register')} onLogin={() => setStep('login')} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'web' ? 67 : insets.top + 20,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {verification ? (
          <OtpStep verification={verification} />
        ) : step === 'login' ? (
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
