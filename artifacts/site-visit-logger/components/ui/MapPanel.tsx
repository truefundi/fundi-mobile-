import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  /** 0 = technician just left, 1 = technician at the customer. */
  progress?: number;
  /** Draws extra technician markers for the matching search. */
  searching?: boolean;
  caption?: string;
  height?: number;
};

/**
 * Flat stand-in for the live map.
 *
 * react-native-maps needs a custom dev build (it is not in Expo Go on SDK 54)
 * and an Android API key, so the journey ships with this schematic view. Swap
 * this one component for a real MapView and every screen below picks it up.
 */
export function MapPanel({ progress = 0, searching, caption, height = 210 }: Props) {
  const colors = useColors();
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={[styles.map, { backgroundColor: colors.muted, borderColor: colors.border, height }]}>
      {/* Schematic street grid — solid strokes only, no gradients. */}
      <View style={styles.grid} pointerEvents="none">
        {[0, 1, 2, 3].map((line) => (
          <View key={`h-${line}`} style={[styles.gridLine, { backgroundColor: colors.border, top: `${18 + line * 21}%`, height: 1, left: 0, right: 0 }]} />
        ))}
        {[0, 1, 2].map((line) => (
          <View key={`v-${line}`} style={[styles.gridLine, { backgroundColor: colors.border, left: `${24 + line * 25}%`, width: 1, top: 0, bottom: 0 }]} />
        ))}
      </View>

      <View style={[styles.route, { backgroundColor: colors.border }]} />
      <View style={[styles.route, styles.routeDone, { backgroundColor: colors.primary, width: `${8 + clamped * 66}%` }]} />

      {searching &&
        [
          { top: '24%' as const, left: '18%' as const },
          { top: '64%' as const, left: '72%' as const },
          { top: '32%' as const, left: '68%' as const },
        ].map((position) => (
          <View key={`${position.top}-${position.left}`} style={[styles.ghostMarker, position, { borderColor: colors.primary, backgroundColor: colors.card }]}>
            <Ionicons name="construct" size={12} color={colors.primary} />
          </View>
        ))}

      <View style={[styles.marker, styles.technicianMarker, { left: `${6 + clamped * 66}%`, backgroundColor: colors.primary }]}>
        <Ionicons name="construct" size={15} color={colors.primaryForeground} />
      </View>
      <View style={[styles.marker, styles.homeMarker, { backgroundColor: colors.foreground }]}>
        <Ionicons name="home" size={14} color={colors.primaryForeground} />
      </View>

      {caption ? (
        <View style={[styles.caption, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.captionText, { color: colors.mutedForeground }]}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', justifyContent: 'center' },
  grid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute' },
  route: { position: 'absolute', left: '10%', right: '14%', height: 3, borderRadius: 2, top: '50%' },
  routeDone: { right: undefined },
  marker: { position: 'absolute', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', top: '50%', marginTop: -16 },
  technicianMarker: { marginLeft: -4 },
  homeMarker: { right: '10%' },
  ghostMarker: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', bottom: 10, alignSelf: 'center', borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  captionText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
