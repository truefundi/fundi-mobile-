import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
};

/**
 * The single call-to-action used across the journey. Solid fills only —
 * the Fundi brand rules exclude gradients everywhere.
 */
export function Button({ label, onPress, variant = 'primary', disabled, loading, testID, style }: Props) {
  const colors = useColors();
  const isInactive = disabled || loading;

  const palette: Record<Variant, { background: string; text: string; border: string }> = {
    primary: { background: colors.primary, text: colors.primaryForeground, border: colors.primary },
    secondary: { background: colors.secondary, text: colors.secondaryForeground, border: colors.secondary },
    outline: { background: colors.card, text: colors.foreground, border: colors.border },
    danger: { background: colors.card, text: colors.destructive, border: colors.destructive },
  };
  const tone = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isInactive, busy: !!loading }}
      testID={testID}
      onPress={isInactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isInactive ? colors.muted : tone.background,
          borderColor: isInactive ? colors.border : tone.border,
          opacity: pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={isInactive ? colors.mutedForeground : tone.text} />
          <Text style={[styles.label, { color: isInactive ? colors.mutedForeground : tone.text }]}>{label}</Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: isInactive ? colors.mutedForeground : tone.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
