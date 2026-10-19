import { vibrate, notify } from '@/lib/haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Notice } from '@/components/ui/Notice';
import { PageHeading } from '@/components/ui/PageHeading';
import { useColors } from '@/hooks/useColors';
import { SERVICES } from '@/constants/services';
import { PLACE_ICON, type SavedPlace } from '@/constants/places';
import { useProfile } from '@/context/ProfileContext';
import { useFundi } from '@/context/FundiContext';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
import { normalizeLocationSelection } from '@/lib/location';
import { persistRequestMedia } from '@/lib/requestMedia';

const MAX_VIDEO_SECONDS = 120;
const MAX_PHOTOS = 5;

const STEP_NAMES = ['Details', 'Review'] as const;
const LAST_STEP = STEP_NAMES.length;

const PROBLEM_REQUIRED = 'Tell us what happened so we can find the right technician.';
const ADDRESS_REQUIRED = 'Add the address where the service is needed.';

type Editing = 'service' | 'problem' | 'attached' | 'location' | null;

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

type FileData = {
  uri: string;
  name?: string;
  size?: number;
  mimeType?: string;
};

export default function RequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const router = useRouter();
  const { service: serviceParam } = useLocalSearchParams<{ service?: string }>();
  
  const [service, setService] = useState(serviceParam || SERVICES[0]?.label || 'General Maintenance');
  const { addRequest } = useFundi();
  const { savedPlaces, preferences } = useProfile();
  const defaultAddress = savedPlaces.find((place) => place.id === preferences.defaultPlaceId)?.address;

  const [step, setStep] = useState(1);
  const [problem, setProblem] = useState('');
  
  const [photos, setPhotos] = useState<FileData[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [video, setVideo] = useState<FileData | null>(null);
  const [videoError, setVideoError] = useState('');
  const [videoSeconds, setVideoSeconds] = useState<number>();
  const [isPickingVideo, setIsPickingVideo] = useState(false);

  const [address, setAddress] = useState(defaultAddress ?? '');
  const [currentAddressCoords, setCurrentAddressCoords] = useState<string>('');
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [problemError, setProblemError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [editing, setEditing] = useState<Editing>(null);
  const [draftService, setDraftService] = useState(service);
  const [draftProblem, setDraftProblem] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftCoords, setDraftCoords] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<FileData[]>([]);
  const [draftVideo, setDraftVideo] = useState<FileData | null>(null);
  const [draftError, setDraftError] = useState('');

  useEffect(() => {
    if (defaultAddress) setAddress((current) => (current.trim() ? current : defaultAddress));
  }, [defaultAddress]);

  const hasAddress = address.trim().length > 0;
  const hasProgress = problem.trim().length > 0 || photos.length > 0 || !!video || (hasAddress && address !== defaultAddress);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const goBack = () => {
    setError('');
    if (editing) {
      closeEditor();
      return;
    }
    if (step > 1) {
      setStep(1);
      return;
    }
    if (hasProgress) setConfirmLeave(true);
    else leave();
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) return true;
      goBack();
      return true;
    });
    return () => subscription.remove();
  });

  const handleAddPhoto = async (currentPhotos: FileData[], setPhotoList: React.Dispatch<React.SetStateAction<FileData[]>>, setErr: (msg: string) => void) => {
    setErr('');
    if (currentPhotos.length >= MAX_PHOTOS) {
      setErr(`You can attach a maximum of ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      let result: ImagePicker.ImagePickerResult;
      if (Platform.OS === 'web') {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.78, allowsMultipleSelection: true });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setErr('Allow access to your photos to attach one.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.78, allowsMultipleSelection: true });
      }
      const assets = result.canceled ? [] : result.assets;
      if (assets.length === 0) return;

      const newPhotos: FileData[] = [];
      for (const asset of assets) {
        if (!asset.uri) continue;
        const mimeType = inferUploadMimeType(asset.fileName ?? asset.uri, asset.mimeType) ?? 'image/jpeg';
        if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE_BYTES) {
          setErr(`Each photo must be no larger than ${MAX_UPLOAD_SIZE_LABEL}.`);
          continue;
        }
        newPhotos.push({
          uri: asset.uri,
          name: asset.fileName ?? undefined,
          size: asset.fileSize ?? undefined,
          mimeType,
        });
      }

      setPhotoList((current) => [...current, ...newPhotos].slice(0, MAX_PHOTOS));
      await vibrate();
    } catch {
      setErr('We could not open that photo. Please try again.');
    }
  };

  const handleAddVideo = async (setVid: React.Dispatch<React.SetStateAction<FileData | null>>, setVidErr: (msg: string) => void) => {
    setVidErr('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setVidErr('Allow access to your videos to attach one.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset?.uri) return;
      const mimeType = inferUploadMimeType(asset.fileName ?? asset.uri, asset.mimeType);
      if (!mimeType) {
        setVidErr('We could not verify this video type.');
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE_BYTES) {
        setVidErr(`Video must be under ${MAX_UPLOAD_SIZE_LABEL}.`);
        return;
      }
      const seconds = asset.duration ? asset.duration / 1000 : undefined;
      if (seconds && seconds > MAX_VIDEO_SECONDS) {
        setVidErr(`Video is too long. Max duration is ${MAX_VIDEO_SECONDS / 60} minutes.`);
        return;
      }
      setVid({
        uri: asset.uri,
        name: asset.fileName ?? undefined,
        size: asset.fileSize ?? undefined,
        mimeType,
      });
      setVideoSeconds(seconds);
      await vibrate();
    } catch {
      setVidErr('Could not open video.');
    }
  };

  const handleLocationAction = async (applyCoords: (val: string) => void, failVal: (msg: string) => void) => {
    if (isUsingCurrentLocation) {
      setIsUsingCurrentLocation(false);
      applyCoords('');
      return;
    }

    failVal('');
    setIsLocating(true);
    try {
      let coordsText = '';
      if (Platform.OS === 'web') {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              coordsText = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
              resolve(null);
            },
            () => reject(new Error('Permission denied'))
          );
        });
      } else {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          failVal('Location permission required.');
          setIsLocating(false);
          return;
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coordsText = `${current.coords.latitude.toFixed(6)}, ${current.coords.longitude.toFixed(6)}`;
      }
      setIsUsingCurrentLocation(true);
      applyCoords(coordsText);
    } catch {
      failVal('Could not fetch coordinates.');
    } finally {
      setIsLocating(false);
    }
  };

  const checkDetails = (): boolean => {
    const pErr = problem.trim() ? '' : PROBLEM_REQUIRED;
    const aErr = hasAddress ? '' : ADDRESS_REQUIRED;
    setProblemError(pErr);
    setAddressError(aErr);
    return !pErr && !aErr;
  };

  const next = () => {
    setError('');
    if (step === 1) {
      if (!checkDetails()) {
        notify('warning');
        return;
      }
      setStep(2);
      return;
    }
    submit();
  };

  const submit = async () => {
    if (!checkDetails()) {
      setStep(1);
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedLocation = normalizeLocationSelection({
        coordinates: currentAddressCoords,
        address: address.trim(),
      });
      const persistedPhotos = await persistRequestMedia(photos.map((photo) => ({
        uri: photo.uri,
        name: photo.name,
        mimeType: photo.mimeType,
      })));
      const persistedVideo = video
        ? (await persistRequestMedia([{ uri: video.uri, name: video.name, mimeType: video.mimeType }]))[0]
        : undefined;
      const jobId = await addRequest({
        service,
        problem: problem.trim(),
        urgency: 'Today',
        locationLabel: address.trim(),
        locationLatitude: selectedLocation.latitude,
        locationLongitude: selectedLocation.longitude,
        photos: photos.map((photo, index) => ({
          uri: persistedPhotos[index]!,
          sizeBytes: photo.size,
          mimeType: photo.mimeType,
        })),
        videos: video
          ? [{ uri: persistedVideo!, sizeBytes: video.size, mimeType: video.mimeType }]
          : [],
        photoUri: persistedPhotos[0],
        photoSizeBytes: photos[0]?.size,
        photoMimeType: photos[0]?.mimeType,
        videoUri: persistedVideo,
        videoSizeBytes: video?.size,
        videoMimeType: video?.mimeType,
      });
      await notify('success');
      router.replace({
        pathname: '/select-technician',
        params: { jobId },
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your request could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditor = (line: Editing) => {
    setError('');
    setDraftError('');
    setDraftService(service);
    setDraftProblem(problem);
    setDraftAddress(address);
    setDraftCoords(currentAddressCoords);
    setDraftPhotos([...photos]);
    setDraftVideo(video);
    setEditing(line);
  };

  const closeEditor = () => {
    setDraftError('');
    setEditing(null);
  };

  const saveEditor = () => {
    if (editing === 'service') {
      setService(draftService);
    } else if (editing === 'problem') {
      if (!draftProblem.trim()) return setDraftError(PROBLEM_REQUIRED);
      setProblem(draftProblem);
      setProblemError('');
    } else if (editing === 'attached') {
      setPhotos([...draftPhotos]);
      setVideo(draftVideo);
    } else if (editing === 'location') {
      if (!draftAddress.trim()) return setDraftError(ADDRESS_REQUIRED);
      setAddress(draftAddress);
      setCurrentAddressCoords(draftCoords);
      setAddressError('');
    }
    vibrate();
    closeEditor();
  };

  const errorView = (msg: string, testID = 'request-error') =>
    msg ? (
      <View accessibilityLiveRegion="polite" style={styles.errorRow}>
        <Feather name="alert-circle" size={15} color={colors.destructive} />
        <Text testID={testID} style={[styles.error, { color: colors.destructive }]}>{msg}</Text>
      </View>
    ) : null;

  const renderMediaPicker = (currentPhotos: FileData[], setPhotoList: React.Dispatch<React.SetStateAction<FileData[]>>, currentVid: FileData | null, setVid: React.Dispatch<React.SetStateAction<FileData | null>>, errState: string, setErrState: (m: string) => void) => (
    <View style={styles.mediaContainer}>
      <View style={styles.photoGrid}>
        {currentPhotos.map((p, idx) => (
          <View key={idx} style={styles.thumbnailWrap}>
            <Image source={{ uri: p.uri }} style={styles.thumbnail} />
            <Pressable
              onPress={() => setPhotoList(currentPhotos.filter((_, i) => i !== idx))}
              style={[styles.removeThumb, { backgroundColor: colors.destructive }]}
            >
              <Feather name="x" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
        {currentPhotos.length < MAX_PHOTOS && (
          <Pressable
            onPress={() => handleAddPhoto(currentPhotos, setPhotoList, setErrState)}
            style={[styles.addThumbBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
            <Text style={[styles.addThumbText, { color: colors.primary }]}>Add Photo</Text>
          </Pressable>
        )}
      </View>
      {errState ? <Text style={[styles.mediaError, { color: colors.destructive }]}>{errState}</Text> : null}

      <View style={{ marginTop: 10 }}>
        {currentVid ? (
          <View style={[styles.videoAttachedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="videocam" size={18} color={colors.primary} />
            <Text style={[styles.videoAttachedText, { color: colors.foreground }]} numberOfLines={1}>
              Video attached {videoSeconds ? `(${formatDuration(videoSeconds)})` : ''}
            </Text>
            <Pressable onPress={() => setVid(null)}>
              <Feather name="x" size={16} color={colors.destructive} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => handleAddVideo(setVid, setErrState)}
            style={[styles.addVideoBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="videocam-outline" size={18} color={colors.primary} />
            <Text style={[styles.addVideoText, { color: colors.primary }]}>Add Video (max 2 mins)</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const attachmentSummary = [photos.length ? `${photos.length} photo(s)` : null, video ? 'Video' : null].filter(Boolean).join(' and ');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 12 : insets.top + 8 }]}>
      <BackButton
        onPress={goBack}
        testID="request-back-button"
        accessibilityLabel={editing ? 'Close editor' : step > 1 ? 'Go back' : 'Close request'}
      />
      <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
        Step {step} of {LAST_STEP} · {STEP_NAMES[step - 1]}
      </Text>
      <View style={styles.topSpacer} />
    </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${(step / LAST_STEP) * 100}%` }]} />
      </View>

      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <>
            <PageHeading
              eyebrow={service}
              title="Tell us what you need"
              subtitle="Fill in the required fields to connect with a verified technician."
            />

            <FieldLabel label="Service Type" required style={styles.firstLabel} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceScroll}>
              {SERVICES.map((s) => {
                const selected = service === s.label;
                return (
                  <Pressable
                    key={s.label}
                    onPress={() => setService(s.label)}
                    style={[
                      styles.serviceChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.serviceChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <FieldLabel label="What is the problem?" required style={styles.sectionLabel} />
            <TextInput
              accessibilityLabel="Describe the problem"
              testID="problem-input"
              value={problem}
              onChangeText={(val) => {
                setProblem(val);
                if (problemError) setProblemError('');
              }}
              placeholder="For example: the kitchen tap has been leaking..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.problemInput,
                { backgroundColor: colors.card, borderColor: problemError ? colors.destructive : colors.border, color: colors.foreground },
              ]}
            />
            {errorView(problemError, 'problem-error')}

            <FieldLabel label={`Photos (up to ${MAX_PHOTOS}) & Video (1 max)`} optional style={styles.sectionLabel} />
            {renderMediaPicker(photos, setPhotos, video, setVideo, photoError, setPhotoError)}

            <FieldLabel label="Where is the service needed?" required style={styles.sectionLabel} />
            <AddressFields
              value={address}
              onChange={(val) => {
                setAddress(val);
                if (addressError) setAddressError('');
              }}
              places={savedPlaces}
              hasError={!!addressError}
              isLocating={isLocating}
              isUsingCurrentLocation={isUsingCurrentLocation}
              onLocationAction={() => handleLocationAction(setCurrentAddressCoords, setError)}
            />
            {errorView(addressError, 'address-error')}
            {errorView(error)}
          </>
        )}
        {step === 2 && (
          <>
            <PageHeading
              eyebrow="Almost there"
              title="Review your request"
              subtitle="Tap any line to change details before proceeding."
            />
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ReviewRow
                label="Service"
                value={service}
                onEdit={() => openEditor('service')}
                open={editing === 'service'}
                editor={
                  <View style={styles.editor}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceScroll}>
                      {SERVICES.map((s) => {
                        const sel = draftService === s.label;
                        return (
                          <Pressable
                            key={s.label}
                            onPress={() => setDraftService(s.label)}
                            style={[
                              styles.serviceChip,
                              { backgroundColor: sel ? colors.primary : colors.background, borderColor: sel ? colors.primary : colors.border },
                            ]}
                          >
                            <Text style={[styles.serviceChipText, { color: sel ? colors.primaryForeground : colors.foreground }]}>
                              {s.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <View style={styles.editorActions}>
                      <Button label="Cancel" variant="outline" size="small" onPress={closeEditor} style={styles.editorAction} />
                      <Button label="Save" size="small" icon="checkmark" onPress={saveEditor} style={styles.editorAction} />
                    </View>
                  </View>
                }
              />
              <ReviewRow
                label="Problem"
                value={problem}
                onEdit={() => openEditor('problem')}
                open={editing === 'problem'}
                editor={
                  <View style={styles.editor}>
                    <TextInput
                      value={draftProblem}
                      onChangeText={(val) => setDraftProblem(val)}
                      multiline
                      style={[styles.problemInput, styles.editorInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                    />
                    {errorView(draftError)}
                    <View style={styles.editorActions}>
                      <Button label="Cancel" variant="outline" size="small" onPress={closeEditor} style={styles.editorAction} />
                      <Button label="Save" size="small" icon="checkmark" onPress={saveEditor} style={styles.editorAction} />
                    </View>
                  </View>
                }
              />
              <ReviewRow
                label="Attached"
                value={attachmentSummary || 'Nothing attached'}
                muted={!attachmentSummary}
                onEdit={() => openEditor('attached')}
                open={editing === 'attached'}
                editor={
                  <View style={styles.editor}>
                    {renderMediaPicker(draftPhotos, setDraftPhotos, draftVideo, setDraftVideo, '', () => {})}
                    <View style={styles.editorActions}>
                      <Button label="Cancel" variant="outline" size="small" onPress={closeEditor} style={styles.editorAction} />
                      <Button label="Save" size="small" icon="checkmark" onPress={saveEditor} style={styles.editorAction} />
                    </View>
                  </View>
                }
              />
              <ReviewRow
                label="Address Label"
                value={address}
                onEdit={() => openEditor('location')}
                open={editing === 'location'}
                editor={
                  <View style={styles.editor}>
                    <AddressFields
                      value={draftAddress}
                      onChange={(val) => setDraftAddress(val)}
                      places={savedPlaces}
                      hasError={false}
                      isLocating={isLocating}
                      isUsingCurrentLocation={isUsingCurrentLocation}
                      onLocationAction={() => handleLocationAction(setDraftCoords, setError)}
                      inputBackground={colors.background}
                    />
                    <View style={styles.editorActions}>
                      <Button label="Cancel" variant="outline" size="small" onPress={closeEditor} style={styles.editorAction} />
                      <Button label="Save" size="small" icon="checkmark" onPress={saveEditor} style={styles.editorAction} />
                    </View>
                  </View>
                }
              />
              <ReviewRow
                label="Current Address"
                value={currentAddressCoords || 'Not enabled'}
                muted={!currentAddressCoords}
                last
              />
            </View>
            <Notice tone="brand" icon="shield-checkmark-outline" text="Find technician to dispatch a nearby verified specialist." />
            {editing ? null : errorView(error)}
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 14 },
        ]}
      >
        <Button
          label={step === LAST_STEP ? 'Find technician' : 'Continue'}
          icon={narrow && step === LAST_STEP ? undefined : 'arrow-forward'}
          loading={isSubmitting}
          disabled={!!editing}
          onPress={next}
          style={styles.nextAction}
        />
      </View>

      <ConfirmDialog
        visible={confirmLeave}
        title="Discard this request?"
        message="What you have entered so far will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmLeave(false);
          leave();
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </View>
  );
}

type AddressFieldsProps = {
  value: string;
  onChange: (value: string) => void;
  places: SavedPlace[];
  hasError: boolean;
  isLocating: boolean;
  isUsingCurrentLocation: boolean;
  onLocationAction: () => void;
  inputBackground?: string;
};

function AddressFields({ value, onChange, places, hasError, isLocating, isUsingCurrentLocation, onLocationAction, inputBackground }: AddressFieldsProps) {
  const colors = useColors();

  return (
    <>
      <Button
        label={isUsingCurrentLocation ? 'Remove Location' : 'Add Location'}
        variant="outline"
        icon={isUsingCurrentLocation ? 'close-outline' : 'navigate-outline'}
        onPress={onLocationAction}
        loading={isLocating}
        style={{ marginBottom: 12 }}
      />

      {places.length > 0 && !isUsingCurrentLocation ? (
        <View style={styles.placeRow}>
          {places.map((place) => {
            const selected = value === place.address;
            return (
              <Pressable
                key={place.id}
                onPress={() => onChange(place.address)} // Sets the address label / landmark into the request field
                style={[
                  styles.placeChip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card },
                ]}
              >
                <Ionicons name={PLACE_ICON[place.kind] || 'location-outline'} size={15} color={selected ? colors.primaryForeground : colors.primary} />
                <Text numberOfLines={1} style={[styles.placeChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                  {place.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View
        style={[
          styles.addressCard,
          { backgroundColor: inputBackground ?? colors.card, borderColor: hasError ? colors.destructive : colors.border },
        ]}
      >
        <Ionicons name="location-outline" size={22} color={colors.primary} />
        <TextInput
          accessibilityLabel="Service address"
          value={value}
          onChangeText={onChange}
          placeholder="Street, area or landmark"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.addressText, { color: colors.foreground }]}
        />
      </View>
    </>
  );
}

type ReviewRowProps = {
  label: string;
  value: string;
  onEdit?: () => void;
  muted?: boolean;
  last?: boolean;
  open?: boolean;
  editor?: React.ReactNode;
};

function ReviewRow({ label, value, onEdit, muted, last = false, open, editor }: ReviewRowProps) {
  const colors = useColors();
  const content = (
    <>
      <Text style={[styles.reviewLabel, { color: open ? colors.primary : colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: muted ? colors.mutedForeground : colors.foreground }]} numberOfLines={open ? 1 : 3}>
        {value}
      </Text>
      {onEdit && !open ? <Feather name="edit-2" size={15} color={colors.primary} /> : null}
    </>
  );
  const border = !last ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null;
  if (!onEdit) return <View style={[styles.reviewRow, border]}>{content}</View>;
  return (
    <View style={border}>
      <Pressable
        onPress={open ? undefined : onEdit}
        style={({ pressed }) => [styles.reviewRow, { opacity: pressed && !open ? 0.6 : 1 }]}
      >
        {content}
      </Pressable>
      {open ? editor : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topSpacer: { width: 34 },
  stepText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 },
  firstLabel: { marginTop: 22 },
  sectionLabel: { marginTop: 26 },
  serviceScroll: { gap: 8, paddingVertical: 4 },
  serviceChip: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  serviceChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  problemInput: { minHeight: 120, borderWidth: 1, borderRadius: 14, padding: 14, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  mediaContainer: { gap: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnailWrap: { position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  removeThumb: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addThumbBtn: { width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addThumbText: { fontSize: 10, fontWeight: '600' },
  mediaError: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15, marginTop: 2 },
  videoAttachedCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderWidth: 1, borderRadius: 10 },
  videoAttachedText: { fontSize: 13, flex: 1, marginLeft: 8, fontWeight: '500' },
  addVideoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10 },
  addVideoText: { fontSize: 13, fontWeight: '600' },
  placeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  placeChip: { minHeight: 38, maxWidth: '100%', borderRadius: 19, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13 },
  placeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flexShrink: 1 },
  addressCard: { minHeight: 56, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 6 },
  addressText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, paddingTop: Platform.OS === 'ios' ? 0 : 4, paddingBottom: 0, textAlignVertical: 'center' },
  reviewCard: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, marginTop: 22, marginBottom: 14 },
  reviewRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  reviewLabel: { width: 95, fontFamily: 'Inter_500Medium', fontSize: 13 },
  reviewValue: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  editor: { paddingBottom: 14, gap: 10 },
  editorInput: { minHeight: 100 },
  editorActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  editorAction: { flex: 1 },
  errorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 10 },
  error: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  backAction: { minWidth: 96 },
  backActionNarrow: { minWidth: 76 },
  nextAction: { flex: 1 },
});
