import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type TimelineStep = {
  label: string;
  state: 'done' | 'active' | 'pending';
};

/** Vertical progress list used by the diagnosis and repair stages. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  const colors = useColors();
  return (
    <View style={styles.list}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const tint =
          step.state === 'done' ? colors.success : step.state === 'active' ? colors.primary : colors.border;
        return (
          <View key={step.label} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: step.state === 'pending' ? colors.card : tint,
                    borderColor: tint,
                  },
                ]}
              >
                {step.state === 'done' && <Feather name="check" size={12} color={colors.primaryForeground} />}
                {step.state === 'active' && <View style={[styles.pulse, { backgroundColor: colors.primaryForeground }]} />}
              </View>
              {!isLast && <View style={[styles.connector, { backgroundColor: step.state === 'done' ? colors.success : colors.border }]} />}
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: step.state === 'pending' ? colors.mutedForeground : colors.foreground,
                  fontFamily: step.state === 'active' ? 'Inter_700Bold' : 'Inter_500Medium',
                },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 4 },
  row: { flexDirection: 'row', gap: 13 },
  rail: { alignItems: 'center', width: 22 },
  marker: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pulse: { width: 7, height: 7, borderRadius: 4 },
  connector: { width: 2, flex: 1, minHeight: 22 },
  label: { fontSize: 14, paddingBottom: 20, paddingTop: 1, flex: 1 },
});
