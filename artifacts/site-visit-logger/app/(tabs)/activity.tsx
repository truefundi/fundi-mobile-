import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, isClosed, isTerminated, repairTotal, type Job } from '@/constants/jobs';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeading } from '@/components/ui/PageHeading';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { WorkJobs } from '@/components/work/WorkJobs';
import { WorkLocked } from '@/components/work/WorkLocked';
import { AppHeader } from '@/components/ui/AppHeader';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';
import { useFundi } from '@/context/FundiContext';

type Tab = 'Active' | 'Completed' | 'Cancelled';

/** Spec 20 — the customer's service history, split into live, finished, and cancelled jobs. */
export default function ActivityScreen() {
  const colors = useColors();
  const bottomPadding = useTabScreenPadding();
  const router = useRouter();
  const { jobs, isHydrated } = useFundi();
  const [tab, setTab] = useState<Tab>('Active');
  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  const { active, completed, cancelled } = useMemo(
    () => ({
      active: jobs.filter((job) => !isClosed(job.status) && !isTerminated(job.status)),
      completed: jobs.filter((job) => job.status === 'COMPLETED'),
      cancelled: jobs.filter((job) => isTerminated(job.status)),
    }),
    [jobs],
  );

  const visible = tab === 'Active' ? active : tab === 'Completed' ? completed : cancelled;

  const handleJobPress = (job: Job) => {
    if (isTerminated(job.status)) {
      // Prevent normal navigation to open/active chat.
      // Immediately redirect to technician selection screen pre-filling category, description, and location.
      router.push({
        pathname: '/select-technician',
        params: {
          jobId: job.id,
          category: job.service,
          service: job.service,
          description: job.problem,
          problem: job.problem,
          location: job.locationLabel,
          address: job.locationLabel,
          ...(job.locationLatitude !== undefined ? { latitude: String(job.locationLatitude) } : {}),
          ...(job.locationLongitude !== undefined ? { longitude: String(job.locationLongitude) } : {}),
        },
      });
      return;
    }
    router.push(`/job/${job.id}`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeading eyebrow={inWork ? 'Your work' : 'Your Fundi journey'} title={inWork ? 'My jobs' : 'My services'} />

        {working ? (
          <WorkJobs />
        ) : locked ? (
          <WorkLocked />
        ) : (
          <>
            <View style={[styles.tabs, { backgroundColor: colors.muted }]}>
              {(['Active', 'Completed', 'Cancelled'] as Tab[]).map((option) => {
                const selected = option === tab;
                const count =
                  option === 'Active' ? active.length : option === 'Completed' ? completed.length : cancelled.length;
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
                        {
                          color: selected ? colors.foreground : colors.mutedForeground,
                          fontFamily: selected ? 'Inter_700Bold' : 'Inter_500Medium',
                        },
                      ]}
                    >
                      {option}
                      {count > 0 ? ` (${count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!isHydrated ? (
              <LoadingState label="Loading your services…" />
            ) : visible.length === 0 ? (
              tab === 'Active' ? (
                <>
                  <EmptyState
                    icon="clipboard"
                    title="No active services"
                    text="Your requests and the technicians you select will appear here."
                    action={{ label: 'Browse services', onPress: () => router.navigate('/services'), testID: 'activity-browse-button' }}
                  />
                  {cancelled.length > 0 ? (
                    <View style={styles.terminatedSection}>
                      <View style={styles.terminatedSectionHeader}>
                        <Feather name="alert-circle" size={16} color={colors.destructive} />
                        <Text style={[styles.terminatedSectionTitle, { color: colors.foreground }]}>
                          Cancelled & Declined Requests ({cancelled.length})
                        </Text>
                      </View>
                      <Text style={[styles.terminatedSectionSub, { color: colors.mutedForeground }]}>
                        Tap any terminated card to rebook with the next available technician.
                      </Text>
                      {cancelled.map((job) => (
                        <JobCard key={job.id} job={job} onPress={() => handleJobPress(job)} />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : tab === 'Completed' ? (
                <EmptyState icon="check-circle" title="No completed services yet" text="Finished jobs, invoices and receipts will be kept here." />
              ) : (
                <EmptyState icon="check-circle" title="No cancelled services" text="Cancelled and declined requests will appear here." />
              )
            ) : (
              <>
                {visible.map((job) => (
                  <JobCard key={job.id} job={job} onPress={() => handleJobPress(job)} />
                ))}

                {tab === 'Active' && cancelled.length > 0 ? (
                  <View style={styles.terminatedSection}>
                    <View style={styles.terminatedSectionHeader}>
                      <Feather name="alert-circle" size={16} color={colors.destructive} />
                      <Text style={[styles.terminatedSectionTitle, { color: colors.foreground }]}>
                        Cancelled & Declined Requests ({cancelled.length})
                      </Text>
                    </View>
                    <Text style={[styles.terminatedSectionSub, { color: colors.mutedForeground }]}>
                      Tap any terminated card to rebook with the next available technician.
                    </Text>
                    {cancelled.map((job) => (
                      <JobCard key={job.id} job={job} onPress={() => handleJobPress(job)} />
                    ))}
                  </View>
                ) : null}
              </>
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
  const terminated = isTerminated(job.status);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.service}, ${job.reference}`}
      testID={`activity-job-${job.reference}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.jobCard,
        {
          backgroundColor: colors.card,
          borderColor: terminated ? colors.destructive + '45' : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.jobIcon,
          { backgroundColor: terminated ? colors.destructiveMuted : colors.secondary },
        ]}
      >
        <MaterialCommunityIcons
          name={terminated ? 'close-circle-outline' : 'wrench-outline'}
          size={21}
          color={terminated ? colors.destructive : colors.primary}
        />
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
        {terminated ? (
          <View style={[styles.rebookBadgeRow, { backgroundColor: colors.primary + '14' }]}>
            <Feather name="refresh-cw" size={12} color={colors.primary} />
            <Text style={[styles.rebookBadgeText, { color: colors.primary }]}>
              Tap to choose next technician
            </Text>
          </View>
        ) : !isClosed(job.status) && balanceDue(job) > 0 && job.quote ? (
          <Text style={[styles.balance, { color: colors.primary }]}>{formatMoney(balanceDue(job))} balance</Text>
        ) : null}
      </View>
      {terminated ? (
        <View style={[styles.rebookActionBtn, { backgroundColor: colors.primary }]}>
          <Feather name="arrow-right" size={15} color={colors.primaryForeground} />
        </View>
      ) : (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabs: { flexDirection: 'row', borderRadius: 23, padding: 4, marginTop: 18, marginBottom: 16 },
  tab: { flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13 },
  jobCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 11 },
  jobIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  jobCopy: { flex: 1, gap: 3 },
  jobTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  jobTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, flex: 1 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  jobMeta: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  jobFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 },
  reference: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  balance: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 4 },
  rebookBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  rebookBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  rebookActionBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  terminatedSection: { marginTop: 16, marginBottom: 8, gap: 8 },
  terminatedSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  terminatedSectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  terminatedSectionSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
});
