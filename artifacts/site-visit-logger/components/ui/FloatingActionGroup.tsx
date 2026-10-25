import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatbotButton, type ChatbotButtonProps } from './ChatbotButton';
import { SosButton, type SosButtonProps } from './SosButton';

export interface FloatingActionGroupProps {
  /** Hide the AI Chatbot button. Default false. */
  hideBot?: boolean;
  /** Hide the SOS emergency button. Default false. */
  hideSos?: boolean;
  /** Custom click handler for AI Chatbot button. */
  onPressBot?: () => void;
  /** Custom click handler for SOS button. */
  onPressSos?: () => void;
  /** Custom props passed down to ChatbotButton. */
  botProps?: Partial<ChatbotButtonProps>;
  /** Custom props passed down to SosButton. */
  sosProps?: Partial<SosButtonProps>;
  /** Distance from the bottom of the screen in pixels. */
  bottomOffset?: number;
  /** Distance from the right edge of the screen in pixels. */
  rightOffset?: number;
  /** Whether the container sits above a bottom tab navigation bar. Defaults to true. */
  isTabScreen?: boolean;
  /** Horizontal alignment of stacked buttons: 'center' | 'flex-end'. Defaults to 'center'. */
  alignItems?: 'center' | 'flex-end';
  /** Additional wrapper style. */
  style?: StyleProp<ViewStyle>;
  /** Test identifier. */
  testID?: string;
}

/**
 * Floating action group overlay positioned in the bottom-right corner.
 * Vertically stacks the Chatbot button at the top and the prominent SOS button at the bottom.
 * If both buttons are hidden, the container renders null.
 */
export function FloatingActionGroup({
  hideBot = false,
  hideSos = false,
  onPressBot,
  onPressSos,
  botProps,
  sosProps,
  bottomOffset,
  rightOffset,
  isTabScreen = true,
  alignItems = 'center',
  style,
  testID = 'floating-action-group',
}: FloatingActionGroupProps) {
  const insets = useSafeAreaInsets();

  // If both buttons are hidden, render null
  if (hideBot && hideSos) {
    return null;
  }

  // Calculate default bottom position respecting safe area insets and tab bar
  const defaultBottom = isTabScreen
    ? Platform.OS === 'web'
      ? 96
      : insets.bottom + 76
    : Platform.OS === 'web'
      ? 24
      : insets.bottom + 16;

  const resolvedBottom = bottomOffset ?? defaultBottom;
  const resolvedRight = rightOffset ?? Math.max(insets.right + 18, 18);

  return (
    <View
      pointerEvents="box-none"
      testID={testID}
      style={[
        styles.container,
        {
          bottom: resolvedBottom,
          right: resolvedRight,
          alignItems,
        },
        style,
      ]}
    >
      {!hideBot && (
        <ChatbotButton
          onPress={onPressBot}
          {...botProps}
        />
      )}
      {!hideSos && (
        <SosButton
          onPress={onPressSos}
          {...sosProps}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    gap: 12,
    zIndex: 999,
  },
});
