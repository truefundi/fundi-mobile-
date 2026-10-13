import { vibrate, notify } from '@/lib/haptics';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/ui/PageHeading';
import { useColors } from '@/hooks/useColors';
import { useProfile } from '@/context/ProfileContext';
import { PLACE_ICON, type SavedPlace } from '@/constants/places';

export default function SavedLocationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedPlaces, addSavedPlace, updateSavedPlace, removeSavedPlace } = useProfile();

  const [isCapturing, setIsCapturing] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [labelInput, setLabelInput] = useState(''); // Name for user recognition
  const [addressInput, setAddressInput] = useState(''); // Address label / landmark / direction
  const [error, setError] = useState('');

  const captureCurrentLocation = async () => {
    setError('');
    setIsCapturing(true);
    try {
      if (Platform.OS !== 'web') {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          setError('Location permission is required to capture your current location.');
          setIsCapturing(false);
          return;
        }
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = current.coords.latitude;
      const lng = current.coords.longitude;
      
      let streetAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (Platform.OS !== 'web') {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (place) {
          streetAddress = [place.street, place.district, place.city].filter(Boolean).join(', ') || streetAddress;
        }
      }

      setEditingPlace({ id: 'new-' + Date.now(), label: 'Current Spot', address: streetAddress, kind: 'home' });
      setLabelInput('Current Spot');
      setAddressInput(streetAddress);
      await vibrate();
    } catch {
      setError('Could not retrieve your current location.');
    } finally {
      setIsCapturing(false);
    }
  };

  const savePlace = async () => {
    if (!labelInput.trim() || !addressInput.trim()) {
      setError('Both name and address label/landmark are required.');
      return;
    }
    if (editingPlace?.id.startsWith('new-')) {
      await addSavedPlace({
        label: labelInput.trim(),
        address: addressInput.trim(),
        kind: 'other',
      });
    } else if (editingPlace) {
      await updateSavedPlace(editingPlace.id, {
        label: labelInput.trim(),
        address: addressInput.trim(),
      });
    }
    setEditingPlace(null);
    notify('success');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8 }]}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.titleTop, { color: colors.foreground }]}>Saved Locations</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content}>
        <PageHeading
          eyebrow="Locations"
          title="Manage your spots"
          subtitle="Capture your current GPS location or edit saved addresses for quick booking."
        />

        <Button
          label="Capture current location"
          icon="navigate"
          loading={isCapturing}
          onPress={captureCurrentLocation}
          style={styles.captureBtn}
        />

        {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}

        {editingPlace && (
          <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.editorTitle, { color: colors.foreground }]}>
              {editingPlace.id.startsWith('new-') ? 'Add Saved Location' : 'Edit Saved Location'}
            </Text>
            
            <Text style={[styles.inputFieldLabel, { color: colors.foreground }]}>Name (for recognition)</Text>
            <TextInput
              value={labelInput}
              onChangeText={setLabelInput}
              placeholder="e.g. Home, Gym, Office"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            />

            <Text style={[styles.inputFieldLabel, { color: colors.foreground }]}>Address Label / Landmark / Direction</Text>
            <TextInput
              value={addressInput}
              onChangeText={setAddressInput}
              placeholder="e.g. Near main gate, blue building 2nd floor"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, minHeight: 70 }]}
            />

            <View style={styles.editorActions}>
              <Button label="Cancel" variant="outline" size="small" onPress={() => setEditingPlace(null)} style={{ flex: 1 }} />
              <Button label="Save Location" size="small" onPress={savePlace} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        <View style={styles.listContainer}>
          {savedPlaces
            .filter((place) => editingPlace?.id !== place.id)
            .map((place) => (
              <View key={place.id} style={[styles.placeItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name={PLACE_ICON[place.kind] || 'location-outline'} size={20} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.placeLabel, { color: colors.foreground }]}>{place.label}</Text>
                  <Text style={[styles.placeAddress, { color: colors.mutedForeground }]} numberOfLines={2}>{place.address}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setEditingPlace(place);
                    setLabelInput(place.label);
                    setAddressInput(place.address);
                  }}
                  style={styles.actionIconBtn}
                >
                  <Feather name="edit-2" size={16} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() => removeSavedPlace(place.id)}
                  style={styles.actionIconBtn}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </View>
            ))}
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleTop: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  captureBtn: { marginTop: 16, marginBottom: 12 },
  errorText: { fontSize: 13, marginTop: 6, fontWeight: '500' },
  editorCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 16, gap: 8 },
  editorTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  inputFieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  editorActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  listContainer: { marginTop: 20, gap: 12 },
  placeItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 12 },
  placeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  placeAddress: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  actionIconBtn: { padding: 8, marginLeft: 4 },
});
