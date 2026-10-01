import { Ionicons } from '@expo/vector-icons';
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
  /** Trailing icon, e.g. an arrow on a "next step" action. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** The compact build for actions inside cards and empty states. */
  size?: 'large' | 'small';
  testID?: string;
  style?: ViewStyle;
};

/**
 * The single call-to-action used across the journey. Solid fills only —
 * the Fundi brand rules exclude gradients everywhere.
 */
export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, size = 'large', testID, style }: Props) {
  const colors = useColors();
  const isInactive = disabled || loading;
  const small = size === 'small';

  const palette: Record<Variant, { background: string; text: string; border: string }> = {
    primary: { background: colors.primary, text: colors.primaryForeground, border: colors.primary },
    secondary: { background: colors.secondary, text: colors.secondaryForeground, border: colors.secondary },
    outline: { background: colors.card, text: colors.foreground, border: colors.border },
    danger: { background: colors.card, text: colors.destructive, border: colors.destructive },
  };
  const tone = palette[variant];
  const textColor = isInactive ? colors.mutedForeground : tone.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isInactive, busy: !!loading }}
      testID={testID}
      onPress={isInactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        {
          backgroundColor: isInactive ? colors.muted : tone.background,
          borderColor: isInactive ? colors.border : tone.border,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
        <Text numberOfLines={1} style={[styles.label, small && styles.smallLabel, { color: textColor }]}>
          {label}
        </Text>
        {icon && !loading ? <Ionicons name={icon} size={small ? 16 : 18} color={textColor} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  small: { minHeight: 44, borderRadius: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  label: { fontFamily: 'Inter_700Bold', fontSize: 15, flexShrink: 1 },
  smallLabel: { fontSize: 14 },
});
