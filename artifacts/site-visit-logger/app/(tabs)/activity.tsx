import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { balanceDue, formatMoney, isClosed, isTerminated, repairTotal, type Job } from '@/constants/jobs';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeading } from '@/components/ui/PageHeading';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { WorkJobs } from '@/components/work/WorkJobs';
import { WorkLocked } from '@/components/work/WorkLocked';
import { AppHeader } from '@/components/ui/AppHeader';
import { useWork, TECH_JOBS_KEY } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';
import { useFundi } from '@/context/FundiContext';
import { useNotifications } from '@/context/NotificationContext';

type Tab = 'Active' | 'Completed' | 'Cancelled';

/** Spec 20 — the customer's service history, split into live, finished, and cancelled jobs. */
export default function ActivityScreen() {
  const colors = useColors();
  const bottomPadding = useTabScreenPadding();
  const router = useRouter();
  const { jobs, isHydrated, cancelJob } = useFundi();
  const { addNotification } = useNotifications();
  const [tab, setTab] = useState<Tab>('Active');
  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  // Client cancellation flow
  const [cancelModalJob, setCancelModalJob] = useState<Job | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const { active, completed, cancelled } = useMemo(
    () => ({
      active: jobs.filter((job) => !isClosed(job.status) && !isTerminated(job.status)),
      completed: jobs.filter((job) => job.status === 'COMPLETED'),
      cancelled: jobs.filter((job) => isTerminated(job.status)),
    }),
    [jobs],
  );

  const visible = tab === 'Active' ? active : tab === 'Completed' ? completed : cancelled;

  const handleConfirmCancel = async () => {
    if (!cancelModalJob) return;
    const reason = cancelReason.trim() || 'Client cancelled the request.';
    setCancelLoading(true);
    try {
      const techPhone = cancelModalJob.technician?.phone;
      cancelJob(cancelModalJob.id, reason, [techPhone].filter(Boolean) as string[]);

      // Update technician's persistent store if technician phone is known
      if (techPhone) {
        const key = `${TECH_JOBS_KEY}/${techPhone}`;
        try {
          const raw = await AsyncStorage.getItem(key);
          const list: Job[] = raw ? JSON.parse(raw) : [];
          const updatedList = list.map((j) =>
            j.id === cancelModalJob.id
              ? {
                  ...j,
                  status: 'CANCELLED' as const,
                  cancellationReason: reason,
                  statusSince: new Date().toISOString(),
                }
              : j,
          );
          await AsyncStorage.setItem(key, JSON.stringify(updatedList));
        } catch {}

        addNotification({
          id: `cancel-${cancelModalJob.id}-${Date.now()}`,
          jobId: cancelModalJob.id,
          threadId: cancelModalJob.chatThreadId,
          status: 'CANCELLED',
          service: cancelModalJob.service,
          title: 'Job cancelled by client',
          text: `The client cancelled the job: ${reason}`,
          at: new Date().toISOString(),
          recipientPhones: [techPhone],
        });
      }

      setCancelModalJob(null);
      setCancelReason('');
      Alert.alert('Job Cancelled', 'Your request was cancelled and the technician has been notified.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not cancel the job.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleOpenChat = (job: Job) => {
    if (job.chatThreadId) {
      router.push({ pathname: `/chat/${job.chatThreadId}` as any, params: { requestId: job.id } });
    } else {
      router.push('/chat');
    }
  };

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
                        <JobCard
                          key={job.id}
                          job={job}
                          onPress={() => handleJobPress(job)}
                          onCancel={() => setCancelModalJob(job)}
                          onChat={() => handleOpenChat(job)}
                        />
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
                  <JobCard
                    key={job.id}
                    job={job}
                    onPress={() => handleJobPress(job)}
                    onCancel={() => setCancelModalJob(job)}
                    onChat={() => handleOpenChat(job)}
                  />
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
                      <JobCard
                        key={job.id}
                        job={job}
                        onPress={() => handleJobPress(job)}
                        onCancel={() => setCancelModalJob(job)}
                        onChat={() => handleOpenChat(job)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Client Cancellation Reason Modal */}
      {cancelModalJob && (
        <Modal
          visible={cancelModalJob !== null}
          animationType="slide"
          transparent
          onRequestClose={() => setCancelModalJob(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.destructive }]}>
                Cancel service request?
              </Text>
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                Please state the reason why you are cancelling this service. Your technician will be notified immediately.
              </Text>
              <TextInput
                placeholder="e.g. Schedule changed / problem resolved / agreed with technician"
                placeholderTextColor={colors.mutedForeground}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                style={[
                  styles.inputBox,
                  { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border },
                ]}
              />
              <View style={styles.flowActionRow}>
                <Button
                  label="Keep Job"
                  variant="outline"
                  size="small"
                  onPress={() => {
                    setCancelModalJob(null);
                    setCancelReason('');
                  }}
                  disabled={cancelLoading}
                  style={{ flex: 1 }}
                />
                <Button
                  label={cancelLoading ? 'Cancelling…' : 'Confirm Cancel'}
                  variant="danger"
                  size="small"
                  onPress={handleConfirmCancel}
                  disabled={cancelLoading}
                  style={{ flex: 1.3 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function JobCard({
  job,
  onPress,
  onCancel,
  onChat,
}: {
  job: Job;
  onPress: () => void;
  onCancel?: () => void;
  onChat?: () => void;
}) {
  const colors = useColors();
  const created = new Date(job.createdAt);
  const total = repairTotal(job);
  // Before a quote exists the only committed cost is the visit fee.
  const amount = job.agreedPrice || (total > 0 ? total : job.visitFee);
  const terminated = isTerminated(job.status);
  const isActiveOrProgress = job.status === 'ACTIVE' || job.status === 'IN_PROGRESS';

  if (isActiveOrProgress) {
    const isStarted = job.status === 'IN_PROGRESS';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${job.service}, ${job.reference}`}
        testID={`activity-job-${job.reference}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.containerCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.primary,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        {/* Header row: Job Title & Status */}
        <View style={styles.cardHeader}>
          <Text style={[styles.jobServiceTitle, { color: colors.foreground }]} numberOfLines={1}>
            {job.service}
          </Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isStarted ? colors.success + '20' : colors.primary + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                {
                  color: isStarted ? colors.success : colors.primary,
                },
              ]}
            >
              {isStarted ? 'In Progress' : 'Active'}
            </Text>
          </View>
        </View>

        {/* Agreed Amount Box */}
        <View style={[styles.agreedAmountRow, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.agreedAmountLabel, { color: colors.secondaryForeground }]}>
            {job.agreedPrice ? 'Agreed Fee:' : 'Visit / Booking Fee:'}
          </Text>
          <Text style={[styles.agreedAmountValue, { color: colors.primary }]}>
            RWF {amount.toLocaleString()}
          </Text>
        </View>

        {/* Job Problem */}
        {job.problem ? (
          <Text style={[styles.jobProblem, { color: colors.mutedForeground }]} numberOfLines={2}>
            {job.problem}
          </Text>
        ) : null}

        {/* Technician & Location */}
        <View style={styles.clientAndLocationRow}>
          <View style={styles.infoRow}>
            <Feather name="tool" size={13} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.foreground, fontWeight: '600' }]} numberOfLines={1}>
              {job.technician?.name || 'Assigned Technician'}
            </Text>
            {job.technician?.phone ? (
              <Text style={[styles.infoSubText, { color: colors.mutedForeground }]}>
                · {job.technician.phone}
              </Text>
            ) : null}
          </View>

          <View style={styles.infoRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {job.locationLabel}
            </Text>
          </View>
        </View>

        {/* Actions for client: Status pill, Cancel button, Chat button */}
        <View style={styles.cardActionsContainer}>
          <View
            style={[
              styles.statusIndicatorBtn,
              {
                backgroundColor: isStarted ? colors.success + '15' : colors.primary + '15',
                borderColor: isStarted ? colors.success + '35' : colors.primary + '35',
              },
            ]}
          >
            <Feather
              name={isStarted ? 'loader' : 'check-circle'}
              size={12}
              color={isStarted ? colors.success : colors.primary}
            />
            <Text
              style={[
                styles.statusIndicatorText,
                { color: isStarted ? colors.success : colors.primary },
              ]}
            >
              {isStarted ? 'In Progress' : 'Active'}
            </Text>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onCancel?.();
            }}
            style={[
              styles.cardActionBtn,
              { backgroundColor: colors.card, borderColor: colors.destructive + '40' },
            ]}
          >
            <Feather name="x-circle" size={12} color={colors.destructive} />
            <Text style={[styles.cardActionBtnText, { color: colors.destructive }]}>
              Cancel Job
            </Text>
          </Pressable>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onChat?.();
            }}
            style={[
              styles.cardChatBtn,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Ionicons name="chatbubbles-outline" size={14} color={colors.primary} />
          </Pressable>
        </View>
      </Pressable>
    );
  }

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
  containerCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 10, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  jobServiceTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, flex: 1 },
  statusPill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  agreedAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  agreedAmountLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  agreedAmountValue: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  jobProblem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  clientAndLocationRow: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  infoSubText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  cardActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  statusIndicatorBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusIndicatorText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardActionBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  cardChatBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, gap: 12 },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  modalSub: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  inputBox: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 70, fontSize: 13 },
  flowActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
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
