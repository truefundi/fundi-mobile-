import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkSettings } from '@/components/work/WorkSettings';
import { WorkLocked } from '@/components/work/WorkLocked';
import { AppHeader } from '@/components/ui/AppHeader';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

const services = [
  ['Car & Garage', 'car-outline'],
  ['Electrical', 'flash-outline'],
  ['Plumbing', 'pipe-wrench'],
  ['HVAC', 'snowflake'],
  ['Home Repair', 'home-outline'],
  ['Appliance Repair', 'washing-machine'],
  ['Truck & Mechanical', 'truck-outline'],
  ['General Maintenance', 'tools'],
] as const;

export default function ServicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>{inWork ? 'YOUR WORK' : 'FIND A FUNDI'}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{inWork ? 'What you take on' : 'What can we fix?'}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {inWork
          ? 'Set the work you want and Fundi only sends jobs that fit.'
          : 'Choose a service and tell us what is going on. We will match you with the right technician.'}
      </Text>
      {working ? (
        <WorkSettings />
      ) : locked ? (
        <WorkLocked />
      ) : (
        <>
      <View style={styles.grid}>
        {services.map(([label, icon]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Request ${label}`}
            testID={`services-${label}`}
            onPress={() => router.push({ pathname: '/request', params: { service: label } })}
            style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
          >
            <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
              <MaterialCommunityIcons name={icon} size={27} color={colors.primary} />
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
            <Text style={[styles.link, { color: colors.primary }]}>Request service</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.helpCard, { backgroundColor: colors.primary }]}>
        <Text style={[styles.helpKicker, { color: colors.secondary }]}>CAN'T FIND IT?</Text>
        <Text style={[styles.helpTitle, { color: colors.primaryForeground }]}>Tell us what you need</Text>
        <Text style={[styles.helpText, { color: colors.secondary }]}>Our general maintenance specialists can help diagnose unusual problems.</Text>
        <Pressable
          accessibilityRole="button"
          testID="general-request-button"
          onPress={() => router.push({ pathname: '/request', params: { service: 'General Maintenance' } })}
          style={({ pressed }) => [styles.helpButton, { backgroundColor: colors.primaryForeground, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.helpButtonText, { color: colors.primary }]}>Start a request</Text>
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
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9, maxWidth: 350 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 24 },
  card: { width: '48.2%', minHeight: 145, borderRadius: 16, borderWidth: 1, padding: 14, justifyContent: 'space-between' },
  icon: { width: 49, height: 49, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 18, marginTop: 13 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 12 },
  helpCard: { borderRadius: 17, padding: 18, marginTop: 22 },
  helpKicker: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4 },
  helpTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 7 },
  helpText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 290 },
  helpButton: { minHeight: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 15, marginTop: 15 },
  helpButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});