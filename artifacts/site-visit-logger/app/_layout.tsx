import React, { useEffect } from 'react';
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
import { WorkProvider } from '@/context/WorkContext';
import { configureApi, checkApiHealth } from '@/lib/api';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
  if (!isHydrated) return null;

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Protected guard={!account}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!account}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Every screen below draws its own back control, so the stack header is off. */}
        <Stack.Screen name="request" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="invoice/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="rate/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="payments" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

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

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FundiProvider>
              <WorkProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </WorkProvider>
            </FundiProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
