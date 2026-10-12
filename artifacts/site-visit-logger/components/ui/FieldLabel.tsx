import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  label: string;
  /** Adds the red asterisk every required field carries. */
  required?: boolean;
  /** Adds "(optional)" so the two kinds of field are never confused. */
  optional?: boolean;
  style?: TextStyle;
};

/** The label above a form field, with the same required/optional marks on every form. */
export function FieldLabel({ label, required, optional, style }: Props) {
  const colors = useColors();
  return (
    <Text
      accessibilityLabel={required ? `${label}, required` : optional ? `${label}, optional` : label}
      style={[styles.label, { color: colors.foreground }, style]}
    >
      {label}
      {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      {optional ? <Text style={[styles.optional, { color: colors.mutedForeground }]}> (optional)</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 8 },
  optional: { fontFamily: 'Inter_400Regular', fontSize: 13 },
});
