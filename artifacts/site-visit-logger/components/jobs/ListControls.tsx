import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

/** Pill tabs with a count, shared by the job lists. */
export function Segments<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; count: number }[];
}) {
  const colors = useColors();
  return (
    <View style={[styles.tabs, { backgroundColor: colors.muted }]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={`activity-tab-${option.value}`}
            onPress={() => onChange(option.value)}
            style={[styles.tab, selected && { backgroundColor: colors.card }]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: selected ? colors.foreground : colors.mutedForeground,
                  fontFamily: selected ? 'Inter_700Bold' : 'Inter_500Medium',
                },
              ]}
            >
              {option.value}
            </Text>
            {option.count > 0 ? (
              <View style={[styles.count, { backgroundColor: selected ? colors.primary : colors.border }]}>
                <Text style={[styles.countText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                  {option.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionNote({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionNote, { color: colors.mutedForeground }]}>{text.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderRadius: 23, padding: 4, marginBottom: 16 },
  tab: { flex: 1, minHeight: 40, borderRadius: 20, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  sectionNote: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.6, marginTop: 2 },
});
