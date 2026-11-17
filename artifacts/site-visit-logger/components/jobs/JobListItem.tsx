import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { useColors } from '@/hooks/useColors';
import { getServiceIcon } from '@/lib/categories-api';
import type { JobSummary, JobTone } from '@/lib/job-summary';

type Props = {
  service: string;
  summary: JobSummary;
  /** The other person on the job: the technician for clients, the client for technicians. */
  person?: { name: string; avatarUrl?: string } | null;
  location?: string;
  /** When the job was last active. */
  at?: string;
  onPress: () => void;
  /** Extra controls under the card (e.g. accept/decline a new request). */
  footer?: ReactNode;
  testID?: string;
};

export function toneColor(colors: ReturnType<typeof useColors>, tone: JobTone) {
  switch (tone) {
    case 'action':
      return colors.primary;
    case 'progress':
      return colors.primary;
    case 'waiting':
      return colors.warning;
    case 'done':
      return colors.success;
    case 'stopped':
      return colors.destructive;
  }
}

export function shortDate(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * One job in a list, the same for clients and technicians: the service, where
 * it stands in plain words, a four-step progress bar matching the chat
 * tracker, and who it is with. Tapping opens the job.
 */
export function JobListItem({ service, summary, person, location, at, onPress, footer, testID }: Props) {
  const colors = useColors();
  const tint = toneColor(colors, summary.tone);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${service}. ${summary.label}. ${summary.hint}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: summary.yourTurn ? colors.primary + '66' : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: tint + '1A' }]}>
          <MaterialCommunityIcons
            name={(summary.tone === 'stopped' ? 'close-circle-outline' : getServiceIcon(service)) as any}
            size={22}
            color={tint}
          />
        </View>
        <View style={styles.body}>
          <View style={styles.topLine}>
            <Text style={[styles.service, { color: colors.foreground }]} numberOfLines={1}>
              {service}
            </Text>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>{shortDate(at)}</Text>
          </View>
          <View style={styles.statusLine}>
            <Text style={[styles.status, { color: tint }]} numberOfLines={1}>
              {summary.label}
            </Text>
            {summary.yourTurn ? (
              <View style={[styles.turnPill, { backgroundColor: colors.primary }]}>
                <Text style={[styles.turnText, { color: colors.primaryForeground }]}>Your turn</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]} numberOfLines={2}>
            {summary.hint}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.chevron} />
      </View>

      {summary.ongoing ? (
        <View style={styles.progress} accessibilityLabel={`${summary.stepsDone} of 4 steps done`}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  // Done steps green, the current one in the status colour, the rest empty.
                  backgroundColor:
                    index < summary.stepsDone ? colors.success : index === summary.stepsDone ? tint + '99' : colors.border,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {person || location ? (
        <View style={[styles.meta, { borderTopColor: colors.border }]}>
          {person ? (
            <View style={styles.metaItem}>
              <ProfileAvatar uri={person.avatarUrl} name={person.name} size={20} />
              <Text style={[styles.metaText, { color: colors.foreground }]} numberOfLines={1}>
                {person.name}
              </Text>
            </View>
          ) : null}
          {location ? (
            <View style={[styles.metaItem, styles.metaLocation]}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 3 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  service: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15 },
  time: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flexShrink: 1 },
  turnPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  turnText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.2 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  chevron: { alignSelf: 'center' },
  progress: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  metaLocation: { flex: 1, justifyContent: 'flex-end' },
  metaText: { fontFamily: 'Inter_500Medium', fontSize: 12, flexShrink: 1 },
  footer: { flexDirection: 'row', gap: 8 },
});
