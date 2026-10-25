import React, { useEffect } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { FundiProvider } from '@/context/FundiContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { WorkProvider } from '@/context/WorkContext';
import { configureApi, checkApiHealth } from '@/lib/api';
import { ChatProvider } from '@/context/ChatContext';
import { NotificationProvider } from '@/context/NotificationContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function StartupLoader() {
  const progress = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.startup} accessibilityLabel="Loading Truefundi" accessibilityRole="progressbar">
      <Image
        source={require('../assets/images/fundilogo-transparent.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressBall,
            {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-14, 14],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * The whole app sits behind the account session: the guards below decide
 * which half of the stack exists, so a signed-out customer cannot reach a job
 * screen and signing out drops straight back to sign-in.
 */
function RootLayoutNav() {
  const { account, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated) SplashScreen.hideAsync();
  }, [isHydrated]);

  // Nothing is routed until we know whether there is a session to restore.
  if (!isHydrated) return <StartupLoader />;

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Protected guard={!account}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!account}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="select-technician" options={{ headerShown: false }} />
        {/* Every screen below draws its own back control, so the stack header is off. */}
        <Stack.Screen name="request" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="invoice/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="rate/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="payments" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="saved-locations" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
        <Stack.Screen name="chatbot" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  startup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  logo: {
    width: 128,
    height: 128,
  },
  progressTrack: {
    width: 44,
    height: 12,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBall: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#f97316',
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    configureApi();
    void checkApiHealth().catch(() => undefined);
  }, []);

  if (!fontsLoaded && !fontError) return <StartupLoader />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <ProfileProvider>
                <FundiProvider>
                  <WorkProvider>
                    <ChatProvider>
                      <GestureHandlerRootView>
                        <KeyboardProvider>
                          <RootLayoutNav />
                        </KeyboardProvider>
                      </GestureHandlerRootView>
                    </ChatProvider>
                  </WorkProvider>
                </FundiProvider>
              </ProfileProvider>
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
