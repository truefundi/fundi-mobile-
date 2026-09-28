import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney, isClosed, repairTotal } from '@/constants/jobs';
import { DEFAULT_LOCATION } from '@/constants/profile';
import { AppHeader } from '@/components/ui/AppHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { WorkHome } from '@/components/work/WorkHome';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';

const categories = [
  { label: 'Car & Garage', icon: 'car-outline', color: 'blue' },
  { label: 'Electrical', icon: 'flash-outline', color: 'yellow' },
  { label: 'Plumbing', icon: 'pipe-wrench', color: 'teal' },
  { label: 'HVAC', icon: 'snowflake', color: 'sky' },
  { label: 'Home Repair', icon: 'home-outline', color: 'purple' },
  { label: 'Appliance Repair', icon: 'washing-machine', color: 'rose' },
  { label: 'Truck & Mechanical', icon: 'truck-outline', color: 'green' },
  { label: 'General Maintenance', icon: 'tools', color: 'orange' },
] as const;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jobs } = useFundi();
  const { account } = useAuth();
  const { mode, status } = useWork();
  // Only a verified worker has a job list to search.
  const searchingJobs = mode === 'working' && status === 'verified';
  const [jobQuery, setJobQuery] = useState('');

  const { activeJob, recent } = useMemo(() => {
    const open = jobs.filter((job) => !isClosed(job.status));
    return {
      activeJob: open[0],
      recent: jobs.filter((job) => job.status === 'COMPLETED').slice(0, 3),
    };
  }, [jobs]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />

      <ScrollView
        contentContainerStyle={[styles.safeArea, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {searchingJobs ? (
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={19} color={colors.mutedForeground} />
            <TextInput
              accessibilityLabel="Search jobs"
              testID="home-job-search-input"
              value={jobQuery}
              onChangeText={setJobQuery}
              placeholder="Search jobs near you"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find a technician"
            testID="home-search-button"
            onPress={() => router.navigate('/services')}
            style={({ pressed }) => [styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="search" size={19} color={colors.mutedForeground} />
            <Text style={[styles.searchText, { color: colors.mutedForeground }]}>Find a technician</Text>
            <View style={[styles.searchFilter, { backgroundColor: colors.secondary }]}>
              <Feather name="sliders" size={16} color={colors.primary} />
            </View>
          </Pressable>
        )}
        {mode === 'working' ? (
          <WorkHome query={jobQuery} />
        ) : (
          <>

        {activeJob ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open your ${activeJob.service} job`}
            testID="home-active-job-button"
            onPress={() => router.push(`/job/${activeJob.id}`)}
            style={({ pressed }) => [styles.activeCard, { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={styles.activeCopy}>
              <Text style={[styles.activeKicker, { color: colors.primary }]}>JOB IN PROGRESS</Text>
              <Text style={[styles.activeTitle, { color: colors.foreground }]} numberOfLines={1}>{activeJob.service}</Text>
              <View style={styles.activeBadgeRow}>
                <StatusBadge status={activeJob.status} />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
        <View style={[styles.emergency, { backgroundColor: colors.primary }]}>
          <View style={styles.emergencyCopy}>
            <Text style={[styles.emergencyKicker, { color: colors.secondary }]}>NEED HELP NOW?</Text>
            <Text style={[styles.emergencyTitle, { color: colors.primaryForeground }]}>Emergency service</Text>
            <Text style={[styles.emergencyText, { color: colors.secondary }]}>Find an available technician near you.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Request emergency service"
            testID="emergency-service-button"
            onPress={() => router.push({ pathname: '/request', params: { service: 'Emergency Service', emergency: 'true' } })}
            style={({ pressed }) => [styles.emergencyButton, { backgroundColor: colors.primaryForeground, opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What service do you need?</Text>
          <Pressable onPress={() => router.navigate('/services')} testID="see-all-services-button">
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>
        <View style={styles.categoryGrid}>
          {categories.slice(0, 6).map((category) => (
            <Pressable
              key={category.label}
              accessibilityRole="button"
              accessibilityLabel={`Request ${category.label}`}
              testID={`service-${category.label}`}
              onPress={() => router.push({ pathname: '/request', params: { service: category.label } })}
              style={({ pressed }) => [styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.categoryIcon, { backgroundColor: colors.secondary }]}>
                <MaterialCommunityIcons name={category.icon} size={22} color={colors.primary} />
              </View>
              <Text style={[styles.categoryLabel, { color: colors.foreground }]} numberOfLines={2}>{category.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent services</Text>
          <Pressable onPress={() => router.navigate('/activity')} testID="see-all-activity-button">
            <Text style={[styles.seeAll, { color: colors.primary }]}>View all</Text>
          </Pressable>
        </View>
        <View style={styles.recentList}>
          {recent.length === 0 ? (
            <View style={[styles.recentEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.recentEmptyText, { color: colors.mutedForeground }]}>
                Your completed repairs and invoices will be listed here.
              </Text>
            </View>
          ) : (
            recent.map((job) => (
              <Pressable
                key={job.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${job.service}`}
                testID={`home-recent-${job.reference}`}
                onPress={() => router.push(`/job/${job.id}`)}
                style={({ pressed }) => [styles.recentCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
              >
                <View style={[styles.recentIcon, { backgroundColor: colors.secondary }]}>
                  <MaterialCommunityIcons name="wrench-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.recentCopy}>
                  <Text style={[styles.recentTitle, { color: colors.foreground }]} numberOfLines={1}>{job.service}</Text>
                  <Text style={[styles.recentMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {job.technician?.name ?? 'Unmatched'} · Completed
                  </Text>
                </View>
                <View style={styles.recentAmount}>
                  <Text style={[styles.amount, { color: colors.foreground }]}>
                    {formatMoney(repairTotal(job) > 0 ? repairTotal(job) : job.visitFee)}
                  </Text>
                  <Text style={[styles.recentMeta, { color: colors.mutedForeground }]}>
                    {new Date(job.completedAt ?? job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Time-of-day greeting, so the header is not stuck on "Good morning". */
const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { paddingHorizontal: 20, gap: 17, paddingTop: 17 },
  searchBar: { height: 51, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6 },
  searchInput: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, height: '100%' },
  searchText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14 },
  searchFilter: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emergency: { minHeight: 112, borderRadius: 18, padding: 17, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  emergencyCopy: { flex: 1 },
  emergencyKicker: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  emergencyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 6 },
  emergencyText: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5 },
  emergencyButton: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25 },
  seeAll: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '31.8%', minHeight: 91, borderWidth: 1, borderRadius: 14, padding: 10, justifyContent: 'space-between' },
  categoryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14, marginTop: 8 },
  recentList: { gap: 9 },
  recentCard: { minHeight: 68, borderWidth: 1, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recentCopy: { flex: 1 },
  recentTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  recentMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  recentAmount: { alignItems: 'flex-end' },
  recentEmpty: { borderWidth: 1, borderRadius: 14, padding: 16 },
  recentEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  activeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  activeCopy: { flex: 1 },
  activeKicker: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  activeTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 5 },
  activeBadgeRow: { marginTop: 7 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
