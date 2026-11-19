import React from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { BusinessType, CompanyDraft, MyCompany } from '@/lib/companies-api';

type Errors = Partial<Record<keyof CompanyDraft, string>>;

/** How a company's review status reads to its owner. */
export const COMPANY_STATUS: Record<MyCompany['verificationStatus'], { label: string; tone: 'success' | 'warning' | 'destructive'; icon: React.ComponentProps<typeof Feather>['name']; hint: string }> = {
  PENDING: { label: 'Under review', tone: 'warning', icon: 'clock', hint: 'Fundi is checking your company. You can still correct its details.' },
  APPROVED: { label: 'Approved', tone: 'success', icon: 'check-circle', hint: 'Your company is verified. Contact Fundi support to change its details.' },
  REJECTED: { label: 'Not approved', tone: 'destructive', icon: 'alert-circle', hint: 'Correct the details and save to send the company for review again.' },
};


const OPTIONS: Array<{ value: BusinessType; title: string; hint: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'INDIVIDUAL', title: 'On my own', hint: 'You take jobs yourself.', icon: 'person-outline' },
  { value: 'COMPANY', title: 'As a company', hint: 'You run a registered business.', icon: 'business-outline' },
];

/** "How do you work?": individual or company owner. */
export function BusinessTypeChoice({ value, onChange }: { value: BusinessType; onChange: (value: BusinessType) => void }) {
  const colors = useColors();
  return (
    <View style={styles.choiceRow} accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            testID={`business-type-${option.value.toLowerCase()}`}
            style={[
              styles.choice,
              {
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary + '12' : colors.background,
              },
            ]}
          >
            <Ionicons name={option.icon} size={20} color={selected ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.choiceTitle, { color: colors.foreground }]}>{option.title}</Text>
            <Text style={[styles.choiceHint, { color: colors.mutedForeground }]}>{option.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type FieldsProps = {
  value: CompanyDraft;
  onChange: (next: CompanyDraft) => void;
  errors?: Errors;
  editable?: boolean;
};

/** Company name, location, contact and description, as the API requires them. */
export function CompanyFields({ value, onChange, errors = {}, editable = true }: FieldsProps) {
  const colors = useColors();
  const field = (
    key: keyof CompanyDraft,
    label: string,
    props: TextInputProps & { optional?: boolean },
  ) => {
    const { optional, ...inputProps } = props;
    return (
      <View style={styles.field} key={key}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {label}{' '}
          {optional ? (
            <Text style={[styles.optional, { color: colors.mutedForeground }]}>(optional)</Text>
          ) : (
            <Text style={{ color: colors.destructive }}>*</Text>
          )}
        </Text>
        <TextInput
          value={value[key]}
          onChangeText={(text) => onChange({ ...value, [key]: text })}
          editable={editable}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={label}
          testID={`company-${key}`}
          {...inputProps}
          style={[
            styles.input,
            inputProps.multiline && styles.multiline,
            {
              backgroundColor: colors.background,
              borderColor: errors[key] ? colors.destructive : colors.border,
              color: colors.foreground,
              opacity: editable ? 1 : 0.7,
            },
          ]}
        />
        {errors[key] ? <Text style={[styles.error, { color: colors.destructive }]}>{errors[key]}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.fields}>
      {field('name', 'Company name', { placeholder: 'e.g. Kigali Plumbing Ltd', maxLength: 160 })}
      {field('location', 'Where the company is based', { placeholder: 'e.g. Kimironko, Gasabo', maxLength: 255 })}
      {field('email', 'Company email', {
        placeholder: 'info@company.rw',
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        maxLength: 254,
      })}
      {field('phoneNumber', 'Company phone', { placeholder: '078 123 4567', keyboardType: 'phone-pad' })}
      {field('description', 'What the company does', {
        optional: true,
        placeholder: 'Services, team size, areas you cover…',
        multiline: true,
        maxLength: 2000,
        textAlignVertical: 'top',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 4 },
  choiceTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 2 },
  choiceHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
  fields: { gap: 10 },
  field: { gap: 6 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  optional: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  multiline: { minHeight: 96 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
