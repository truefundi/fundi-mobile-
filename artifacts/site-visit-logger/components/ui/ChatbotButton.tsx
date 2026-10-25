import React, { useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { vibrate } from '@/lib/haptics';

export interface ChatbotButtonProps {
  /** Optional press handler. Defaults to routing to /chatbot. */
  onPress?: () => void;
  /** Size (width & height) in pixels. Defaults to 56. */
  size?: number;
  /** Custom corner radius. Defaults to 16 (squircle profile for 56px button). */
  borderRadius?: number;
  /** Icon name from MaterialCommunityIcons: defaults to 'robot'. */
  iconName?: 'robot' | 'robot-outline' | keyof typeof MaterialCommunityIcons.glyphMap;
  /** Custom icon size in pixels. Defaults to proportional (28px for 56px button). */
  iconSize?: number;
  /** Additional container styling. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label for screen readers. */
  accessibilityLabel?: string;
  /** Accessibility hint. */
  accessibilityHint?: string;
  /** Test identifier. */
  testID?: string;
}

/**
 * Modern squircle floating action button for the Fundi AI Chatbot.
 * - Shape: Square with rounded corners (iOS-style continuous curve squircle).
 * - Visuals: Primary brand background, frosted inner bevel, and primary-tinted glow shadow.
 * - Interaction: Tactile spring compression on press.
 */
export function ChatbotButton({
  onPress,
  size = 42,
  borderRadius,
  iconName = 'robot',
  iconSize,
  style,
  accessibilityLabel = 'Open AI Assistant',
  accessibilityHint = 'Chat with Fundi AI for instant support, job estimates, and recommendations',
  testID = 'chatbot-fab-button',
}: ChatbotButtonProps) {
  const colors = useColors();
  const router = useRouter();
  const pressScale = useRef(new Animated.Value(1)).current;

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

    try {
      router.push('/chatbot' as any);
    } catch (error) {
      console.warn('[ChatbotButton] Navigation error:', error);
    }
  };

  const resolvedRadius = borderRadius ?? Math.round(size * 0.28); // ~16px for 56px button
  const resolvedIconSize = iconSize ?? Math.round(size * 0.52); // ~29px for 56px button
  const iconColor = colors.primaryForeground || '#ffffff';
  const primaryBg = colors.primary || '#f97316';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: resolvedRadius,
            backgroundColor: primaryBg,
            shadowColor: primaryBg,
            transform: [{ scale: pressScale }],
          },
          style,
        ]}
      >
        {/* Subtle Frosted Inner Bevel Rim */}
        <View
          style={[
            styles.innerBevel,
            {
              borderRadius: Math.max(0, resolvedRadius - 2),
            },
          ]}
        />

        {/* AI Robot Icon */}
        <MaterialCommunityIcons
          name={iconName}
          size={resolvedIconSize}
          color={iconColor}
          style={styles.icon}
        />

        {/* Micro Sparkle Indicator Accent */}
        <View style={styles.sparkleAccent}>
          <MaterialCommunityIcons name="sparkles" size={10} color={iconColor} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
      },
    }),
  },
  innerBevel: {
    ...StyleSheet.absoluteFillObject,
    margin: 1.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  icon: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  sparkleAccent: {
    position: 'absolute',
    top: 6,
    right: 6,
    opacity: 0.85,
  },
});
