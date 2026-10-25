import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  onPress?: () => void;
};

export function EmergencyServiceCard({ onPress }: Props) {
  const colors = useColors();
  const router = useRouter();

  const handlePress = onPress ?? (() => {
    router.push({ pathname: '/request', params: { service: 'Emergency Service', emergency: 'true' } });
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Request emergency service"
      testID="emergency-service-button"
      onPress={handlePress}
      style={({ pressed }) => [styles.emergency, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={styles.emergencyCopy}>
        <Text style={[styles.emergencyKicker, { color: colors.secondary }]}>NEED HELP NOW?</Text>
        <Text style={[styles.emergencyTitle, { color: colors.primaryForeground }]}>Emergency service</Text>
        <Text style={[styles.emergencyText, { color: colors.secondary }]}>Find an available technician near you.</Text>
      </View>
      <View style={[styles.emergencyButton, { backgroundColor: colors.primaryForeground }]}>
        <Ionicons name="arrow-forward" size={20} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emergency: { minHeight: 112, borderRadius: 18, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  emergencyCopy: { flex: 1 },
  emergencyKicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  emergencyTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 6 },
  emergencyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 5 },
  emergencyButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
