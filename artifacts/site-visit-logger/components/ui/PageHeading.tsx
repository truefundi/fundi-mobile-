import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  style?: ViewStyle;
};

/**
 * Eyebrow, title and subtitle at the top of a screen. Tabs, journey stages,
 * the request form and sign-in all used slightly different sizes for the same
 * thing; this is the one size.
 */
export function PageHeading({ eyebrow, title, subtitle, style }: Props) {
  const colors = useColors();
  return (
    <View style={style}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.7, lineHeight: 34 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 380 },
});
