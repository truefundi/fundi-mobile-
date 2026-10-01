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
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';

const SCREEN_GUTTER = 20;
const GRID_GAP = 11;

export default function ServicesScreen() {
  const colors = useColors();
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
        contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 18, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeading
          eyebrow={inWork ? 'Your work' : 'Find a Fundi'}
          title={inWork ? 'What you take on' : 'What can we fix?'}
          subtitle={
            inWork
              ? 'Set the work you want and Fundi only sends jobs that fit.'
              : 'Choose a service and tell us what is going on. We will match you with the right technician.'
          }
        />
        {working ? (
          <WorkSettings />
        ) : locked ? (
          <WorkLocked />
        ) : (
          <>
            <View style={styles.grid}>
              {SERVICES.map((service) => (
                <Pressable
                  key={service.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Request ${service.label}`}
                  testID={`services-${service.label}`}
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
                  <View style={styles.linkRow}>
                    <Text style={[styles.link, { color: colors.primary }]}>Request service</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={[styles.helpCard, { backgroundColor: colors.primary }]}>
              <Text style={[styles.helpKicker, { color: colors.secondary }]}>CAN&apos;T FIND IT?</Text>
              <Text style={[styles.helpTitle, { color: colors.primaryForeground }]}>Tell us what you need</Text>
              <Text style={[styles.helpText, { color: colors.secondary }]}>Our general maintenance specialists can help diagnose unusual problems.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a request"
                testID="general-request-button"
                onPress={() => router.push({ pathname: '/request', params: { service: 'General Maintenance' } })}
                style={({ pressed }) => [styles.helpButton, { backgroundColor: colors.primaryForeground, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.helpButtonText, { color: colors.primary }]}>Start a request</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
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
  card: { minHeight: 145, borderRadius: 16, borderWidth: 1, padding: 14, justifyContent: 'space-between' },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 19, marginTop: 13 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  helpCard: { borderRadius: 18, padding: 18, marginTop: 22 },
  helpKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  helpTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 7 },
  helpText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 300 },
  helpButton: { minHeight: 44, borderRadius: 22, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 18, marginTop: 15 },
  helpButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
