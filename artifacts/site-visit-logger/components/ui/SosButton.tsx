import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { vibrate } from '@/lib/haptics';

export interface SosButtonProps {
  /** Optional press handler. Defaults to triggering the emergency request flow. */
  onPress?: () => void;
  /** Outer circle diameter in pixels. Defaults to 64. */
  size?: number;
  /** Inner badge circle diameter in pixels. Defaults to 46. */
  innerSize?: number;
  /** Deprecated variant flag retained for backwards compatibility. */
  variant?: 'pill' | 'circular';
  /** Toggle radiating radar pulse ring animation. Defaults to true. */
  animatedPulse?: boolean;
  /** Additional container styling. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label for screen readers. Defaults to 'Emergency SOS'. */
  accessibilityLabel?: string;
  /** Test identifier. */
  testID?: string;
}

export function SosButton({
  onPress,
  size = 56,
  innerSize,
  animatedPulse = true,
  style,
  accessibilityLabel = 'Emergency SOS',
  testID = 'sos-fab-button',
}: SosButtonProps) {
  const colors = useColors();
  const router = useRouter();

  // Radar wave animations
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animatedPulse) return;

    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [animatedPulse, pulseAnim]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    vibrate();
    if (onPress) {
      onPress();
      return;
    }

    router.push({
      pathname: '/request',
      params: { service: 'Emergency Service', emergency: 'true' },
    });
  };

  const emergencyRed = colors.destructive || '#ef4444';
  const resolvedInnerSize = innerSize ?? Math.round(size * 0.72);
  const fontSize = Math.round(resolvedInnerSize * 0.38);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.48],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.65, 0.25, 0],
  });

  return (
    <View style={[styles.rootWrapper, { width: size, height: size }, style]}>
      {/* Radiating Radar Aura */}
      {animatedPulse && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: emergencyRed,
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />
      )}

      {/* Main Interactive Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View
          style={[
            styles.outerDisc,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: emergencyRed,
              transform: [{ scale: pressScale }],
            },
          ]}
        >
          {/* Subtle Gloss Bevel Ring */}
          <View
            style={[
              styles.glossRim,
              {
                width: size - 4,
                height: size - 4,
                borderRadius: (size - 4) / 2,
              },
            ]}
          />

          {/* Floating High-Contrast White Inner Disc */}
          <View
            style={[
              styles.innerBadge,
              {
                width: resolvedInnerSize,
                height: resolvedInnerSize,
                borderRadius: resolvedInnerSize / 2,
              },
            ]}
          >
            {/* Live Indicator Beacon Dot */}
            <View style={[styles.beaconDot, { backgroundColor: emergencyRed }]} />

            {/* Crisp Typography */}
            <Text
              style={[
                styles.sosText,
                {
                  color: emergencyRed,
                  fontSize,
                },
              ]}
            >
              SOS
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2.5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  outerDisc: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
        cursor: 'pointer',
      },
    }),
  },
  glossRim: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  innerBadge: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.16,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.14)',
      },
    }),
  },
  beaconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginBottom: 1,
    opacity: 0.9,
  },
  sosText: {
    fontWeight: '900',
    letterSpacing: 1.4,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: undefined,
  },
});