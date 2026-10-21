import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

type CountryFlagProps = {
  code: string;
  fallbackEmoji?: string;
  size?: number;
};

/**
 * Renders an authentic, full-color country flag image across all platforms (including Windows),
 * eliminating the issue where Windows standard fonts display Unicode flags as two-letter country codes.
 */
export function CountryFlag({ code, fallbackEmoji, size = 18 }: CountryFlagProps) {
  const [hasError, setHasError] = useState(false);
  const iso = code.toLowerCase();
  const flagUrl = `https://flagcdn.com/w80/${iso}.png`;

  if (hasError && fallbackEmoji) {
    return <Text style={{ fontSize: size }}>{fallbackEmoji}</Text>;
  }

  return (
    <View style={[styles.container, { width: Math.round(size * 1.45), height: size }]}>
      <Image
        source={{ uri: flagUrl }}
        style={styles.image}
        contentFit="cover"
        transition={150}
        onError={() => setHasError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    backgroundColor: '#E5E7EB',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
