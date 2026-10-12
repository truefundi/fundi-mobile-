import { Feather, Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { StageScreen } from '@/components/ui/StageScreen';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { formatPhone } from '@/constants/auth';
import { PLACE_ICON } from '@/constants/places';
import { useProfile } from '@/context/ProfileContext';
import { useColors } from '@/hooks/useColors';

/** Reached from Profile: the few things a customer sets once and forgets. */
export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile: account, savedPlaces, preferences, updatePreferences } = useProfile();
  const [error, setError] = useState('');

  if (!account) return null;

  const set = (patch: Parameters<typeof updatePreferences>[0]) => {
    setError('');
    updatePreferences(patch).catch(() => setError('That setting could not be saved. Try again.'));
  };

  const memberSince = new Date(account.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <StageScreen
      eyebrow="Your Fundi account"
      title="Settings"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    >
      <View>
        <Text style={[styles.section, { color: colors.foreground }]}>New requests</Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {savedPlaces.length > 0
            ? 'Tap the place new requests should start with. Tap it again to turn it off. You can still change the address on each request.'
            : 'The address a new request starts with. You can still change it on each request.'}
        </Text>
        {savedPlaces.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Save a place first, then choose it here.</Text>
            <Button
              label="Add a saved location"
              icon="location-outline"
              variant="outline"
              size="small"
              onPress={() => router.push('/saved-locations')}
              testID="settings-add-place"
            />
          </View>
        ) : (
          <View accessibilityRole="radiogroup" style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {savedPlaces.map((place, index) => {
              const selected = preferences.defaultPlaceId === place.id;
              return (
                <Pressable
                  key={place.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${place.label}, ${place.address}`}
                  testID={`settings-default-${place.id}`}
                  // Tapping the chosen place again clears it, so there is no separate "none" option.
                  onPress={() => set({ defaultPlaceId: selected ? undefined : place.id })}
                  style={({ pressed }) => [
                    styles.placeRow,
                    index < savedPlaces.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : null,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={[styles.placeIcon, { backgroundColor: selected ? colors.primary : colors.secondary }]}>
                    <Ionicons name={PLACE_ICON[place.kind]} size={18} color={selected ? colors.primaryForeground : colors.primary} />
                  </View>
                  <View style={styles.placeCopy}>
                    <Text numberOfLines={1} style={[styles.placeLabel, { color: colors.foreground }]}>{place.label}</Text>
                    <Text numberOfLines={2} style={[styles.placeAddress, { color: colors.mutedForeground }]}>{place.address}</Text>
                  </View>
                  <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
                    {selected ? <View style={[styles.radioFill, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View>
        <Text style={[styles.section, { color: colors.foreground }]}>Phone</Text>
        <View style={styles.switchWrap}>
          <SwitchRow
            icon="smartphone"
            title="Vibration"
            hint={
              Platform.OS === 'web'
                ? 'Short vibrations when you slide, enter a code or finish a step. Works on phones only.'
                : 'Short vibrations when you slide, enter a code or finish a step.'
            }
            value={preferences.haptics}
            onValueChange={(haptics) => set({ haptics })}
            accessibilityLabel="Vibration"
            testID="settings-haptics"
          />
        </View>
      </View>

      <View>
        <Text style={[styles.section, { color: colors.foreground }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <Feather name="phone" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Phone number</Text>
            <Text testID="settings-phone" style={[styles.rowValue, { color: colors.mutedForeground }]}>{formatPhone(account.phone)}</Text>
          </View>
          <View style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Member since</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{memberSince}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Update profile"
            testID="settings-update-profile"
            onPress={() => router.push('/edit-profile')}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Feather name="user" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>Update profile</Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <View>
        <Text style={[styles.section, { color: colors.foreground }]}>About</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Feather name="info" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>App version</Text>
            <Text testID="settings-version" style={[styles.rowValue, { color: colors.mutedForeground }]}>{version}</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={15} color={colors.destructive} />
          <Text testID="settings-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : null}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25, marginTop: 8 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  placeIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  placeCopy: { flex: 1, minWidth: 0 },
  placeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  placeAddress: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 11, height: 11, borderRadius: 6 },
  switchWrap: { marginTop: 11 },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 15, marginTop: 11 },
  emptyCard: { paddingVertical: 15, gap: 11, alignItems: 'flex-start' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  rowLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14 },
  rowValue: { fontFamily: 'Inter_500Medium', fontSize: 13, flexShrink: 1, textAlign: 'right' },
  errorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  error: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
});
