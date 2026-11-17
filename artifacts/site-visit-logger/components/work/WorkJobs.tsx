import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReasonSheet } from '@/components/chat/ChatSheets';
import { EmptyState } from '@/components/ui/EmptyState';
import { isClosed, isTerminated, STATUS_LABEL, type Job } from '@/constants/jobs';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { getServiceIcon } from '@/lib/categories-api';

type Tab = 'Requests' | 'Active' | 'Completed' | 'Cancelled';

const EMPTY: Record<Tab, { icon: keyof typeof Feather.glyphMap; title: string; text: string }> = {
  Requests: {
    icon: 'inbox',
    title: 'No new requests',
    text: 'Client requests routed to you appear here for you to accept or decline.',
  },
  Active: {
    icon: 'briefcase',
    title: 'No active jobs',
    text: 'Requests you accept appear here. Everything about a job happens in its chat.',
  },
  Completed: {
    icon: 'check-circle',
    title: 'No completed jobs yet',
    text: 'Jobs you complete are kept here along with your earnings.',
  },
  Cancelled: {
    icon: 'x-circle',
    title: 'No cancelled jobs',
    text: 'Jobs that were cancelled or that you pulled out of appear here.',
  },
};

/**
 * The technician's jobs, grouped by stage. Every job opens its one chat, where
 * the request, price agreement and progress live; only a new request can be
 * accepted or declined straight from its card.
 */
