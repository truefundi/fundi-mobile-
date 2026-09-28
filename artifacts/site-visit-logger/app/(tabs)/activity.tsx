import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balanceDue, formatMoney, isClosed, repairTotal, type Job } from '@/constants/jobs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { WorkJobs } from '@/components/work/WorkJobs';
import { WorkLocked } from '@/components/work/WorkLocked';
import { AppHeader } from '@/components/ui/AppHeader';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useFundi } from '@/context/FundiContext';

type Tab = 'Active' | 'Completed';

/** Spec 20 — the customer's service history, split into live and finished jobs. */
export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jobs, isHydrated } = useFundi();
  const [tab, setTab] = useState<Tab>('Active');
  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  const { active, completed } = useMemo(
    () => ({
      active: jobs.filter((job) => !isClosed(job.status)),
      completed: jobs.filter((job) => isClosed(job.status)),
    }),
    [jobs],
  );

  const visible = tab === 'Active' ? active : completed;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>{inWork ? 'YOUR WORK' : 'YOUR FUNDI JOURNEY'}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{inWork ? 'My jobs' : 'My services'}</Text>

      {working ? (
        <WorkJobs />
      ) : locked ? (
        <WorkLocked />
      ) : (
        <>
      <View style={[styles.tabs, { backgroundColor: colors.muted }]}>
        {(['Active', 'Completed'] as Tab[]).map((option) => {
          const selected = option === tab;
          const count = option === 'Active' ? active.length : completed.length;
          return (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              testID={`activity-tab-${option}`}
              onPress={() => setTab(option)}
              style={[styles.tab, selected && { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selected ? colors.foreground : colors.mutedForeground, fontFamily: selected ? 'Inter_700Bold' : 'Inter_500Medium' },
                ]}
              >
                {option}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!isHydrated ? null : visible.length === 0 ? (
        <EmptyState tab={tab} onBrowse={() => router.navigate('/services')} />
      ) : (
        visible.map((job) => <JobCard key={job.id} job={job} onPress={() => router.push(`/job/${job.id}`)} />)
      )}
        </>
      )}
      </ScrollView>
    </View>
  );
}

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const colors = useColors();
  const created = new Date(job.createdAt);
  const total = repairTotal(job);
  // Before a quote exists the only committed cost is the visit fee.
  const amount = total > 0 ? total : job.visitFee;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.service}, ${job.reference}`}
      testID={`activity-job-${job.reference}`}
      onPress={onPress}
      style={({ pressed }) => [styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[styles.jobIcon, { backgroundColor: colors.secondary }]}>
        <MaterialCommunityIcons name="wrench-outline" size={21} color={colors.primary} />
      </View>
      <View style={styles.jobCopy}>
        <View style={styles.jobTitleRow}>
          <Text style={[styles.jobTitle, { color: colors.foreground }]} numberOfLines={1}>
            {job.service}
          </Text>
          <Text style={[styles.amount, { color: colors.foreground }]}>{formatMoney(amount)}</Text>
        </View>
        <Text style={[styles.jobMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {job.technician ? `${job.technician.name} · ` : ''}
          {created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <View style={styles.jobFooter}>
          <StatusBadge status={job.status} />
          <Text style={[styles.reference, { color: colors.mutedForeground }]}>{job.reference}</Text>
        </View>
        {!isClosed(job.status) && balanceDue(job) > 0 && job.quote ? (
          <Text style={[styles.balance, { color: colors.primary }]}>{formatMoney(balanceDue(job))} balance</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function EmptyState({ tab, onBrowse }: { tab: Tab; onBrowse: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <MaterialCommunityIcons name={tab === 'Active' ? 'clipboard-text-outline' : 'check-circle-outline'} size={24} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {tab === 'Active' ? 'No active services' : 'No completed services yet'}
      </Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {tab === 'Active'
          ? 'When you request a technician, you can follow the job here from matching through to payment.'
          : 'Finished jobs, invoices and receipts will be kept here.'}
      </Text>
      {tab === 'Active' ? (
        <Pressable
          accessibilityRole="button"
          testID="activity-browse-button"
          onPress={onBrowse}
          style={({ pressed }) => [styles.emptyButton, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}
        >
          <Text style={[styles.emptyButtonText, { color: colors.primaryForeground }]}>Browse services</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  tabs: { flexDirection: 'row', borderRadius: 23, padding: 4, marginTop: 18, marginBottom: 16 },
  tab: { flex: 1, minHeight: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13 },
  jobCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 11 },
  jobIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  jobCopy: { flex: 1, gap: 3 },
  jobTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  jobTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, flex: 1 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  jobMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  jobFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  reference: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  balance: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', marginTop: 6 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 14 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  emptyButton: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 16 },
  emptyButtonText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});
