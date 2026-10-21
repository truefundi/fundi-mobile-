import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COMMISSION_RATE, formatMoney, isTerminated, STATUS_LABEL, type Job } from '@/constants/jobs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { canOpenMapNavigation, openMapNavigation } from '@/lib/location';

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
        text="Your technician job history will appear here once job matching and lifecycle APIs are available."
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

      {taken.map((job) => {
        const terminated = isTerminated(job.status);
        return (
          <View
            key={job.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: terminated ? colors.destructive + '40' : colors.border,
              },
            ]}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
              <Text style={[styles.fee, { color: colors.foreground }]}>
                {formatMoney(job.visitFee * (1 - COMMISSION_RATE))}
              </Text>
            </View>
            <Text style={[styles.problem, { color: colors.mutedForeground }]} numberOfLines={2}>
              {job.problem}
            </Text>
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground, flex: 1 }]} numberOfLines={1}>
                {job.locationLabel}
              </Text>
              {canOpenMapNavigation(job) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Navigate to job location"
                  testID={`work-job-navigate-${job.reference}`}
                  onPress={() => void openMapNavigation(job)}
                  style={({ pressed }) => [
                    styles.navBtn,
                    { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Feather name="navigation" size={12} color={colors.primary} />
                  <Text style={[styles.navBtnText, { color: colors.primary }]}>Navigate</Text>
                </Pressable>
              ) : null}
            </View>
            <View
              style={[
                styles.state,
                { backgroundColor: terminated ? colors.destructiveMuted : colors.successMuted },
              ]}
            >
              <Feather
                name={terminated ? 'x' : 'check'}
                size={12}
                color={terminated ? colors.destructive : colors.success}
              />
              <Text
                style={[
                  styles.stateText,
                  { color: terminated ? colors.destructive : colors.foreground },
                ]}
              >
                {STATUS_LABEL[job.status]}
              </Text>
            </View>
          </View>
        );
      })}
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
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  navBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
