import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModeSlider } from '@/components/ui/ModeSlider';
import { DEFAULT_LOCATION } from '@/constants/profile';
import { isClosed } from '@/constants/jobs';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';
import { useColors } from '@/hooks/useColors';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The one header every tab carries: role switch, who you are, notifications.
 *
 * It lives outside each screen's scroll view so it never scrolls away, and it
 * is one component rather than four copies — the flank widths have to match
 * exactly for the greeting to sit on the true centre, and that is precisely
 * the kind of detail that drifts when it is duplicated.
 */
export function AppHeader() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  const { jobs } = useFundi();

  const firstName = account?.name.split(' ')[0] ?? '';
  const hasActiveJob = useMemo(() => jobs.some((job) => !isClosed(job.status)), [jobs]);

  return (
    <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.row}>
        <ModeSlider compact onPressAvatar={() => router.navigate('/profile')} />

        {/* Both flanks are 104pt wide, so flex:1 lands the greeting on the true
            centre of the row rather than merely between the two. */}
        <View style={styles.center}>
          <Text style={[styles.greetingLabel, { color: colors.mutedForeground }]}>{greeting()}</Text>
          <Text numberOfLines={1} style={[styles.userName, { color: colors.foreground }]}>{firstName}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={13} color={colors.primary} />
            <Text numberOfLines={1} style={[styles.location, { color: colors.mutedForeground }]}>
              {account?.location ?? DEFAULT_LOCATION}
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            testID="home-notifications-button"
            onPress={() => router.navigate('/notifications')}
            style={({ pressed }) => [styles.bellButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="bell" size={20} color={colors.foreground} />
            {hasActiveJob ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  right: { width: 104, alignItems: 'flex-end' },
  greetingLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  userName: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.4, marginTop: 1, maxWidth: '100%' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  location: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  bellButton: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dot: { width: 7, height: 7, borderRadius: 4, position: 'absolute', top: 9, right: 10 },
});