export function WorkJobs() {
  const colors = useColors();
  const router = useRouter();
  const { offers, mine, done, cancelled, earnings, acceptOffer, rejectOffer } = useWork();
  const [tab, setTab] = useState<Tab>(offers.length > 0 ? 'Requests' : 'Active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [declining, setDeclining] = useState<Job | null>(null);

  const lists: Record<Tab, Job[]> = { Requests: offers, Active: mine, Completed: done, Cancelled: cancelled };
  const visibleJobs = lists[tab];

  const openChat = (jobId: string) => router.push({ pathname: '/chat/[id]', params: { id: jobId } });

  const accept = async (job: Job) => {
    setBusyId(job.id);
    setErrors((current) => ({ ...current, [job.id]: '' }));
    try {
      const accepted = await acceptOffer(job.offerId || job.id);
      openChat(accepted.id);
    } catch (e) {
      setErrors((current) => ({
        ...current,
        [job.id]: e instanceof Error ? e.message : 'Could not accept this request.',
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.summaryCard, { backgroundColor: colors.secondary }]}>
        <View>
          <Text style={[styles.summaryLabel, { color: colors.secondaryForeground }]}>Total Earnings</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>RWF {earnings.toLocaleString()}</Text>
        </View>
        <Text style={[styles.statsText, { color: colors.secondaryForeground }]}>
          {mine.length} active · {done.length} completed
        </Text>
      </View>

      <View style={[styles.tabsRow, { backgroundColor: colors.muted }]}>
        {(Object.keys(lists) as Tab[]).map((t) => {
          const selected = t === tab;
          const count = lists[t].length;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabButton, selected && { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: selected ? colors.foreground : colors.mutedForeground,
                    fontFamily: selected ? 'Inter_700Bold' : 'Inter_500Medium',
                  },
                ]}
              >
                {t} {count > 0 ? `(${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visibleJobs.length === 0 ? (
        <EmptyState icon={EMPTY[tab].icon} title={EMPTY[tab].title} text={EMPTY[tab].text} />
      ) : (
        <View style={styles.list}>
          {visibleJobs.map((job) => {
            const isRequest = tab === 'Requests';
            const inProgress = !isClosed(job.status) && !isTerminated(job.status);
            const terminated = isTerminated(job.status);
            const tone = isRequest
              ? colors.warning
              : inProgress
                ? colors.primary
                : terminated
                  ? colors.destructive
                  : colors.success;
            const statusLabel = isRequest
              ? 'New request'
              : job.status === 'IN_PROGRESS'
                ? 'In progress'
                : job.status === 'ACTIVE'
                  ? job.agreedPrice
                    ? 'Price agreed'
                    : 'Agree a price'
                  : STATUS_LABEL[job.status];
            const busy = busyId === job.id;

            return (
              <Pressable
                key={job.id}
                onPress={() => openChat(job.id)}
                testID={`work-job-${job.id}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: inProgress || isRequest ? tone : colors.border,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderTitleRow}>
                    <View style={[styles.cardHeaderIconTile, { backgroundColor: colors.secondary }]}>
                      <MaterialCommunityIcons name={getServiceIcon(job.service) as any} size={17} color={colors.primary} />
                    </View>
                    <Text style={[styles.jobServiceTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {job.service}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: tone + '20' }]}>
                    <Text style={[styles.statusPillText, { color: tone }]}>{statusLabel}</Text>
                  </View>
                </View>

                {job.agreedPrice ? (
                  <View style={[styles.agreedAmountRow, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.agreedAmountLabel, { color: colors.secondaryForeground }]}>Agreed price</Text>
                    <Text style={[styles.agreedAmountValue, { color: colors.primary }]}>
                      RWF {job.agreedPrice.toLocaleString()}
                    </Text>
                  </View>
                ) : null}

                <Text style={[styles.jobProblem, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {job.problem}
                </Text>

                <View style={styles.clientAndLocationRow}>
                  <View style={styles.infoRow}>
                    <Feather name="user" size={13} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.foreground }]} numberOfLines={1}>
                      {job.clientName || 'Client'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {job.locationLabel}
                    </Text>
                  </View>
                </View>

                {isRequest ? (
                  <View style={styles.cardActionsContainer}>
                    <Pressable
                      disabled={busy}
                      onPress={(e) => {
                        e.stopPropagation();
                        void accept(job);
                      }}
                      testID={`accept-request-${job.id}`}
                      style={[
                        styles.cardActionBtn,
                        { backgroundColor: colors.primary, borderColor: colors.primary, opacity: busy ? 0.7 : 1 },
                      ]}
                    >
                      <Feather name="check" size={13} color={colors.primaryForeground} />
                      <Text style={[styles.cardActionBtnText, { color: colors.primaryForeground }]}>
                        {busy ? 'Accepting…' : 'Accept request'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={(e) => {
                        e.stopPropagation();
                        setDeclining(job);
                      }}
                      style={[styles.cardActionBtn, { backgroundColor: colors.card, borderColor: colors.destructive + '40' }]}
                    >
                      <Feather name="x" size={13} color={colors.destructive} />
                      <Text style={[styles.cardActionBtnText, { color: colors.destructive }]}>Decline</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <Text style={[styles.viewDetailsText, { color: colors.primary }]}>Open chat →</Text>
                  </View>
                )}
                {errors[job.id] ? (
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{errors[job.id]}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <ReasonSheet
        visible={Boolean(declining)}
        title="Decline this request"
        description="The client will be able to choose another technician. A short reason helps them."
        confirmLabel="Decline request"
        required={false}
        busy={false}
        onClose={() => setDeclining(null)}
        onSubmit={async (reason) => {
          if (!declining) return;
          await rejectOffer(declining.offerId || declining.id, reason || 'Technician unavailable');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  summaryCard: { borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5, marginTop: 2 },
  statsText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  tabsRow: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabButtonText: { fontSize: 12 },
  list: { gap: 12 },
  card: { borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardHeaderIconTile: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  jobServiceTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, flex: 1 },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  agreedAmountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  agreedAmountLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  agreedAmountValue: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  jobProblem: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  clientAndLocationRow: { gap: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontFamily: 'Inter_500Medium', fontSize: 12, flexShrink: 1 },
  cardFooter: { borderTopWidth: 1, paddingTop: 8 },
  cardActionsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
  },
  cardActionBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  viewDetailsText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
