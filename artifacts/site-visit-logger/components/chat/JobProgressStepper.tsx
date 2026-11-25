import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { formatSeconds, useSecondsUntil } from '@/hooks/useCountdown';
import { Button } from '@/components/ui/Button';
import type { Lifecycle, LifecycleStep } from '@/lib/job-lifecycle';

type Props = {
  lifecycle: Lifecycle;
  /** Whether the step tracker is dropped down. */
  expanded: boolean;
  /** Label for the viewer's next step, when they have one (e.g. "Start job"). */
  actionLabel?: string | null;
  onAction?: () => void;
  actionBusy?: boolean;
  /** A second, quieter step (e.g. "Put on hold"). */
  secondaryLabel?: string | null;
  onSecondary?: () => void;
};

/** Tallest the dropped-down tracker gets (steps + a two-line headline). */
const PANEL_HEIGHT = 132;

/**
 * Job progress under the chat header. The four-step tracker
 * (Technician Found → Price Agreed → Job Start → Job End) drops down from the
 * header's progress button; the viewer's next action stays in a slim bar so it
 * is reachable whether the tracker is open or not.
 */
export function JobProgressStepper({ lifecycle, expanded, actionLabel, onAction, actionBusy, secondaryLabel, onSecondary }: Props) {
  const colors = useColors();
  const open = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(open, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 280 : 200,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [expanded, open]);

  const dotColor = (step: LifecycleStep) =>
    step.state === 'done'
      ? colors.success
      : step.state === 'current'
        ? colors.primary
        : step.state === 'stopped'
          ? colors.destructive
          : colors.border;

  const hasAction = Boolean(actionLabel && onAction);
  const hasSecondary = Boolean(secondaryLabel && onSecondary);
  const agreed =
    lifecycle.isPriceAgreed && lifecycle.agreedAmount
      ? `Agreed ${lifecycle.currency} ${lifecycle.agreedAmount.toLocaleString()} · `
      : '';
  // The client's confirmation window, ticking down (the job completes on its own at 0).
  const secondsLeft = useSecondsUntil(lifecycle.completionDueAt);
  const countdown =
    secondsLeft === null
      ? ''
      : secondsLeft > 0
        ? ` It completes on its own in ${formatSeconds(secondsLeft)}.`
        : ' Completing now…';

  return (
    <View testID="job-progress-stepper">
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
        style={[
          styles.panel,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            maxHeight: open.interpolate({ inputRange: [0, 1], outputRange: [0, PANEL_HEIGHT] }),
            opacity: open,
            borderBottomWidth: open.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 1] }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.panelInner,
            { transform: [{ translateY: open.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] },
          ]}
        >
          <View style={styles.row}>
            {lifecycle.steps.map((step, index) => {
              const color = dotColor(step);
              const next = lifecycle.steps[index + 1];
              return (
                <React.Fragment key={step.key}>
                  <View style={styles.step} accessibilityLabel={`${step.label}: ${step.state}`}>
                    <StepDot state={step.state} color={color} index={index} open={open} cardColor={colors.card} />
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
                    <View style={[styles.connector, { backgroundColor: colors.border }]}>
                      <Animated.View
                        style={[
                          styles.connectorFill,
                          {
                            backgroundColor: colors.success,
                            width: step.state === 'done' ? open.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%',
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
          {lifecycle.headline && !hasAction ? (
            <Text style={[styles.headline, { color: colors.mutedForeground }]} numberOfLines={2}>
              {agreed}
              {lifecycle.headline}
              {countdown}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.View>

      {hasAction ? (
        <View
          style={[
            styles.actionBar,
            // Two buttons leave the status line no room beside them: it gets its own row.
            hasSecondary && styles.actionBarStacked,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.actionText, hasSecondary && styles.actionTextStacked, { color: colors.mutedForeground }]} numberOfLines={2}>
            {agreed}
            {lifecycle.headline}
            {countdown}
          </Text>
          <View style={[styles.actionButtons, hasSecondary && styles.actionButtonsStacked]}>
            {hasSecondary ? (
              <Button
                label={secondaryLabel!}
                size="small"
                variant="outline"
                onPress={onSecondary!}
                disabled={actionBusy}
                testID="job-progress-secondary"
              />
            ) : null}
            <Button
              label={actionLabel!}
              size="small"
              onPress={onAction!}
              loading={actionBusy}
              disabled={actionBusy}
              testID="job-progress-action"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A step's dot; the current one pulses gently while the tracker is open. */
function StepDot({
  state,
  color,
  index,
  open,
  cardColor,
}: {
  state: LifecycleStep['state'];
  color: string;
  index: number;
  open: Animated.Value;
  cardColor: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== 'current') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  // Dots pop in one after another as the tracker opens.
  const start = Math.min(0.15 + index * 0.15, 0.6);
  const scale = open.interpolate({ inputRange: [0, start, Math.min(start + 0.3, 1), 1], outputRange: [0.4, 0.4, 1, 1] });

  return (
    <Animated.View style={[styles.dotWrap, { transform: [{ scale }] }]}>
      {state === 'current' ? (
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.dot,
          {
            borderColor: color,
            backgroundColor: state === 'done' ? color : state === 'current' ? color + '22' : 'transparent',
          },
        ]}
      >
        {state === 'done' ? (
          <Ionicons name="checkmark" size={11} color={cardColor} />
        ) : state === 'stopped' ? (
          <Ionicons name="close" size={11} color={color} />
        ) : state === 'current' ? (
          <View style={[styles.innerDot, { backgroundColor: color }]} />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { overflow: 'hidden' },
  panelInner: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 64, alignItems: 'center' },
  dotWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 20, height: 20, borderRadius: 10 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: { width: 8, height: 8, borderRadius: 4 },
  connector: { flex: 1, height: 2, marginTop: 9, borderRadius: 1, overflow: 'hidden' },
  connectorFill: { height: 2 },
  label: { fontSize: 10.5, textAlign: 'center', marginTop: 4, lineHeight: 13 },
  headline: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
  actionButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionButtonsStacked: { justifyContent: 'flex-end' },
  actionBarStacked: { flexDirection: 'column', alignItems: 'stretch' },
  actionTextStacked: { flex: 0 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  actionText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
});

/** Header button that drops the tracker down; shows how far the job has come. */
export function ProgressToggle({
  expanded,
  onPress,
  lifecycle,
}: {
  expanded: boolean;
  onPress: () => void;
  lifecycle: Lifecycle;
}) {
  const colors = useColors();
  const spin = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(spin, { toValue: expanded ? 1 : 0, friction: 7, tension: 80, useNativeDriver: false }).start();
  }, [expanded, spin]);
  const done = lifecycle.steps.filter((step) => step.state === 'done').length;
  const stopped = lifecycle.steps.some((step) => step.state === 'stopped');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Hide job progress' : 'Show job progress'}
      accessibilityState={{ expanded }}
      onPress={onPress}
      testID="chat-progress-toggle"
      hitSlop={6}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            toggleStyles.button,
            {
              backgroundColor: expanded ? colors.primary : colors.secondary,
              borderColor: expanded ? colors.primary : colors.border,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Ionicons name={expanded ? 'analytics' : 'analytics-outline'} size={18} color={expanded ? colors.primaryForeground : colors.primary} />
          </Animated.View>
          <View
            style={[
              toggleStyles.badge,
              { backgroundColor: stopped ? colors.destructive : done === 4 ? colors.success : colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[toggleStyles.badgeText, { color: stopped || done === 4 ? '#ffffff' : colors.foreground }]}>
              {done}/4
            </Text>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const toggleStyles = StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    bottom: -5,
    right: -7,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 3,
    minWidth: 22,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 8.5 },
});
