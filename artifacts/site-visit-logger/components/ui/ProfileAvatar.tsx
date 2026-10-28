import React, { useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

/**
 * Computes 1-2 letter uppercase initials from a person or entity name,
 * safely stripping leading emojis, symbols, punctuation, and surrogate pairs.
 */
export function computeParticipantInitials(
  name?: string | null,
  knownInitials?: string | null,
  fallback = '?'
): string {
  if (knownInitials && typeof knownInitials === 'string' && knownInitials.trim()) {
    const clean = knownInitials.trim().replace(/[^\p{L}\p{N}]/gu, '');
    if (clean) return clean.slice(0, 2).toUpperCase();
  }

  if (!name || typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  // Split into words and strip non-letter/non-number characters
  const words = trimmed
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 0);

  if (words.length >= 2) {
    const firstChar = Array.from(words[0])[0];
    const lastChar = Array.from(words[words.length - 1])[0];
    if (firstChar && lastChar) {
      return (firstChar + lastChar).toUpperCase();
    }
  }

  if (words.length === 1 && words[0].length > 0) {
    const firstChar = Array.from(words[0])[0];
    if (firstChar) return firstChar.toUpperCase();
  }

  // Fallback to any unicode letter or number
  const match = trimmed.match(/[\p{L}\p{N}]/u);
  if (match) {
    return match[0].toUpperCase();
  }

  return fallback;
}

export type ProfileAvatarProps = {
  uri?: string | null;
  name?: string | null;
  knownInitials?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Circular profile avatar with reliable fallback to initial letters.
 *
 * Adheres strictly to the Fundi design system:
 * - Solid fill: `colors.secondary` with `colors.border` outline
 * - Text: `colors.primary`, Inter_700Bold, vertically and horizontally centered
 * - Image fallback on load failure or missing photo URI
 */
export function ProfileAvatar({
  uri,
  name,
  knownInitials,
  size = 48,
  style,
  testID,
}: ProfileAvatarProps) {
  const colors = useColors();
  const [imageError, setImageError] = useState(false);

  const initials = useMemo(
    () => computeParticipantInitials(name, knownInitials),
    [name, knownInitials]
  );

  const cleanUri = useMemo(() => {
    if (!uri || typeof uri !== 'string') return null;
    const t = uri.trim();
    if (!t || t === 'null' || t === 'undefined') return null;
    return t;
  }, [uri]);

  const showImage = Boolean(cleanUri && !imageError);
  const fontSize = Math.max(12, Math.round(size * (initials.length > 1 ? 0.36 : 0.40)));

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.secondary,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: cleanUri! }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.initialText,
            {
              fontSize,
              color: colors.primary,
            },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  initialText: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    letterSpacing: -0.5,
  },
});
