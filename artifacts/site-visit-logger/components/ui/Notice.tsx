import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Tone = 'info' | 'success' | 'warning' | 'brand' | 'neutral';

type Props = {
  tone: Tone;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  testID?: string;
};

/**
 * A short reassurance or heads-up under the main content: "nothing is charged
 * yet", "extra work needs your approval". Every stage used to draw its own copy
 * of this; one component keeps the padding and type identical.
 */
export function Notice({ tone, icon, text, testID }: Props) {
  const colors = useColors();
  const palette = {
    info: { background: colors.infoMuted, foreground: colors.info, border: colors.infoMuted },
    success: { background: colors.successMuted, foreground: colors.success, border: colors.successMuted },
    warning: { background: colors.warningMuted, foreground: colors.warningForeground, border: colors.warningMuted },
    brand: { background: colors.secondary, foreground: colors.secondaryForeground, border: colors.secondary },
    neutral: { background: colors.muted, foreground: colors.mutedForeground, border: colors.border },
  }[tone];

  return (
    <View testID={testID} style={[styles.notice, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Ionicons name={icon} size={18} color={palette.foreground} style={styles.icon} />
      <Text style={[styles.text, { color: palette.foreground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, padding: 13, alignItems: 'flex-start' },
  icon: { marginTop: 1 },
  text: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, flex: 1 },
});
