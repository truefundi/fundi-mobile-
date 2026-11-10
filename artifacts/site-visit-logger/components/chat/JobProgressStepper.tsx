import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import type { Lifecycle, LifecycleStep } from '@/lib/job-lifecycle';

type Props = {
  lifecycle: Lifecycle;
  /** Label for the viewer's next step, when they have one (e.g. "Start job"). */
  actionLabel?: string | null;
  onAction?: () => void;
  actionBusy?: boolean;
};

/**
 * Compact four-step tracker shown under the chat header:
 * Technician Found → Price Agreed → Job Start → Job End.
 * Labels and the highlighted action differ for clients and technicians
 * (see `deriveLifecycle`).
 */
export function JobProgressStepper({ lifecycle, actionLabel, onAction, actionBusy }: Props) {
  const colors = useColors();

  const dotColor = (step: LifecycleStep) =>
    step.state === 'done'
      ? colors.success
      : step.state === 'current'
        ? colors.primary
        : step.state === 'stopped'
          ? colors.destructive
          : colors.border;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]} testID="job-progress-stepper">
      <View style={styles.row}>
        {lifecycle.steps.map((step, index) => {
          const color = dotColor(step);
          const next = lifecycle.steps[index + 1];
          return (
            <React.Fragment key={step.key}>
              <View style={styles.step} accessibilityLabel={`${step.label}: ${step.state}`}>
                <View
                  style={[
                    styles.dot,
                    {
                      borderColor: color,
                      backgroundColor: step.state === 'done' ? color : step.state === 'current' ? color + '22' : 'transparent',
                    },
                  ]}
                >
                  {step.state === 'done' ? (
                    <Ionicons name="checkmark" size={11} color={colors.card} />
                  ) : step.state === 'stopped' ? (
                    <Ionicons name="close" size={11} color={color} />
                  ) : step.state === 'current' ? (
                    <View style={[styles.innerDot, { backgroundColor: color }]} />
                  ) : null}
                </View>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.label,
                    {
                      color: step.state === 'upcoming' ? colors.mutedForeground : colors.foreground,
                      fontFamily: step.state === 'current' ? 'Inter_600SemiBold' : 'Inter_500Medium',
                    },
                  ]}
                >
                  {step.label}
                </Text>
              </View>
              {next ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: step.state === 'done' ? colors.success : colors.border },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      {lifecycle.headline ? (
        <View style={styles.footer}>
          <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={2}>
            {lifecycle.isPriceAgreed && lifecycle.agreedAmount
              ? `Agreed ${lifecycle.currency} ${lifecycle.agreedAmount.toLocaleString()} · `
              : ''}
            {lifecycle.headline}
          </Text>
          {actionLabel && onAction ? (
            <Button
              label={actionLabel}
              size="small"
              onPress={onAction}
              loading={actionBusy}
              disabled={actionBusy}
              testID="job-progress-action"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 64, alignItems: 'center' },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: { width: 8, height: 8, borderRadius: 4 },
  connector: { flex: 1, height: 2, marginTop: 9, borderRadius: 1 },
  label: { fontSize: 10.5, textAlign: 'center', marginTop: 4, lineHeight: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  headline: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
});
