import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
/**
 * Two tabs mean different things depending on the role, so they say different
 * things. The routes never change — each screen already branches on the role,
 * and swapping routes at runtime is how expo-router navigation breaks.
 */
function NativeTabLayout() {
  const { mode } = useWork();
  const working = mode === 'working';

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="services">
        <Icon
          sf={
            working
              ? { default: 'slider.horizontal.3', selected: 'slider.horizontal.3' }
              : { default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }
          }
        />
        <Label>{working ? 'Work' : 'Services'}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <Icon sf={working ? { default: 'briefcase', selected: 'briefcase.fill' } : { default: 'clock', selected: 'clock.fill' }} />
        <Label>{working ? 'Jobs' : 'Activity'}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { mode } = useWork();
  const working = mode === 'working';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: working ? 'Work' : 'Services',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name={working ? 'slider.horizontal.3' : 'wrench.and.screwdriver'} tintColor={color} size={24} />
            ) : (
              <Feather name={working ? 'sliders' : 'tool'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: working ? 'Jobs' : 'Activity',
          tabBarIcon: ({ color }) => <Feather name={working ? 'briefcase' : 'clock'} size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
