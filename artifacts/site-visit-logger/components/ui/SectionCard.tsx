import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  title?: string;
  children: ReactNode;
  /** Draws the card in the brand colour, for emphasis blocks like totals. */
  emphasis?: boolean;
};

export function SectionCard({ title, children, emphasis }: Props) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: emphasis ? colors.primary : colors.card,
          borderColor: emphasis ? colors.primary : colors.border,
        },
      ]}
    >
      {title ? (
        <Text style={[styles.title, { color: emphasis ? colors.primaryForeground : colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3, marginBottom: 11 },
});
