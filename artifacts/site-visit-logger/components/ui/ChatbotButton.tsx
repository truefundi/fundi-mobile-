import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { vibrate } from '@/lib/haptics';

export interface ChatbotButtonProps {
  /** Optional press handler. Defaults to routing to /chatbot. */
  onPress?: () => void;
  /** Size (diameter) in pixels. Defaults to 56. */
  size?: number;
  /** Icon name from MaterialCommunityIcons: defaults to 'robot'. */
  iconName?: 'robot' | 'robot-outline' | keyof typeof MaterialCommunityIcons.glyphMap;
  /** Custom icon size in pixels. Defaults to proportional (28px for 56px button). */
  iconSize?: number;
  /** Additional container styling. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label for screen readers. */
  accessibilityLabel?: string;
  /** Test identifier. */
  testID?: string;
  /** Optional tooltip or hint. */
  accessibilityHint?: string;
}

/**
 * Circular floating action button for the Fundi AI Chatbot.
 * Styled with the primary brand color and a prominent robot AI icon in primaryForeground.
 */
export function ChatbotButton({
  onPress,
  size = 56,
  iconName = 'robot',
  iconSize,
  style,
  accessibilityLabel = 'Open AI Assistant',
  accessibilityHint = 'Chat with Fundi AI for instant support, job estimates, and recommendations',
  testID = 'chatbot-fab-button',
}: ChatbotButtonProps) {
  const colors = useColors();
  const router = useRouter();

  const handlePress = () => {
    vibrate();
    if (onPress) {
      onPress();
      return;
    }

    console.log('[ChatbotButton] Routing to /chatbot');
    try {
      router.push('/chatbot' as any);
    } catch (error) {
      console.warn('[ChatbotButton] Navigation error:', error);
    }
  };

  const resolvedIconSize = iconSize ?? Math.round(size * 0.5); // 28px for 56px button
  const borderRadius = Math.round(size / 2);
  const iconColor = colors.primaryForeground || '#ffffff';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: colors.primary,
          shadowColor: '#000000',
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={iconName}
        size={resolvedIconSize}
        color={iconColor}
        style={styles.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.18)',
        cursor: 'pointer',
      },
    }),
  },
  icon: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
