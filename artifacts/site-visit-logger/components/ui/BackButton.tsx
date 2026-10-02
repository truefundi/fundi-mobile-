import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  onPress: () => void;
  testID?: string;
  /** Read out instead of "Go back" when the arrow does something narrower. */
  accessibilityLabel?: string;
};

/** The one back arrow: a 44pt target, so it is easy to hit on any phone. */
export function BackButton({ onPress, testID, accessibilityLabel = 'Go back' }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.muted : 'transparent' }]}
    >
      <Feather name="arrow-left" size={22} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Pulled left so the arrow glyph lines up with the 20pt content gutter.
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
});
