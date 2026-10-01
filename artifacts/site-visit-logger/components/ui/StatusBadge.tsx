import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATUS_LABEL, STATUS_TONE, type JobStatus } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';

/**
 * Status pill. Colour is paired with the written label so the state never
 * depends on colour alone.
 */
export function StatusBadge({ status, testID }: { status: JobStatus; testID?: string }) {
  const colors = useColors();
  const tone = STATUS_TONE[status];

  const palette = {
    progress: { background: colors.infoMuted, text: colors.info },
    action: { background: colors.warningMuted, text: colors.warningForeground },
    success: { background: colors.successMuted, text: colors.success },
    danger: { background: colors.destructiveMuted, text: colors.destructive },
  }[tone];

  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: palette.background }]}>
      <View style={[styles.dot, { backgroundColor: palette.text }]} />
      <Text style={[styles.text, { color: palette.text }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
