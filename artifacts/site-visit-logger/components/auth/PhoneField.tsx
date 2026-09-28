import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { DIAL_CODE, groupDigits, nationalDigits, SAMPLE_NUMBER } from '@/constants/auth';
import { useColors } from '@/hooks/useColors';

type Props = {
  /** The national part only — the +250 is fixed and shown beside the field. */
  value: string;
  onChange: (digits: string) => void;
  onSubmit?: () => void;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Defaults to a sample number; pass a mask like 7XX XXX XXX to show the shape instead. */
  placeholder?: string;
  testID?: string;
};

/**
 * The one place a phone number is typed. The country code is fixed at +250 and
 * only the nine national digits are editable, so the Rwandan format is the
 * only thing that can be entered.
 */
export function PhoneField({ value, onChange, onSubmit, invalid, autoFocus, placeholder, testID }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.field, { backgroundColor: colors.card, borderColor: invalid ? colors.destructive : colors.border }]}>
      <View style={[styles.dialCode, { borderRightColor: colors.border }]}>
        <Text style={styles.flag}>🇷🇼</Text>
        <Text style={[styles.dialText, { color: colors.foreground }]}>{DIAL_CODE}</Text>
      </View>
      <TextInput
        accessibilityLabel="Phone number"
        testID={testID ?? 'phone-input'}
        value={groupDigits(value)}
        onChangeText={(entered) => onChange(nationalDigits(entered))}
        onSubmitEditing={onSubmit}
        placeholder={placeholder ?? SAMPLE_NUMBER}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        returnKeyType="go"
        autoFocus={autoFocus && Platform.OS !== 'web'}
        style={[styles.input, { color: colors.foreground }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 62, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  dialCode: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRightWidth: 1, height: 34 },
  flag: { fontSize: 17 },
  dialText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  input: { flex: 1, paddingHorizontal: 13, fontFamily: 'Inter_600SemiBold', fontSize: 17, letterSpacing: 0.6, height: '100%' },
});
