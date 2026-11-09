import React from 'react';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Technician } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';
import { getServiceIcon } from '@/lib/categories-api';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';

type Props = {
  technician: Technician;
  /** Line under the name, e.g. "Accepted your request". */
  caption?: string;
  compact?: boolean;
  onPress?: () => void;
  showProfileLink?: boolean;
};

export function TechnicianCard({ technician, caption, compact, onPress, showProfileLink = true }: Props) {
  const colors = useColors();
  const router = useRouter();

  const handleOpenProfile = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (technician.id) {
      router.push({
        pathname: `/technician/${technician.id}` as any,
        params: {
          techName: technician.name,
          techService: technician.skill,
          techRating: String(technician.rating),
          techJobsCompleted: String(technician.jobsCompleted),
          techYearsExperience: String(technician.yearsExperience),
          techAvatarUrl: technician.avatarUrl || technician.photoUri || '',
        },
      });
    }
  };

  return (
    <Pressable
      onPress={handleOpenProfile}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        compact && styles.compact,
        pressed && { opacity: 0.88 },
      ]}
    >
      <View style={styles.header}>
        <ProfileAvatar
          uri={technician.avatarUrl || technician.photoUri}
          name={technician.name}
          knownInitials={technician.initials}
          size={compact ? 42 : 50}
        />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{technician.name}</Text>
            <Ionicons name="shield-checkmark" size={15} color={colors.success} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <MaterialCommunityIcons
              name={getServiceIcon(technician.skill) as any}
              size={13}
              color={colors.primary}
            />
            <Text style={[styles.skill, { color: colors.mutedForeground }]}>{technician.skill}</Text>
          </View>
          {caption ? <Text style={[styles.caption, { color: colors.success }]}>{caption}</Text> : null}
        </View>
        <View style={styles.ratingBlock}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={[styles.rating, { color: colors.foreground }]}>{technician.rating.toFixed(1)}</Text>
          </View>
          <Text style={[styles.jobs, { color: colors.mutedForeground }]}>{technician.jobsCompleted.toLocaleString('en-US')} jobs</Text>
          {showProfileLink && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.primary }}>
                View Profile
              </Text>
              <Feather name="arrow-right" size={11} color={colors.primary} />
            </View>
          )}
        </View>
      </View>
      {!compact && (
        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          <Stat icon="clock" label="ETA" value={`${technician.etaMinutes} min`} />
          <Stat
            icon="map-pin"
            label="Distance"
            value={technician.distanceKm === undefined ? 'Unavailable' : `${technician.distanceKm} km`}
          />
          <Stat icon="award" label="Experience" value={`${technician.yearsExperience} yrs`} />
        </View>
      )}
    </Pressable>
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
