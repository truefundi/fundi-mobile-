import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModeSlider } from '@/components/ui/ModeSlider';
import { DEFAULT_LOCATION } from '@/constants/profile';
import { useProfile } from '@/context/ProfileContext';
import { useNotifications } from '@/context/NotificationContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The one header every tab carries. Top row: the mode slider ("Slide to work" /
 * "Slide to hire"), the theme toggle and notifications. Second row: greeting on
 * the left, name in the centre, location on the right. It lives outside each
 * screen's scroll view so it never scrolls away.
 */
export function AppHeader() {
  const colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Small phones get slightly smaller side text so "Good afternoon" and the town fit.
  const small = useWindowDimensions().width < 350;
  const { profile: account } = useProfile();
  const { unreadCount } = useNotifications();

  const firstName = account?.name.split(' ')[0] ?? '';

  return (
    <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 4 : insets.top }]}>
      <View style={styles.topRow}>
        <View style={styles.slider}>
          <ModeSlider variant="header" onPressAvatar={() => router.navigate('/profile')} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          testID="home-theme-toggle"
          onPress={() => void toggleTheme()}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name={isDark ? 'sun' : 'moon'} size={18} color={isDark ? '#facc15' : colors.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unreadCount ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
          testID="home-notifications-button"
          onPress={() => router.navigate('/notifications')}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="bell" size={19} color={colors.foreground} />
          {unreadCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Three equal columns, so the name sits on the true centre of the screen. */}
      <View style={[styles.infoRow, small && styles.infoRowSmall]}>
        <Text numberOfLines={1} style={[styles.greetingLabel, styles.colLeft, small && styles.smallGreeting, { color: colors.mutedForeground }]}>
          {greeting()}
        </Text>
        <Text numberOfLines={1} style={[styles.userName, styles.colCenter, { color: colors.foreground }]}>
          {firstName}
        </Text>
        <View style={[styles.colRight, styles.locationRow]}>
          <Ionicons name="location-sharp" size={13} color={colors.primary} />
          <Text numberOfLines={1} style={[styles.location, small && styles.smallLocation, { color: colors.mutedForeground }]}>
            {account?.location ?? DEFAULT_LOCATION}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  colLeft: { flex: 1, textAlign: 'left' },
  colCenter: { flex: 1, textAlign: 'center' },
  colRight: { flex: 1, justifyContent: 'flex-end' },
  infoRowSmall: { gap: 4 },
  smallGreeting: { fontSize: 12 },
  smallLocation: { fontSize: 11 },
  greetingLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  userName: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  location: { fontFamily: 'Inter_400Regular', fontSize: 12, flexShrink: 1 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
});
