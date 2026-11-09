import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WorkSettings } from '@/components/work/WorkSettings';
import { WorkLocked } from '@/components/work/WorkLocked';
import { AppHeader } from '@/components/ui/AppHeader';
import { PageHeading } from '@/components/ui/PageHeading';
import { SERVICES } from '@/constants/services';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';

const SCREEN_GUTTER = 20;
const GRID_GAP = 11;

export default function ServicesScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const bottomPadding = useTabScreenPadding();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Two columns on every phone, sized from the real width so the gap never
  // pushes the second card onto its own row.
  const cardWidth = Math.floor((width - SCREEN_GUTTER * 2 - GRID_GAP) / 2);
  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {locked ? (
          <WorkLocked />
        ) : working ? (
          <WorkSettings />
        ) : (
          <>
            <PageHeading
              title={inWork ? 'Your trades' : 'All services'}
              subtitle={
                inWork
                  ? 'The work you are cleared to take requests for.'
                  : 'Upfront prices, verified local technicians and a 30-day warranty.'
              }
            />
            <View style={styles.grid}>
              {SERVICES.map((service) => (
                <Pressable
                  key={service.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${service.label}, request service`}
                  testID={`service-card-${service.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onPress={() => router.push({ pathname: '/request', params: { service: service.label } })}
                  style={({ pressed }) => [
                    styles.card,
                    { width: cardWidth, backgroundColor: colors.card, borderColor: pressed ? colors.primary : colors.border },
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
                    <MaterialCommunityIcons name={service.icon} size={27} color={colors.primary} />
                  </View>
                  <Text style={[styles.label, { color: colors.foreground }]}>{service.label}</Text>
                  {/* The arrow sits inside the text, held to "service" by a no-break
                      space, so on narrow cards it wraps with the word, not alone. */}
                  <Text style={[styles.link, { color: colors.primary }]}>
                    {'Request service '}
                    <Ionicons name="arrow-forward" size={13} color={colors.primary} />
                  </Text>
                </Pressable>
              ))}
            </View>
            <View
              style={[
                styles.helpCard,
                {
                  backgroundColor: isDark ? colors.card : colors.primary,
                  borderWidth: isDark ? 1.5 : 0,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.helpKicker, { color: isDark ? colors.primary : colors.secondary }]}>CAN&apos;T FIND IT?</Text>
              <Text style={[styles.helpTitle, { color: isDark ? colors.foreground : colors.primaryForeground }]}>Tell us what you need</Text>
              <Text style={[styles.helpText, { color: isDark ? colors.mutedForeground : colors.secondary }]}>
                Our general maintenance specialists can help diagnose unusual problems.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a request"
                testID="general-request-button"
                onPress={() => router.push({ pathname: '/request', params: { service: 'General Maintenance' } })}
                style={({ pressed }) => [
                  styles.helpButton,
                  {
                    backgroundColor: isDark ? colors.primary : colors.primaryForeground,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.helpButtonText, { color: isDark ? colors.primaryForeground : colors.primary }]}>Start a request</Text>
                <Ionicons name="arrow-forward" size={16} color={isDark ? colors.primaryForeground : colors.primary} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginTop: 22 },
  card: { minHeight: 145, borderRadius: 16, borderWidth: 1, padding: 13, justifyContent: 'space-between' },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 19, marginTop: 13 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, marginTop: 10 },
  helpCard: { borderRadius: 18, padding: 18, marginTop: 22 },
  helpKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  helpTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 7 },
  helpText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  helpButton: { minHeight: 44, borderRadius: 22, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 18, marginTop: 15 },
  helpButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
