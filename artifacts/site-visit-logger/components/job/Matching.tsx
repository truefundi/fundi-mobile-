import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { urgencyText, type Job } from '@/constants/jobs';
import { MapPanel } from '@/components/ui/MapPanel';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';

/** Spec 6 — the search that runs while Fundi looks for a qualified technician. */
export function Matching({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <StageScreen
      eyebrow="MATCHING"
      title="Finding the right technician"
      subtitle="Looking for qualified technicians near you..."
      hideBack
      footer={<Button label="Cancel request" variant="outline" onPress={onCancel} testID="matching-cancel-button" />}
    >
      <MapPanel searching caption="Searching within 10 km of your location" />

      <View style={styles.pulseRow}>
        <View style={styles.pulseWrap}>
          <Animated.View style={[styles.ripple, { backgroundColor: colors.primary, transform: [{ scale }], opacity }]} />
          <View style={[styles.core, { backgroundColor: colors.primary }]}>
            <Ionicons name="search" size={20} color={colors.primaryForeground} />
          </View>
        </View>
      </View>

      <SectionCard title="Your request">
        <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
        <Text style={[styles.problem, { color: colors.mutedForeground }]} numberOfLines={3}>
          {job.problem}
        </Text>
        <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
          <Meta label="Urgency" value={urgencyText(job)} />
          <Meta label="Location" value={job.locationLabel} />
        </View>
      </SectionCard>
    </StageScreen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.foreground }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pulseRow: { alignItems: 'center', paddingVertical: 8 },
  pulseWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  core: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  service: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  problem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 5 },
  metaRow: { flexDirection: 'row', gap: 16, borderTopWidth: 1, marginTop: 13, paddingTop: 12 },
  meta: { flex: 1 },
  metaLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  metaValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 3 },
});
