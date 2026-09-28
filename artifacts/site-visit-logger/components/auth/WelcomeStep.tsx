import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type Props = {
  onRegister: () => void;
  onLogin: () => void;
};

/**
 * The first screen: a full-bleed portrait, the promise, and the two ways in.
 *
 * The dark wash over the photo is the one gradient in the app. It is not a
 * brand surface — it exists so white text stays readable whatever the image
 * behind it does — and the buttons below it are solid, as the brand requires.
 *
 * The headline breaks across three lines deliberately. "Hire." and "Get hired."
 * are the two sides of the marketplace, and giving each its own line lets a
 * reader take in both before they reach the buttons. The copy stays white
 * throughout, which leaves the Register button as the only orange on screen.
 */
export function WelcomeStep({ onRegister, onLogin }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Image
        source={require('../../assets/images/onboarding.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel="A Fundi technician"
      />
      {/* The stops sit higher than they need to for the buttons alone, so the
          headline also lands on near-solid black whatever the photo does. */}
      <LinearGradient
        colors={['rgba(9,9,11,0.05)', 'rgba(9,9,11,0.35)', 'rgba(9,9,11,0.82)', 'rgba(9,9,11,0.96)']}
        locations={[0, 0.32, 0.62, 0.85]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.bottom, { paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 28 }]}>
        {/* One Text node rather than three, so assistive tech reads the whole
            promise as a single heading instead of three loose fragments. */}
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.headline}>
            Hire.{'\n'}Get hired.{'\n'}Using Fundi.
          </Text>
          <Text style={styles.subline}>Book someone you can trust, or earn from the skills you already have.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Register"
            testID="welcome-register-button"
            onPress={onRegister}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Register</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Login"
            testID="welcome-login-button"
            onPress={onLogin}
            style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={styles.secondaryText}>Login</Text>
          </Pressable>
          <Text style={styles.legal}>By continuing you agree to Fundi's Terms & Privacy.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090b', justifyContent: 'flex-end' },
  bottom: { paddingHorizontal: 20 },
  copy: { marginBottom: 26 },
  // 40pt sits a full step above the 29pt title used on the inner auth steps —
  // this is the hero, and those screens are secondary to it.
  headline: { fontFamily: 'Inter_700Bold', fontSize: 40, lineHeight: 44, letterSpacing: -1.1, color: '#ffffff' },
  subline: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.80)', marginTop: 12, maxWidth: 320 },
  actions: { gap: 11 },
  primaryButton: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  // Translucent rather than solid, so the photo still reads through the second action.
  secondaryButton: {
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#ffffff' },
  legal: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', color: 'rgba(255,255,255,0.72)', marginTop: 7 },
});
