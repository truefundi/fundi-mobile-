import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useWork } from '@/context/WorkContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

/**
 * Two tabs mean different things depending on the mode, so they say different
 * things. The routes never change: each screen already branches on the mode,
 * and swapping routes at runtime is how expo-router navigation breaks.
 *
 * Both layouts list the tabs in the same order.
 */
type TabSpec = {
  name: 'index' | 'services' | 'chat' | 'activity' | 'profile';
  title: string;
  sf: SFSymbol;
  sfSelected: SFSymbol;
  feather: React.ComponentProps<typeof Feather>['name'];
};

function useTabSpecs(): TabSpec[] {
  const { mode } = useWork();
  const working = mode === 'working';
  return [
    { name: 'index', title: 'Home', sf: 'house', sfSelected: 'house.fill', feather: 'home' },
    working
      ? { name: 'services', title: 'Work', sf: 'slider.horizontal.3', sfSelected: 'slider.horizontal.3', feather: 'sliders' }
      : { name: 'services', title: 'Services', sf: 'wrench.and.screwdriver', sfSelected: 'wrench.and.screwdriver.fill', feather: 'tool' },
    {
      name: 'chat',
      title: 'Chats',
      sf: 'bubble.left.and.bubble.right',
      sfSelected: 'bubble.left.and.bubble.right.fill',
      feather: 'message-square',
    },
    working
      ? { name: 'activity', title: 'Jobs', sf: 'briefcase', sfSelected: 'briefcase.fill', feather: 'briefcase' }
      : { name: 'activity', title: 'Activity', sf: 'clock', sfSelected: 'clock.fill', feather: 'clock' },
    { name: 'profile', title: 'Profile', sf: 'person', sfSelected: 'person.fill', feather: 'user' },
  ];
}

/**
 * iOS 26+: the system tab bar with liquid glass. iOS draws the glass itself;
 * the app only sets the brand tint for the selected tab.
 */
function NativeTabLayout() {
  const colors = useColors();
  const tabs = useTabSpecs();

  return (
    <NativeTabs
      tintColor={colors.primary}
      iconColor={{ default: colors.mutedForeground, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.mutedForeground },
        selected: { color: colors.primary },
      }}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={{ default: tab.sf, selected: tab.sfSelected }} />
          <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

/** Older iOS, Android and web: a JS tab bar in the app's own colours. */
function ClassicTabLayout() {
  const colors = useColors();
  const { isDark } = useTheme();
  const tabs = useTabSpecs();

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: isWeb ? styles.webItem : styles.item,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          // Native heights come from the safe area (home indicator included);
          // only web needs a fixed one.
          ...(isWeb ? { height: 68, paddingBottom: 10, paddingTop: 6 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, focused }) =>
              isIOS ? (
                <SymbolView name={focused ? tab.sfSelected : tab.sf} tintColor={color} size={23} />
              ) : (
                <Feather name={tab.feather} size={21} color={color as string} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.1 },
  item: { paddingTop: 4 },
  webItem: { gap: 2 },
});
