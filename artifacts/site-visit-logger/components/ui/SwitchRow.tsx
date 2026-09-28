import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  title: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  testID: string;
  /** Optional leading chip; it fills with the brand colour when the row is on. */
  icon?: keyof typeof Feather.glyphMap;
};

/**
 * One sliding switch in a card, used everywhere the app toggles a state the
 * user owns — going online, and changing role. They are the same control on
 * purpose: both answer "am I on or off", so neither should look like the
 * other's cousin.
 */
export function SwitchRow({ title, hint, value, onValueChange, accessibilityLabel, testID, icon }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: value ? colors.primary : colors.muted }]}>
          <Feather name={icon} size={17} color={value ? colors.primaryForeground : colors.mutedForeground} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.input }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
});
