import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  label: string;
  value: string;
  /** Emphasised total row. */
  strong?: boolean;
  /** Credits such as the visit fee already paid. */
  credit?: boolean;
  hint?: string;
};

export function MoneyRow({ label, value, strong, credit, hint }: Props) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.labelColumn}>
        <Text
          style={[
            styles.label,
            { color: strong ? colors.foreground : colors.mutedForeground, fontFamily: strong ? 'Inter_700Bold' : 'Inter_500Medium', fontSize: strong ? 15 : 13 },
          ]}
        >
          {label}
        </Text>
        {hint ? <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      </View>
      <Text
        style={[
          styles.value,
          {
            color: credit ? colors.success : colors.foreground,
            fontFamily: strong ? 'Inter_700Bold' : 'Inter_600SemiBold',
            fontSize: strong ? 16 : 14,
          },
        ]}
      >
        {credit ? `-${value}` : value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingVertical: 7 },
  labelColumn: { flex: 1 },
  label: { lineHeight: 19 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2, lineHeight: 15 },
  value: { textAlign: 'right' },
});
