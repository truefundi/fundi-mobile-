import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Trailing icon, e.g. an arrow on a "next step" action. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Feather icon (leading by default). */
  featherIcon?: keyof typeof Feather.glyphMap;
  iconPosition?: 'leading' | 'trailing';
  /** The compact build for actions inside cards and empty states. */
  size?: 'large' | 'small';
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Override the label color, e.g. white text on a solid background. */
  textColor?: string;
};

/**
 * The single call-to-action used across the journey.
 * In dark mode, buttons have a black fill with an orange outline to ensure high-contrast, comfortable visibility.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  featherIcon,
  iconPosition = 'leading',
  size = 'large',
  testID,
  style,
  textColor,
}: Props) {
  const colors = useColors();
  const { isDark } = useTheme();
  const isInactive = disabled || loading;
  const small = size === 'small';

  const palette: Record<Variant, { background: string; text: string; border: string }> = isDark
    ? {
        primary: {
          background: '#000000',
          text: '#f97316',
          border: '#f97316',
        },
        secondary: {
          background: '#000000',
          text: '#f97316',
          border: '#f97316',
        },
        outline: {
          background: '#000000',
          text: '#f97316',
          border: '#f97316',
        },
        danger: {
          background: '#000000',
          text: '#ef4444',
          border: '#ef4444',
        },
      }
    : {
        primary: { background: colors.primary, text: colors.primaryForeground, border: colors.primary },
        secondary: { background: colors.secondary, text: colors.secondaryForeground, border: colors.secondary },
        outline: { background: colors.card, text: colors.foreground, border: colors.border },
        danger: { background: colors.card, text: colors.destructive, border: colors.destructive },
      };

  const tone = palette[variant];
  const defaultTextColor = isInactive ? (isDark ? '#666666' : colors.mutedForeground) : tone.text;
  const textColorValue = textColor ?? defaultTextColor;

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
          backgroundColor: isInactive ? (isDark ? '#000000' : colors.muted) : tone.background,
          borderColor: isInactive ? (isDark ? '#333333' : colors.border) : tone.border,
          borderWidth: isDark ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={textColorValue} /> : null}
        {!loading && featherIcon && iconPosition === 'leading' ? (
          <Feather name={featherIcon} size={small ? 16 : 18} color={textColorValue} />
        ) : null}
        <Text numberOfLines={1} style={[styles.label, small && styles.smallLabel, { color: textColorValue }]}>
          {label}
        </Text>
        {!loading && featherIcon && iconPosition === 'trailing' ? (
          <Feather name={featherIcon} size={small ? 16 : 18} color={textColorValue} />
        ) : null}
        {!loading && !featherIcon && icon ? (
          <Ionicons name={icon} size={small ? 16 : 18} color={textColorValue} />
        ) : null}
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
