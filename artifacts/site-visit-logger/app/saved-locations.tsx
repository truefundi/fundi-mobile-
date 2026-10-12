import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { isSingleKind, MAX_PLACES, PLACE_HINT, PLACE_ICON, PLACE_KINDS, type PlaceKind, type SavedPlace } from '@/constants/places';
import { useProfile } from '@/context/ProfileContext';
import { useColors } from '@/hooks/useColors';

/** The place being added (no id yet) or edited. */
type Draft = { id?: string; kind: PlaceKind; name: string; address: string };

const EMPTY_DRAFT: Draft = { kind: 'Home', name: '', address: '' };

/** Reached from Profile: the addresses a request can use in one tap. */
export default function SavedLocationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { savedPlaces, savePlaces, preferences } = useProfile();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState<SavedPlace | null>(null);

  const full = savedPlaces.length >= MAX_PLACES;
  // Home, Work and School each exist once; a second one would make "pick Home" ambiguous.
  const takenKind = (kind: PlaceKind) =>
    isSingleKind(kind) && savedPlaces.some((place) => place.kind === kind && place.id !== draft?.id);

  const openNew = () => {
    setError('');
    setDraft({ ...EMPTY_DRAFT, kind: PLACE_KINDS.find((kind) => !takenKind(kind)) ?? 'Other' });
  };

  const openEdit = (place: SavedPlace) => {
    setError('');
    setDraft({ id: place.id, kind: place.kind, name: place.kind === 'Other' ? place.label : '', address: place.address });
  };

  const save = async () => {
    if (!draft) return;
    const address = draft.address.trim().replace(/\s+/g, ' ');
    const name = draft.name.trim();
    if (takenKind(draft.kind)) return setError(`You already saved ${draft.kind}. Edit that one instead.`);
    if (draft.kind === 'Other' && name.length < 2) return setError('Give this place a name, like "Mum\'s house".');
    if (address.length < 4) return setError('Enter the address: street, area or a landmark.');

    const place: SavedPlace = {
      id: draft.id ?? `place-${Date.now()}`,
      kind: draft.kind,
      label: draft.kind === 'Other' ? name : draft.kind,
      address,
    };
    setIsSaving(true);
    try {
      await savePlaces(draft.id ? savedPlaces.map((item) => (item.id === draft.id ? place : item)) : [...savedPlaces, place]);
      setDraft(null);
    } catch {
      setError('This place could not be saved. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    await savePlaces(savedPlaces.filter((place) => place.id !== id)).catch(() => undefined);
  };

  const form = draft ? (
    <SectionCard title={draft.id ? 'EDIT PLACE' : 'NEW PLACE'}>
      <FieldLabel label="Type" required />
      <View accessibilityRole="radiogroup" style={styles.kindRow}>
        {PLACE_KINDS.map((kind) => {
          const selected = draft.kind === kind;
          // Already saved: shown, but greyed with a tick, so it is clear why it cannot be picked twice.
          const taken = takenKind(kind);
          return (
            <Pressable
              key={kind}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: taken }}
              accessibilityLabel={taken ? `${kind}, already saved` : kind}
              testID={`place-kind-${kind}`}
              disabled={taken}
              onPress={() => {
                setDraft({ ...draft, kind });
                setError('');
              }}
              style={({ pressed }) => [
                styles.kind,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : taken ? colors.muted : colors.card,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={taken ? 'checkmark-circle' : PLACE_ICON[kind]}
                size={15}
                color={selected ? colors.primaryForeground : taken ? colors.mutedForeground : colors.primary}
              />
              <Text style={[styles.kindText, { color: selected ? colors.primaryForeground : taken ? colors.mutedForeground : colors.foreground }]}>
                {kind}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text testID="place-kind-hint" style={[styles.kindHint, { color: colors.mutedForeground }]}>
        {PLACE_HINT[draft.kind]}
        {PLACE_KINDS.some((kind) => takenKind(kind)) ? ' Greyed types are already saved; edit them in the list.' : ''}
      </Text>

      {draft.kind === 'Other' ? (
        <>
          <FieldLabel label="Name" required style={styles.fieldLabel} />
          <TextInput
            accessibilityLabel="Place name"
            testID="place-name-input"
            value={draft.name}
            onChangeText={(name) => {
              setDraft({ ...draft, name });
              setError('');
            }}
            placeholder="e.g. Mum's house or Gym"
            placeholderTextColor={colors.mutedForeground}
            maxLength={30}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          />
        </>
      ) : null}

      <FieldLabel label="Address" required style={styles.fieldLabel} />
      <View style={[styles.addressBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Ionicons name="location-outline" size={20} color={colors.primary} />
        <TextInput
          accessibilityLabel="Address"
          testID="place-address-input"
          value={draft.address}
          onChangeText={(address) => {
            setDraft({ ...draft, address });
            setError('');
          }}
          placeholder="Street, area or landmark"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.addressInput, { color: colors.foreground }]}
        />
      </View>

      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={15} color={colors.destructive} />
          <Text testID="place-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.formActions}>
        <Button label="Cancel" variant="outline" size="small" onPress={() => setDraft(null)} testID="place-cancel" style={styles.formAction} />
        <Button label="Save place" size="small" onPress={save} loading={isSaving} testID="place-save" style={styles.formAction} />
      </View>
    </SectionCard>
  ) : null;

  return (
    <StageScreen
      eyebrow="Your Fundi account"
      title="Saved locations"
      subtitle="Save home, work, school and any other place you often need help at. Then pick one in a tap when you request a service."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      footer={
        !draft && savedPlaces.length > 0 && !full ? (
          <Button label="Add a place" icon="add" onPress={openNew} testID="place-add" />
        ) : undefined
      }
    >
      {savedPlaces.length === 0 && !draft ? (
        <EmptyState
          icon="map-pin"
          title="No saved places yet"
          text="Save your home, work or school once, and use it in one tap on your next request."
          action={{ label: 'Add a place', onPress: openNew, testID: 'place-add-empty' }}
        />
      ) : null}

      {/* A new place's form sits above the list; an edited place's form takes that place's spot. */}
      {draft && !draft.id ? form : null}

      {savedPlaces.map((place) =>
        draft?.id === place.id ? (
          <React.Fragment key={place.id}>{form}</React.Fragment>
        ) : (
          <View key={place.id} testID={`place-${place.id}`} style={[styles.place, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.placeIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name={PLACE_ICON[place.kind]} size={19} color={colors.primary} />
            </View>
            <View style={styles.placeCopy}>
              <View style={styles.placeTitleRow}>
                <Text numberOfLines={1} style={[styles.placeLabel, { color: colors.foreground }]}>{place.label}</Text>
                {preferences.defaultPlaceId === place.id ? (
                  <View style={[styles.defaultTag, { backgroundColor: colors.successMuted }]}>
                    <Text style={[styles.defaultText, { color: colors.success }]}>Default</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={2} style={[styles.placeAddress, { color: colors.mutedForeground }]}>{place.address}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${place.label}`}
              testID={`place-edit-${place.id}`}
              onPress={() => openEdit(place)}
              style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? colors.muted : 'transparent' }]}
            >
              <Feather name="edit-2" size={17} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${place.label}`}
              testID={`place-delete-${place.id}`}
              onPress={() => setToDelete(place)}
              style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? colors.muted : 'transparent' }]}
            >
              <Feather name="trash-2" size={17} color={colors.destructive} />
            </Pressable>
          </View>
        ),
      )}

      {savedPlaces.length > 0 && !draft ? (
        <Notice
          tone="neutral"
          icon="star-outline"
          text={
            full
              ? `You can save up to ${MAX_PLACES} places. Delete one to add another.`
              : 'Choose which place new requests start with in Settings.'
          }
        />
      ) : null}

      <ConfirmDialog
        visible={!!toDelete}
        title={`Delete ${toDelete?.label ?? 'this place'}?`}
        message="Requests you already made keep their address."
        confirmLabel="Delete place"
        cancelLabel="Keep it"
        destructive
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginTop: 16 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { minHeight: 40, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  kindText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  kindHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 8 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Inter_500Medium', fontSize: 15 },
  addressBox: { minHeight: 54, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 4 },
  addressInput: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, paddingVertical: 8 },
  errorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 12 },
  error: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  formAction: { flex: 1 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingVertical: 12, paddingLeft: 14, paddingRight: 6 },
  placeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  placeCopy: { flex: 1, minWidth: 0 },
  placeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  placeLabel: { fontFamily: 'Inter_700Bold', fontSize: 15, flexShrink: 1 },
  placeAddress: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  defaultTag: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  defaultText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
