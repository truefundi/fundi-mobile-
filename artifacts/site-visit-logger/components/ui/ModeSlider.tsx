import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { vibrate } from '@/lib/haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { initialsOf } from '@/constants/auth';
import { useProfile } from '@/context/ProfileContext';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';

const FULL = { height: 58, padding: 5, initials: 16, badge: 17, glyph: 16, font: 15 };
/** The app header: full width, a little slimmer, still spelling out the move. */
const HEADER = { height: 50, padding: 4, initials: 14, badge: 15, glyph: 15, font: 14 };

const COMMIT = 0.45;
const FLICK = 0.4;
const TAP_SLOP = 6;
const CLAIM = 4;
const NATIVE = Platform.OS !== 'web';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type Props = {
  /** `header` is the slimmer bar under the greeting; `full` the larger one on Profile. */
  variant?: 'full' | 'header';
  onPressAvatar?: () => void;
  testID?: string;
};

export function ModeSlider({ variant = 'full', onPressAvatar, testID = 'mode-slider' }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { profile: account } = useProfile();
  const { mode, setMode, profile: workProfile } = useWork();
  const working = mode === 'working';
  const avatarUri = account?.photoUri || workProfile?.profilePictureUrl;

  const size = variant === 'header' ? HEADER : FULL;
  const knob = size.height - size.padding * 2;

  const [trackWidth, setTrackWidth] = useState(0);
  const travel = Math.max(0, trackWidth - knob - size.padding * 2);
  const x = useRef(new Animated.Value(0)).current;
  const sliding = useRef(false);

  // The arrows lean towards where the knob would go, so the bar reads as something to drag.
  const nudge = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(nudge, { toValue: 1, duration: 600, useNativeDriver: NATIVE }),
        Animated.timing(nudge, { toValue: 0, duration: 600, useNativeDriver: NATIVE }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [nudge]);

  useEffect(() => {
    Animated.spring(x, { toValue: working ? travel : 0, useNativeDriver: NATIVE, speed: 14, bounciness: 5 }).start();
  }, [working, travel, x]);

  const change = useMemo(
    () => () => {
      vibrate('medium');
      setMode(working ? 'hiring' : 'working');
      router.navigate('/');
    },
    [working, router, setMode],
  );

  const pan = useMemo(() => {
    const start = working ? travel : 0;
    const direction = working ? -1 : 1;

    const settle = (to: number) =>
      Animated.spring(x, { toValue: to, useNativeDriver: NATIVE, speed: 14, bounciness: 5 }).start();

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        sliding.current = false;
        x.stopAnimation();
      },
      onPanResponderMove: (_event, gesture) => {
        if (Math.abs(gesture.dx) > CLAIM) sliding.current = true;
        x.setValue(clamp(start + gesture.dx, 0, travel));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP) {
          settle(start);
          onPressAvatar?.();
          return;
        }
        const landed = clamp(start + gesture.dx, 0, travel);
        const progress = travel > 0 ? Math.abs(landed - start) / travel : 0;
        const flicked = gesture.vx * direction > FLICK && progress > 0.15;

        if (progress >= COMMIT || flicked) change();
        else settle(start);
      },
      onPanResponderTerminationRequest: () => !sliding.current,
      onPanResponderTerminate: () => settle(start),
    });
  }, [working, travel, change, onPressAvatar, x]);

  const promptOpacity =
    travel > 0 ? x.interpolate({ inputRange: [0, travel], outputRange: working ? [0.35, 1] : [1, 0.35] }) : 1;
  const promptSide = working
    ? { left: size.padding, right: size.padding + knob }
    : { left: size.padding + knob, right: size.padding };
  // Plain verbs: what sliding does, not the name of a mode.
  const target = working ? 'hire' : 'work';
  const arrowShift = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, working ? -4 : 4] });

  return (
    <View
      testID={testID}
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[
        styles.track,
        { height: size.height, borderRadius: size.height / 2, backgroundColor: colors.primary },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Slide to ${target}`}
        testID={`${testID}-prompt`}
        onPress={change}
        style={[styles.prompt, promptSide]}
      >
        <Animated.View style={[styles.promptInner, { opacity: promptOpacity }]}>
          {working ? (
            <Animated.View style={{ transform: [{ translateX: arrowShift }] }}>
              <Feather name="chevrons-left" size={size.glyph + 2} color={colors.primaryForeground} />
            </Animated.View>
          ) : null}
          <Feather name={working ? 'search' : 'tool'} size={size.glyph} color={colors.primaryForeground} />
          <Text numberOfLines={1} style={[styles.label, { color: colors.primaryForeground, fontSize: size.font }]}>
            Slide to {target}
          </Text>
          {working ? null : (
            <Animated.View style={{ transform: [{ translateX: arrowShift }] }}>
              <Feather name="chevrons-right" size={size.glyph + 2} color={colors.primaryForeground} />
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>

      <Animated.View
        accessibilityRole="adjustable"
        accessibilityLabel={working ? 'Working mode' : 'Hiring mode'}
        accessibilityHint={`Slide to ${target}`}
        testID={`${testID}-knob`}
        hitSlop={8}
        style={[
          styles.knob,
          {
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            marginLeft: size.padding,
            backgroundColor: colors.card,
            transform: [{ translateX: x }],
          },
        ]}
        {...pan.panHandlers}
      >
        <ProfileAvatar
          uri={avatarUri}
          name={account?.name || 'User'}
          knownInitials={account ? initialsOf(account.name) : 'U'}
          size={knob}
        />
        <View
          style={[
            styles.knobBadge,
            {
              width: size.badge,
              height: size.badge,
              borderRadius: size.badge / 2,
              backgroundColor: colors.primary,
              borderColor: colors.card,
            },
          ]}
        >
          <Feather name={working ? 'tool' : 'search'} size={size.badge / 2} color={colors.primaryForeground} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { justifyContent: 'center', overflow: 'hidden' },
  prompt: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  promptInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  knob: { alignItems: 'center', justifyContent: 'center' },
  knobText: { fontFamily: 'Inter_700Bold' },
  knobBadge: { position: 'absolute', right: -1, bottom: -1, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
