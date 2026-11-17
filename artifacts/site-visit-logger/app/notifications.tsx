import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { shortDate } from '@/components/jobs/JobListItem';
import type { Job } from '@/constants/jobs';
import { useFundi } from '@/context/FundiContext';
import { useNotifications, type NotificationGroup } from '@/context/NotificationContext';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { getServiceIcon } from '@/lib/categories-api';
import type { NotificationKind } from '@/lib/notifications-api';

/** Icon for an update that is not tied to a known job. */
const KIND_ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  JOB_OFFER: 'briefcase-outline',
  JOB_ASSIGNED: 'person-add-outline',
  JOB_ACCEPTED: 'checkmark-circle-outline',
  JOB_COMPLETED: 'checkmark-done-outline',
  JOB_CANCELLED: 'close-circle-outline',
  CONVERSATION_MESSAGE: 'chatbubble-ellipses-outline',
  OFFER_SENT: 'pricetag-outline',
  OFFER_ACCEPTED: 'ribbon-outline',
  OFFER_DECLINED: 'close-circle-outline',
  DISPUTE_OPENED: 'alert-circle-outline',
  DISPUTE_RESOLVED: 'shield-checkmark-outline',
  DOCUMENT_APPROVED: 'document-text-outline',
  DOCUMENT_REJECTED: 'document-text-outline',
  BROADCAST: 'megaphone-outline',
  SYSTEM: 'information-circle-outline',
};

/**
 * The account's notifications from the server, one entry per job: the newest
 * update on top and a count of the others, so following a job never floods
 * the list. Opening an entry marks it read and goes to the job's chat.
 */
export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { groups, unreadCount, isHydrated, loadError, refresh, markGroupRead, markAllRead } = useNotifications();
  const { jobs } = useFundi();
  const { offers, mine, done, cancelled } = useWork();
  const [refreshing, setRefreshing] = useState(false);

  // Fresh on every visit.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const jobById = useMemo(() => {
    const map = new Map<string, Job>();
    for (const job of [...jobs, ...offers, ...mine, ...done, ...cancelled]) map.set(job.id, job);
    return map;
  }, [jobs, offers, mine, done, cancelled]);

  const fresh = groups.filter((group) => group.unread > 0);
  const earlier = groups.filter((group) => group.unread === 0);

  const open = (group: NotificationGroup) => {
    markGroupRead(group);
    if (group.jobId) {
      router.push({ pathname: '/chat/[id]', params: { id: group.jobId } });
    } else if (group.latest.type === 'DOCUMENT_APPROVED' || group.latest.type === 'DOCUMENT_REJECTED') {
      router.navigate('/');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 18 : insets.top + 8 }]}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} testID="notifications-back-button" />
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={markAllRead} hitSlop={8} testID="notifications-mark-all-read">
            <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
      >
        {!isHydrated ? (
          <LoadingState label="Loading notifications…" />
        ) : groups.length === 0 ? (
          loadError ? (
            <EmptyState
              icon="wifi-off"
              title="Couldn't load notifications"
              text={loadError}
              action={{ label: 'Try again', onPress: () => void refresh() }}
            />
          ) : (
            <EmptyState
              icon="bell"
              title="You're all caught up"
              text="Updates about your requests, prices and jobs will appear here."
            />
          )
        ) : (
          <>
            {fresh.length > 0 ? (
              <Section title="New" groups={fresh} jobById={jobById} onOpen={open} />
            ) : (
              <View style={[styles.caughtUp, { backgroundColor: colors.secondary }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[styles.caughtUpText, { color: colors.foreground }]}>You're all caught up.</Text>
              </View>
            )}
            {earlier.length > 0 ? <Section title="Earlier" groups={earlier} jobById={jobById} onOpen={open} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  groups,
  jobById,
  onOpen,
}: {
  title: string;
  groups: NotificationGroup[];
  jobById: Map<string, Job>;
  onOpen: (group: NotificationGroup) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {groups.map((group, index) => (
          <NotificationRow
            key={group.key}
            group={group}
            job={group.jobId ? jobById.get(group.jobId) : undefined}
            first={index === 0}
            onPress={() => onOpen(group)}
          />
        ))}
      </View>
    </View>
  );
}

function NotificationRow({
  group,
  job,
  first,
  onPress,
}: {
  group: NotificationGroup;
  job?: Job;
  first: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const { latest } = group;
  const unread = group.unread > 0;
  const heading = job?.service ?? (group.jobId ? 'Your job' : latest.title);
  const line = group.jobId ? latest.title : latest.body;
  const detail = group.jobId ? latest.body : null;
  const more = group.items.length - 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${heading}. ${latest.title}. ${latest.body}`}
      onPress={onPress}
      testID={`notification-${group.key}`}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        { backgroundColor: pressed ? colors.secondary : unread ? colors.primary + '0D' : 'transparent' },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        {job ? (
          <MaterialCommunityIcons name={getServiceIcon(job.service) as any} size={20} color={colors.primary} />
        ) : (
          <Ionicons name={KIND_ICON[latest.type] ?? 'notifications-outline'} size={20} color={colors.primary} />
        )}
        {unread ? <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: colors.card }]} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text
            style={[styles.heading, { color: colors.foreground, fontFamily: unread ? 'Inter_700Bold' : 'Inter_600SemiBold' }]}
            numberOfLines={1}
          >
            {heading}
          </Text>
          <Text style={[styles.time, { color: unread ? colors.primary : colors.mutedForeground }]}>
            {shortDate(latest.createdAt)}
          </Text>
        </View>
        <Text
          style={[styles.line, { color: colors.foreground, fontFamily: unread ? 'Inter_600SemiBold' : 'Inter_500Medium' }]}
          numberOfLines={1}
        >
          {line}
        </Text>
        {detail ? (
          <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
        {more > 0 ? (
          <Text style={[styles.more, { color: colors.mutedForeground }]}>
            {group.unread > 1 ? `${group.unread} new updates` : `+${more} earlier update${more === 1 ? '' : 's'}`}
          </Text>
        ) : null}
      </View>
      {group.jobId ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={styles.chevron} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  title: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.4 },
  markAll: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  headerSpacer: { width: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 18 },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  caughtUpText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  section: { gap: 8 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.6 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { flex: 1, fontSize: 14 },
  time: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  line: { fontSize: 13 },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  more: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 3 },
  chevron: { alignSelf: 'center' },
});
