import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { StageScreen } from '@/components/ui/StageScreen';
import { formatPhone, initialsOf } from '@/constants/auth';
import { useProfile } from '@/context/ProfileContext';
import { useColors } from '@/hooks/useColors';
import { pickProfilePhoto } from '@/lib/profilePhoto';

/** Which field an error belongs to, so it shows under that field. */
type ErrorAt = 'photo' | 'name' | 'location' | 'save';

/** Reached from the Profile card: change your picture, name and usual area. */
export default function EditProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile: account, updateProfile } = useProfile();
  const [name, setName] = useState(account?.name ?? '');
  const [location, setLocation] = useState(account?.location ?? '');
  const [photoUri, setPhotoUri] = useState(account?.photoUri);
  const [error, setError] = useState<{ at: ErrorAt; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!account) return null;

  const changed = name !== account.name || location !== account.location || photoUri !== account.photoUri;
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const choosePhoto = async (source: 'library' | 'camera') => {
    setError(null);
    try {
      const result = await pickProfilePhoto(source);
      if ('uri' in result) setPhotoUri(result.uri);
      else if ('denied' in result) {
        setError({ at: 'photo', text: source === 'camera' ? 'Allow camera access to take a photo.' : 'Allow access to your photos to choose one.' });
      }
    } catch {
      setError({ at: 'photo', text: 'That picture could not be opened. Try another one.' });
    }
  };

  const save = async () => {
    if (!changed) return leave();
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({ name, location, photoUri });
      leave();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Your changes could not be saved. Try again.';
      setError({ at: text.includes('name') ? 'name' : text.includes('area') ? 'location' : 'save', text });
    } finally {
      setIsSaving(false);
    }
  };

  const errorFor = (at: ErrorAt) =>
    error?.at === at ? (
      <View style={styles.errorRow} accessibilityLiveRegion="polite">
        <Feather name="alert-circle" size={15} color={colors.destructive} />
        <Text testID={`edit-profile-error-${at}`} style={[styles.error, { color: colors.destructive }]}>{error.text}</Text>
      </View>
    ) : null;

  return (
    <StageScreen
      eyebrow="Your Fundi account"
      title="Edit profile"
      subtitle="Change your picture, name and the area you usually need help in."
      onBack={() => (changed ? setConfirmDiscard(true) : leave())}
      footer={<Button label="Save changes" onPress={save} loading={isSaving} disabled={!changed} testID="edit-profile-save" />}
    >
      <View style={styles.photoBlock}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} contentFit="cover" accessibilityLabel="Your profile picture" />
          ) : (
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initialsOf(name.trim() || account.name)}</Text>
          )}
        </View>
        <View style={styles.photoActions}>
          <Button
            label={photoUri ? 'Change photo' : 'Choose photo'}
            icon="image-outline"
            variant="outline"
            size="small"
            onPress={() => choosePhoto('library')}
            testID="edit-profile-choose-photo"
          />
          {/* Browsers open the same file picker for both, so web gets one button. */}
          {Platform.OS !== 'web' ? (
            <Button label="Take photo" icon="camera-outline" variant="outline" size="small" onPress={() => choosePhoto('camera')} testID="edit-profile-take-photo" />
          ) : null}
          {photoUri ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              testID="edit-profile-remove-photo"
              onPress={() => setPhotoUri(undefined)}
              hitSlop={6}
              style={({ pressed }) => [styles.removeLink, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.removeText, { color: colors.destructive }]}>Remove photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {errorFor('photo')}

      <View>
        <FieldLabel label="Full name" required style={styles.fieldLabel} />
        <TextInput
          accessibilityLabel="Full name"
          testID="edit-profile-name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error?.at === 'name') setError(null);
          }}
          placeholder="First and last name"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          autoComplete="name"
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: error?.at === 'name' ? colors.destructive : colors.border, color: colors.foreground },
          ]}
        />
        {errorFor('name')}
      </View>

      <View>
        <FieldLabel label="Your area" required style={styles.fieldLabel} />
        <TextInput
          accessibilityLabel="Your area"
          testID="edit-profile-location"
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            if (error?.at === 'location') setError(null);
          }}
          placeholder="e.g. Kimihurura, Kigali"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: error?.at === 'location' ? colors.destructive : colors.border, color: colors.foreground },
          ]}
        />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Shown at the top of Home. Each request still asks for the exact address.</Text>
        {errorFor('location')}
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Phone number</Text>
        <View style={[styles.input, styles.readOnly, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text testID="edit-profile-phone" style={[styles.readOnlyText, { color: colors.mutedForeground }]}>{formatPhone(account.phone)}</Text>
          <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>You sign in with this number, so it cannot be changed here.</Text>
      </View>

      {errorFor('save')}

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard your changes?"
        message="Your profile stays as it was."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          leave();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  photoBlock: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 92, height: 92 },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 30 },
  photoActions: { flex: 1, gap: 8, alignItems: 'flex-start' },
  removeLink: { minHeight: 32, justifyContent: 'center' },
  removeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  fieldLabel: { marginTop: 8 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Inter_500Medium', fontSize: 15 },
  readOnly: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readOnlyText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 6 },
  errorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 10 },
  error: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
});
