import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  label?: string;
  /** Fills the whole screen; otherwise sits inline in a list. */
  fullScreen?: boolean;
};

/** Spinner with a line saying what is loading, instead of a blank screen. */
export function LoadingState({ label = 'Loading…', fullScreen }: Props) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[fullScreen ? styles.fullScreen : styles.inline, fullScreen ? { backgroundColor: colors.background } : null]}
    >
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  inline: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 13, textAlign: 'center' },
});
