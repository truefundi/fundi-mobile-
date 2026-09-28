import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { JobStatus } from '@/constants/jobs';
import { WorkAlerts } from '@/components/work/WorkAlerts';
import { WorkLocked } from '@/components/work/WorkLocked';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useFundi } from '@/context/FundiContext';

/** Icon per journey event, so each update is recognisable at a glance. */
const STATUS_ICON: Partial<Record<JobStatus, keyof typeof Ionicons.glyphMap>> = {
  REQUESTED: 'paper-plane-outline',
  MATCHING: 'search-outline',
  OFFERED: 'person-add-outline',
  ACCEPTED: 'checkmark-circle-outline',
  VISIT_PAID: 'card-outline',
  EN_ROUTE: 'navigate-outline',
  ARRIVED: 'location-outline',
  DIAGNOSING: 'build-outline',
  DIAGNOSIS_COMPLETE: 'clipboard-outline',
  QUOTE_PENDING: 'document-text-outline',
  QUOTE_APPROVED: 'thumbs-up-outline',
  REPAIR_IN_PROGRESS: 'construct-outline',
  ADDITIONAL_APPROVAL_REQUIRED: 'alert-circle-outline',
  REPAIR_COMPLETED: 'checkmark-done-outline',
  PAYMENT_PENDING: 'wallet-outline',
  PAYMENT_REPORTED: 'receipt-outline',
  COMPLETED: 'star-outline',
  CANCELLED: 'close-circle-outline',
};

/** Stages still waiting on the customer, highlighted at the top of the feed. */
const NEEDS_ACTION: JobStatus[] = ['OFFERED', 'ACCEPTED', 'QUOTE_PENDING', 'ADDITIONAL_APPROVAL_REQUIRED', 'REPAIR_COMPLETED', 'PAYMENT_PENDING'];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { events, jobs, isHydrated } = useFundi();

  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  const actionable = jobs.filter((job) => NEEDS_ACTION.includes(job.status));

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 67 : insets.top + 12, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 30 }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        testID="notifications-back-button"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </Pressable>

      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{inWork ? 'YOUR WORK' : 'KEEP IN THE LOOP'}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        </View>
        <Feather name="bell" size={20} color={colors.mutedForeground} />
      </View>

      {working ? (
        <WorkAlerts />
      ) : locked ? (
        <WorkLocked />
      ) : (
        <>
      {actionable.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          testID="notifications-action-banner"
          onPress={() => router.push(`/job/${actionable[0]!.id}`)}
          style={({ pressed }) => [styles.actionBanner, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.primaryForeground }]}>
            <Ionicons name="alert-circle" size={18} color={colors.primary} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={[styles.actionTitle, { color: colors.primaryForeground }]}>
              {actionable.length === 1 ? '1 job needs you' : `${actionable.length} jobs need you`}
            </Text>
            <Text style={[styles.actionText, { color: colors.secondary }]} numberOfLines={1}>
              {actionable[0]!.service} · tap to continue
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.primaryForeground} />
        </Pressable>
      ) : (
        <View style={[styles.unreadBanner, { backgroundColor: colors.secondary }]}>
          <View style={[styles.unreadIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="notifications-outline" size={17} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.unreadText, { color: colors.foreground }]}>You are all caught up on important updates.</Text>
        </View>
      )}

      {!isHydrated ? null : events.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="notifications-off-outline" size={23} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Updates about matching, arrival, quotes and payments will appear here as your job moves along.
          </Text>
        </View>
      ) : (
        events.map((event) => (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            accessibilityLabel={event.title}
            testID={`notification-${event.id}`}
            onPress={() => router.push(`/job/${event.jobId}`)}
            style={({ pressed }) => [styles.alertCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <View style={[styles.alertIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name={STATUS_ICON[event.status] ?? 'information-circle-outline'} size={20} color={colors.primary} />
            </View>
            <View style={styles.alertCopy}>
              <View style={styles.alertTitleRow}>
                <Text style={[styles.alertTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={[styles.alertTime, { color: colors.mutedForeground }]}>{relativeTime(event.at)}</Text>
              </View>
              <Text style={[styles.alertText, { color: colors.mutedForeground }]}>{event.text}</Text>
              <Text style={[styles.alertService, { color: colors.primary }]}>{event.service}</Text>
            </View>
          </Pressable>
        ))
      )}
        </>
      )}
    </ScrollView>
  );
}

/** Short "3 min ago" style stamp for the feed. */
function relativeTime(iso: string): string {
  const seconds = Math.max(Math.floor((Date.now() - new Date(iso).getTime()) / 1000), 0);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 4 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  actionBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, marginTop: 18, marginBottom: 14 },
  actionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1 },
  actionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  actionText: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  unreadBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, padding: 14, marginTop: 18, marginBottom: 14 },
  unreadIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  alertCard: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertCopy: { flex: 1 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  alertTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, flex: 1 },
  alertTime: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  alertText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 3 },
  alertService: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 6 },
  empty: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center' },
  emptyIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 13 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
});
