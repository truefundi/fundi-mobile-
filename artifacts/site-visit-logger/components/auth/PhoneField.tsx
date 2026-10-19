import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { groupDigits, nationalDigits, SAMPLE_NUMBER } from '@/constants/auth';
import { DEFAULT_COUNTRY, SUPPORTED_COUNTRIES, type Country } from '@/constants/countries';
import { CountryPickerModal } from '@/components/auth/CountryPickerModal';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { useColors } from '@/hooks/useColors';

type Props = {
  /** The national part only. */
  value: string;
  onChange: (digits: string) => void;
  onSubmit?: () => void;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Defaults to a sample number; pass a mask like 7XX XXX XXX to show the shape instead. */
  placeholder?: string;
  testID?: string;
  /** Optional callback when the selected country changes. */
  onCountryChange?: (country: Country) => void;
  /** Selected country object if controlled externally. */
  selectedCountry?: Country;
};

/**
 * An international phone number input field supporting multi-country selection,
 * flags, and dialing codes while preserving national formatting and digits.
 */
export function PhoneField({
  value,
  onChange,
  onSubmit,
  invalid,
  autoFocus,
  placeholder,
  testID,
  onCountryChange,
  selectedCountry: controlledCountry,
}: Props) {
  const colors = useColors();
  const [internalCountry, setInternalCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const activeCountry = controlledCountry ?? internalCountry;

  const handleSelectCountry = (country: Country) => {
    if (!controlledCountry) {
      setInternalCountry(country);
    }
    onCountryChange?.(country);
  };

  return (
    <>
      <View style={[styles.field, { backgroundColor: colors.card, borderColor: invalid ? colors.destructive : colors.border }]}>
        <Pressable
          onPress={() => setIsPickerVisible(true)}
          style={[styles.dialCode, { borderRightColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Select country calling code"
        >
          <CountryFlag code={activeCountry.code} fallbackEmoji={activeCountry.flag} size={16} />
          <Text style={[styles.dialText, { color: colors.foreground }]}>{activeCountry.dialCode}</Text>
          <Feather name="chevron-down" size={13} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
        </Pressable>

        <TextInput
          accessibilityLabel="Phone number"
          testID={testID ?? 'phone-input'}
          value={groupDigits(value)}
          onChangeText={(entered) => onChange(nationalDigits(entered, activeCountry.nationalDigits))}
          onSubmitEditing={onSubmit}
          placeholder={placeholder ?? activeCountry.sampleNumber ?? SAMPLE_NUMBER}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="go"
          autoFocus={autoFocus && Platform.OS !== 'web'}
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>

      <CountryPickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        onSelect={handleSelectCountry}
        selectedCountry={activeCountry}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 62, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  dialCode: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRightWidth: 1, height: 36 },
  flag: { fontSize: 17 },
  dialText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  input: { flex: 1, paddingHorizontal: 13, fontFamily: 'Inter_600SemiBold', fontSize: 17, letterSpacing: 0.6, height: '100%' },
});