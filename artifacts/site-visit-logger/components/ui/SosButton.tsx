import React from 'react';
import {
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
  /** Optional press handler. Defaults to triggering the emergency request completion flow. */
  onPress?: () => void;
  /** Outer circle diameter in pixels. Defaults to 64. */
  size?: number;
  /** Inner badge circle diameter in pixels. Defaults to 44. */
  innerSize?: number;
  /** Deprecated variant flag retained for backwards compatibility. Always renders concentric circular design. */
  variant?: 'pill' | 'circular';
  /** Additional container styling. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label for screen readers. Defaults to 'Emergency SOS'. */
  accessibilityLabel?: string;
  /** Test identifier. */
  testID?: string;
}

/**
 * Concentric circular emergency SOS floating action button.
 * - Outer Circle: Fixed size (64x64) vibrant emergency red (#dc2626 / colors.destructive).
 * - Inner Badge: Concentric white circle (44x44) with bold, high-contrast red "SOS" typography.
 * - Soft, vibrant red glow drop-shadow and active tactile touch feedback.
 * - Triggers the emergency service request completion flow.
 */
export function SosButton({
  onPress,
  size = 64,
  innerSize = 60,
  style,
  accessibilityLabel = 'Emergency SOS',
  testID = 'sos-fab-button',
}: SosButtonProps) {
  const colors = useColors();
  const router = useRouter();

  const handlePress = () => {
    vibrate();
    if (onPress) {
      onPress();
      return;
    }

    console.log('[SosButton] Triggering emergency request completion flow');
    router.push({
      pathname: '/request',
      params: { service: 'Emergency Service', emergency: 'true' },
    });
  };

  const emergencyRed = colors.destructive || '#dc2626';
  const resolvedInnerSize = innerSize ?? Math.round(size * 0.6875); // 44px when size is 64px
  const fontSize = Math.round(resolvedInnerSize * 0.36); // ~16px

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.outerContainer,
        {
          width: size,
          height: size,
          borderRadius: 9999,
          backgroundColor: emergencyRed,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}
    >
      <View
        style={[
          styles.innerBadge,
          {
            width: resolvedInnerSize,
            height: resolvedInnerSize,
            borderRadius: 9999,
            backgroundColor: '#ffffff',
          },
        ]}
      >
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 20px rgba(220, 38, 38, 0.45)',
        cursor: 'pointer',
      },
    }),
  },
  innerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  sosText: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
