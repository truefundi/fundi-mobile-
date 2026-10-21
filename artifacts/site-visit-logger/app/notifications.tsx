import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { JobStatus, RequestLifecycleStatus } from '@/constants/jobs';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeading } from '@/components/ui/PageHeading';
import { WorkAlerts } from '@/components/work/WorkAlerts';
import { WorkLocked } from '@/components/work/WorkLocked';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useFundi } from '@/context/FundiContext';
import { useNotifications } from '@/context/NotificationContext';

/** Icon per journey event, so each update is recognisable at a glance. */
const STATUS_ICON: Partial<Record<JobStatus | RequestLifecycleStatus, keyof typeof Ionicons.glyphMap>> = {
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
  PENDING_RESPONSE: 'time-outline',
  OFFER_MADE: 'pricetag-outline',
  DECLINED: 'close-circle-outline',
};

/** Stages still waiting on the customer, highlighted at the top of the feed. */
const NEEDS_ACTION: JobStatus[] = ['OFFERED', 'ACCEPTED', 'QUOTE_PENDING', 'ADDITIONAL_APPROVAL_REQUIRED', 'REPAIR_COMPLETED', 'PAYMENT_PENDING'];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jobs, isHydrated: jobsHydrated } = useFundi();
  const {
    notifications,
    isHydrated: notificationsHydrated,
    unreadCount,
    toggleRead,
    markAllRead,
    deleteNotification,
  } = useNotifications();
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all');
  const isHydrated = jobsHydrated && notificationsHydrated;

  const { mode, status } = useWork();
  const working = mode === 'working' && status === 'verified';
  // In working mode but not cleared yet: say so rather than showing customer screens.
  const locked = mode === 'working' && status !== 'verified';
  const inWork = mode === 'working';

  const actionable = jobs.filter((job) => NEEDS_ACTION.includes(job.status));
  const visibleNotifications = notifications.filter((item) => filter === 'all' || !item.read);

  const openNotification = (item: (typeof notifications)[number]) => {
    if (!item.read) toggleRead(item.id);
    if (item.threadId) {
      router.push({ pathname: '/(tabs)/chat', params: { threadId: item.threadId } });
    } else if (item.jobId) {
      router.push(`/job/${item.jobId}`);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 24 : insets.top + 8, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 30 }}
      showsVerticalScrollIndicator={false}
    >
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} testID="notifications-back-button" />

      <View style={styles.headerRow}>
        <PageHeading eyebrow={inWork ? 'Your work' : 'Keep in the loop'} title="Notifications" />
        <Feather name="bell" size={20} color={colors.mutedForeground} />
      </View>

      {working ? <WorkAlerts /> : locked ? <WorkLocked /> : null}

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
              {actionable[0]!.service} · {actionable.length > 1 ? 'tap to open the first' : 'tap to continue'}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.primaryForeground} />
        </Pressable>
      ) : unreadCount === 0 && notifications.length > 0 ? (
        <View style={[styles.unreadBanner, { backgroundColor: colors.secondary }]}>
          <View style={[styles.unreadIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="notifications-outline" size={17} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.unreadText, { color: colors.foreground }]}>You are all caught up on important updates.</Text>
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {(['all', 'unread'] as const).map((value) => {
          const selected = filter === value;
          const count = value === 'all' ? notifications.length : unreadCount;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`notifications-filter-${value}`}
              onPress={() => setFilter(value)}
              style={[
                styles.filterButton,
                { backgroundColor: selected ? colors.primary : colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.filterLabel, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                {value === 'all' ? 'All' : 'Unread'}
              </Text>
              <View style={[styles.filterBadge, { backgroundColor: selected ? colors.primaryForeground : colors.secondary }]}>
                <Text style={[styles.filterCount, { color: selected ? colors.primary : colors.foreground }]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            testID="notifications-mark-all-read"
            onPress={markAllRead}
            style={styles.markAllButton}
          >
            <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>

      {!isHydrated ? (
        <LoadingState label="Loading updates…" />
      ) : visibleNotifications.length === 0 ? (
        <EmptyState
          icon="bell-off"
          title={filter === 'unread' ? 'No unread notifications' : 'Nothing yet'}
          text={filter === 'unread' ? 'You have read all your notifications.' : 'Updates about requests, offers, arrival, quotes and payments will appear here.'}
        />
      ) : (
        visibleNotifications.map((item) => (
          <View
            key={item.id}
            testID={`notification-row-${item.id}`}
            style={[styles.alertCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: item.read ? 0.75 : 1 }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title}
              testID={`notification-${item.id}`}
              onPress={() => openNotification(item)}
              style={styles.alertMain}
            >
              <View style={[styles.alertIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={STATUS_ICON[item.status] ?? 'information-circle-outline'} size={20} color={colors.primary} />
              </View>
              <View style={styles.alertCopy}>
                <View style={styles.alertTitleRow}>
                  <Text style={[styles.alertTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
                  <Text style={[styles.alertTime, { color: colors.mutedForeground }]}>{relativeTime(item.at)}</Text>
                </View>
                <Text style={[styles.alertText, { color: colors.mutedForeground }]}>{item.text}</Text>
                <Text style={[styles.alertService, { color: colors.primary }]}>{item.service}</Text>
              </View>
            </Pressable>
            <View style={styles.notificationActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.read ? 'Mark as unread' : 'Mark as read'}
                testID={`notification-toggle-read-${item.id}`}
                onPress={() => toggleRead(item.id)}
                hitSlop={6}
              >
                <Ionicons name={item.read ? 'mail-outline' : 'mail-open-outline'} size={17} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete notification"
                testID={`notification-delete-${item.id}`}
                onPress={() => deleteNotification(item.id)}
                hitSlop={6}
              >
                <Feather name="trash-2" size={17} color={colors.destructive} />
              </Pressable>
            </View>
          </View>
        ))
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 4, marginBottom: 18 },
  actionBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, marginBottom: 14 },
  actionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1 },
  actionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  actionText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11 },
  filterLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  filterBadge: { minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCount: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  markAllButton: { marginLeft: 'auto', paddingVertical: 7 },
  markAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  unreadBanner: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, padding: 14, marginBottom: 14 },
  unreadIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  alertMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  notificationActions: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingLeft: 3 },
  alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertCopy: { flex: 1 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  alertTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  alertTime: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  alertText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 3 },
  alertService: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 6 },
});
