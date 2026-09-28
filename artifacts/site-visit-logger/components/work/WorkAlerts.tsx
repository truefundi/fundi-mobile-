import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COMMISSION_RATE, formatMoney, STATUS_LABEL } from '@/constants/jobs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

/** The technician's notifications: jobs on offer, and the ones they took. */
export function WorkAlerts() {
  const colors = useColors();
  const { offers: waiting, mine, isAvailable } = useWork();

  const offers = isAvailable ? waiting : [];

  return (
    <View style={styles.list}>
      {!isAvailable ? (
        <View style={[styles.banner, { backgroundColor: colors.muted }]}>
          <Feather name="moon" size={17} color={colors.mutedForeground} />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>
            You are offline, so no jobs are being sent to you.
          </Text>
        </View>
      ) : offers.length > 0 ? (
        <View style={[styles.banner, { backgroundColor: colors.primary }]}>
          <Feather name="bell" size={17} color={colors.primaryForeground} />
          <Text style={[styles.bannerText, { color: colors.primaryForeground }]}>
            {offers.length === 1 ? '1 job waiting for you' : `${offers.length} jobs waiting for you`} — answer from Home.
          </Text>
        </View>
      ) : null}

      {offers.map((job) => (
        <View key={job.id} style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
            <Feather name="briefcase" size={16} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.foreground }]}>New {job.service.toLowerCase()} job</Text>
            <Text style={[styles.text, { color: colors.mutedForeground }]} numberOfLines={1}>
              {job.locationLabel} · {formatMoney(job.visitFee * (1 - COMMISSION_RATE))}
            </Text>
          </View>
        </View>
      ))}

      {mine.map((job) => (
        <View key={job.id} style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.successMuted }]}>
            <Feather name="check" size={16} color={colors.success} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.foreground }]}>Your {job.service.toLowerCase()} job</Text>
            <Text style={[styles.text, { color: colors.mutedForeground }]} numberOfLines={1}>
              {STATUS_LABEL[job.status]} · {job.locationLabel}
            </Text>
          </View>
        </View>
      ))}

      {offers.length === 0 && mine.length === 0 && isAvailable ? (
        <EmptyState
          icon="bell"
          title="Nothing yet"
          text="Job offers and updates on work you have taken will appear here."
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2, marginTop: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 16, marginBottom: 10 },
  bannerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  text: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
