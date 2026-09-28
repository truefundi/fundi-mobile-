import React from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Job } from '@/constants/jobs';
import { EN_ROUTE_MS } from '@/constants/simulation';
import { MapPanel } from '@/components/ui/MapPanel';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useCountdown } from '@/hooks/useCountdown';
import { useColors } from '@/hooks/useColors';

/** Spec 10 — live tracking while the technician travels to the customer. */
export function Tracking({ job }: { job: Job }) {
  const colors = useColors();
  const { progress, remainingSeconds } = useCountdown(job.statusSince, EN_ROUTE_MS);

  if (!job.technician) return null;
  const firstName = job.technician.name.split(' ')[0];

  // Scale the technician's real ETA down onto the simulated travel time.
  const etaMinutes = Math.max(Math.ceil((remainingSeconds / (EN_ROUTE_MS / 1000)) * job.technician.etaMinutes), 1);
  const distanceLeft = (job.technician.distanceKm * (1 - progress)).toFixed(1);

  const call = () => {
    Linking.openURL(`tel:${job.technician!.phone.replace(/\s/g, '')}`).catch(() => {
      // No dialer (simulator or web) — nothing to recover, the number is on screen.
    });
  };
  const message = () => {
    const separator = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${job.technician!.phone.replace(/\s/g, '')}${separator}body=Hi, about my Fundi job ${job.reference}`).catch(() => {
      // Same as above: the number stays visible for manual contact.
    });
  };

  return (
    <StageScreen eyebrow="ON THE WAY" title={`${firstName} is on the way`} hideBack>
      <MapPanel progress={progress} height={260} caption={`${distanceLeft} km away`} />

      <SectionCard>
        <View style={styles.etaRow}>
          <View>
            <Text style={[styles.etaLabel, { color: colors.mutedForeground }]}>ESTIMATED ARRIVAL</Text>
            <Text style={[styles.eta, { color: colors.foreground }]}>{etaMinutes} min</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: colors.infoMuted }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.info }]} />
            <Text style={[styles.statusText, { color: colors.info }]}>On the way</Text>
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <View style={[styles.technicianRow, { borderTopColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.initials, { color: colors.primary }]}>{job.technician.initials}</Text>
          </View>
          <View style={styles.identity}>
            <Text style={[styles.name, { color: colors.foreground }]}>{job.technician.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {job.technician.rating.toFixed(1)} · {job.technician.skill}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <ContactButton icon="phone" label="Call" onPress={call} testID="tracking-call-button" />
          <ContactButton icon="message-square" label="Message" onPress={message} testID="tracking-message-button" />
        </View>
      </SectionCard>

      <SectionCard title="Service address">
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={[styles.address, { color: colors.foreground }]}>{job.locationLabel}</Text>
        </View>
      </SectionCard>
    </StageScreen>
  );
}

function ContactButton({ icon, label, onPress, testID }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; testID: string }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.contact, { backgroundColor: colors.secondary, opacity: pressed ? 0.72 : 1 }]}
    >
      <Feather name={icon} size={17} color={colors.primary} />
      <Text style={[styles.contactText, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  etaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  etaLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  eta: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -1, marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 14 },
  progressFill: { height: 6, borderRadius: 3 },
  technicianRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, marginTop: 15, paddingTop: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  identity: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contact: { flex: 1, minHeight: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  contactText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  addressRow: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  address: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
});
