import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COMMISSION_RATE, formatMoney, STATUS_LABEL, type Job } from '@/constants/jobs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

/**
 * The technician's own Activity: jobs they took, not jobs they asked for.
 *
 * Every one of these is Accepted and stays there — a technician cannot yet
 * mark arrival, diagnose or complete, so the list says so rather than
 * implying a lifecycle that has no buttons behind it.
 */
export function WorkJobs() {
  const colors = useColors();
  const { mine, done, earnings } = useWork();
  const taken: Job[] = [...mine, ...done];

  if (taken.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        title="No jobs taken yet"
        text="Go live on Home and accept a job — everything you take shows up here."
      />
    );
  }

  return (
    <View style={styles.list}>
      <View style={[styles.total, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.totalLabel, { color: colors.secondaryForeground }]}>
          {taken.length} {taken.length === 1 ? 'job' : 'jobs'} taken
        </Text>
        <Text style={[styles.totalValue, { color: colors.secondaryForeground }]}>{formatMoney(earnings)}</Text>
      </View>

      {taken.map((job) => (
        <View key={job.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardTop}>
            <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
            <Text style={[styles.fee, { color: colors.foreground }]}>{formatMoney(job.visitFee * (1 - COMMISSION_RATE))}</Text>
          </View>
          <Text style={[styles.problem, { color: colors.mutedForeground }]} numberOfLines={2}>{job.problem}</Text>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
              {job.locationLabel}
            </Text>
          </View>
          <View style={[styles.state, { backgroundColor: colors.successMuted }]}>
            <Feather name="check" size={12} color={colors.success} />
            <Text style={[styles.stateText, { color: colors.foreground }]}>{STATUS_LABEL[job.status]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 11 },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 16 },
  totalLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  totalValue: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.5 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  service: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3, flex: 1 },
  fee: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  problem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 11, paddingHorizontal: 9, paddingVertical: 5 },
  stateText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
