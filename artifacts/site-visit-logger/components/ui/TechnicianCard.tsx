import React from 'react';
import { Ionicons, Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Technician } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';

type Props = {
  technician: Technician;
  /** Line under the name, e.g. "Accepted your request". */
  caption?: string;
  compact?: boolean;
};

export function TechnicianCard({ technician, caption, compact }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, compact && styles.compact]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.initials, { color: colors.primary }]}>{technician.initials}</Text>
        </View>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{technician.name}</Text>
            <Ionicons name="shield-checkmark" size={15} color={colors.success} />
          </View>
          <Text style={[styles.skill, { color: colors.mutedForeground }]}>{technician.skill}</Text>
          {caption ? <Text style={[styles.caption, { color: colors.success }]}>{caption}</Text> : null}
        </View>
        <View style={styles.ratingBlock}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={[styles.rating, { color: colors.foreground }]}>{technician.rating.toFixed(1)}</Text>
          </View>
          <Text style={[styles.jobs, { color: colors.mutedForeground }]}>{technician.jobsCompleted.toLocaleString('en-US')} jobs</Text>
        </View>
      </View>
      {!compact && (
        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          <Stat icon="clock" label="ETA" value={`${technician.etaMinutes} min`} />
          <Stat icon="map-pin" label="Distance" value={`${technician.distanceKm} km`} />
          <Stat icon="award" label="Experience" value={`${technician.yearsExperience} yrs`} />
        </View>
      )}
    </View>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Feather name={icon} size={15} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  compact: { padding: 13 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  identity: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 16, flexShrink: 1 },
  skill: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  caption: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 6 },
  ratingBlock: { alignItems: 'flex-end' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  jobs: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  stats: { flexDirection: 'row', borderTopWidth: 1, marginTop: 14, paddingTop: 13 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
