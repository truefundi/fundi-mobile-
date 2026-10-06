import { vibrate, notify } from '@/lib/haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Notice } from '@/components/ui/Notice';
import { PageHeading } from '@/components/ui/PageHeading';
import { useColors } from '@/hooks/useColors';
import { PLACE_ICON, type SavedPlace } from '@/constants/places';
import { useProfile } from '@/context/ProfileContext';
import { useFundi } from '@/context/FundiContext';

type Urgency = 'Emergency' | 'Today' | 'Schedule';

/** Long clips are slow to send on mobile data; a minute or two shows the problem. */
const MAX_VIDEO_SECONDS = 120;

/** Two steps: everything we need on one screen, then a review that can be corrected in place. */
const STEP_NAMES = ['Details', 'Review'] as const;
const LAST_STEP = STEP_NAMES.length;

const URGENCIES: Urgency[] = ['Emergency', 'Today', 'Schedule'];

const URGENCY_COPY: Record<Urgency, { text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Emergency: { text: 'Need someone immediately', icon: 'flash-outline' },
  Today: { text: 'As soon as possible today', icon: 'sunny-outline' },
  Schedule: { text: 'Choose a preferred time', icon: 'calendar-outline' },
};

const PROBLEM_REQUIRED = 'Tell us what happened so we can find the right technician.';
const ADDRESS_REQUIRED = 'Add the address where the service is needed.';

/** Which review line is open for editing. */
type Editing = 'problem' | 'attached' | 'location' | 'urgency' | null;

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export default function RequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Side by side the photo and video buttons truncate on small phones; stack them there.
  const stackMedia = width < 360;
  // On narrow phones "Find my technician" only fits without the arrow and with a slimmer Back.
  const narrow = width < 360;
  // Everything now shares one screen, so the map stays small enough to keep the fields in view.
  const mapHeight = height < 700 ? 96 : 120;
  const router = useRouter();
  const { service: serviceParam, emergency } = useLocalSearchParams<{ service?: string; emergency?: string }>();
  const service = serviceParam || 'General Maintenance';
  const { addRequest } = useFundi();
  const { savedPlaces, preferences } = useProfile();
  // A default saved place fills the address in before the customer gets there.
  const defaultAddress = savedPlaces.find((place) => place.id === preferences.defaultPlaceId)?.address;
  const [step, setStep] = useState(1);
  const [problem, setProblem] = useState('');
  const [urgency, setUrgency] = useState<Urgency>(emergency === 'true' ? 'Emergency' : 'Today');
  const [photoUri, setPhotoUri] = useState<string>();
  const [videoUri, setVideoUri] = useState<string>();
  const [videoSeconds, setVideoSeconds] = useState<number>();
  const [isPickingVideo, setIsPickingVideo] = useState(false);
  const [address, setAddress] = useState(defaultAddress ?? '');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Each required field shows its own message under itself; `error` is for everything else.
  const [problemError, setProblemError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Review: the line being corrected, and its unsaved value.
  const [editing, setEditing] = useState<Editing>(null);
  const [draftProblem, setDraftProblem] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftUrgency, setDraftUrgency] = useState<Urgency>('Today');
  const [draftError, setDraftError] = useState('');

  // Saved places can arrive a moment after the form opens; fill the default in then, unless an address was already typed.
  useEffect(() => {
    if (defaultAddress) setAddress((current) => (current.trim() ? current : defaultAddress));
  }, [defaultAddress]);

  const hasAddress = address.trim().length > 0;
  // Anything typed or attached is worth a "discard?" before the form closes.
  const hasProgress = problem.trim().length > 0 || !!photoUri || !!videoUri || (hasAddress && address !== defaultAddress);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** On the review the arrow first closes an open editor, then goes back to the details. */
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

  // Android's hardware back follows the same rules as the arrow.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 1 && !hasProgress) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  });

  const addPhoto = async () => {
    setError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to add a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.78 });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      await vibrate();
    }
  };

  /**
   * Videos come from the library rather than the camera: it works the same on
   * Android, iOS and web, and needs no microphone permission.
   */
  const addVideo = async () => {
    setError('');
    setIsPickingVideo(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError('Allow access to your videos to attach one.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset?.uri) return;
      // Duration is in milliseconds, and missing on some web browsers.
      const seconds = asset.duration ? asset.duration / 1000 : undefined;
      if (seconds && seconds > MAX_VIDEO_SECONDS) {
        setError(`That video is ${formatDuration(seconds)} long. Choose one under ${MAX_VIDEO_SECONDS / 60} minutes.`);
        return;
      }
      setVideoUri(asset.uri);
      setVideoSeconds(seconds);
      await vibrate();
    } catch {
      setError('We could not open your videos. Try again.');
    } finally {
      setIsPickingVideo(false);
    }
  };

  /**
   * Coordinates are useless to a technician on the doorstep, so turn them into
   * a street address where the platform supports it. Reverse geocoding is not
   * available on web and can fail offline, in which case the coordinates stand
   * in and the customer can still type over them.
   */
  const describeCoordinates = async (latitude: number, longitude: number) => {
    const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    if (Platform.OS === 'web') return fallback;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (!place) return fallback;
      const parts = [
        [place.streetNumber, place.street].filter(Boolean).join(' '),
        place.district,
        place.city,
        place.region,
      ].filter((part): part is string => !!part && part.trim().length > 0);
      const unique = parts.filter((part, index) => parts.indexOf(part) === index);
      return unique.length > 0 ? unique.join(', ') : fallback;
    } catch {
      return fallback;
    }
  };

  /** Fills whichever address field asked: the details step, or the review's editor. */
  const useCurrentLocation = async (apply: (value: string) => void, fail: (message: string) => void) => {
    fail('');
    setIsLocating(true);
    try {
      if (Platform.OS === 'web') {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            apply(await describeCoordinates(position.coords.latitude, position.coords.longitude));
            setIsLocating(false);
          },
          () => {
            fail('Allow location access to use your current location.');
            setIsLocating(false);
          },
        );
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        fail('Allow location access to use your current location.');
        setIsLocating(false);
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      apply(await describeCoordinates(current.coords.latitude, current.coords.longitude));
    } catch {
      fail('We could not read your location. Try again.');
    } finally {
      setIsLocating(false);
    }
  };

  /** Both required fields are checked together, so every gap shows at once under its own field. */
  const checkDetails = (): boolean => {
    const problemMessage = problem.trim() ? '' : PROBLEM_REQUIRED;
    const addressMessage = hasAddress ? '' : ADDRESS_REQUIRED;
    setProblemError(problemMessage);
    setAddressError(addressMessage);
    return !problemMessage && !addressMessage;
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
      const jobId = await addRequest({ service, problem: problem.trim(), urgency, locationLabel: address.trim(), photoUri, videoUri });
      await notify('success');
      // Hand straight over to the job screen, which picks the stage to show.
      router.replace(`/job/${jobId}`);
    } catch {
      setError('Your request could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Opens one review line for editing, starting from what is saved. */
  const openEditor = (line: Exclude<Editing, null>) => {
    setError('');
    setDraftError('');
    setDraftProblem(problem);
    setDraftAddress(address);
    setDraftUrgency(urgency);
    setEditing(line);
  };

  const closeEditor = () => {
    setDraftError('');
    setEditing(null);
  };

  /** Saves the open line and stays on the review. */
  const saveEditor = () => {
    if (editing === 'problem') {
      if (!draftProblem.trim()) return setDraftError(PROBLEM_REQUIRED);
      setProblem(draftProblem);
      setProblemError('');
    }
    if (editing === 'location') {
      if (!draftAddress.trim()) return setDraftError(ADDRESS_REQUIRED);
      setAddress(draftAddress);
      setAddressError('');
    }
    if (editing === 'urgency') setUrgency(draftUrgency);
    vibrate();
    closeEditor();
  };

  const errorView = (message: string, testID = 'request-error') =>
    message ? (
      <View style={styles.errorRow} accessibilityLiveRegion="polite">
        <Feather name="alert-circle" size={15} color={colors.destructive} />
        <Text testID={testID} style={[styles.error, { color: colors.destructive }]}>{message}</Text>
      </View>
    ) : null;

  const attachments = [photoUri ? 'Photo' : null, videoUri ? 'Video' : null].filter(Boolean).join(' and ');

  const media = (
    <View style={[styles.mediaRow, stackMedia && styles.mediaColumn]}>
      <MediaButton
        testID="add-photo-button"
        icon="camera-outline"
        label={photoUri ? 'Photo added' : 'Add photo'}
        hint={photoUri ? 'Tap to retake' : 'Take a picture'}
        thumbnailUri={photoUri}
        onPress={addPhoto}
        onRemove={photoUri ? () => setPhotoUri(undefined) : undefined}
      />
      <MediaButton
        testID="add-video-button"
        icon="videocam-outline"
        label={videoUri ? 'Video added' : 'Add video'}
        hint={videoUri ? (videoSeconds ? `${formatDuration(videoSeconds)} · tap to change` : 'Tap to change') : `Up to ${MAX_VIDEO_SECONDS / 60} minutes`}
        attached={!!videoUri}
        busy={isPickingVideo}
        onPress={addVideo}
        onRemove={
          videoUri
            ? () => {
                setVideoUri(undefined);
                setVideoSeconds(undefined);
              }
            : undefined
        }
      />
    </View>
  );

  /** The editor that opens inside a review line, with its own Save and Cancel. */
  const editor = (line: Exclude<Editing, null>) => (
    <View style={styles.editor}>
      {line === 'problem' ? (
        <TextInput
          accessibilityLabel="Describe the problem"
          testID="review-problem-input"
          value={draftProblem}
          onChangeText={(value) => {
            setDraftProblem(value);
            setDraftError('');
          }}
          multiline
          textAlignVertical="top"
          autoFocus
          style={[
            styles.problemInput,
            styles.editorInput,
            { backgroundColor: colors.background, borderColor: draftError ? colors.destructive : colors.border, color: colors.foreground },
          ]}
        />
      ) : null}
      {line === 'attached' ? media : null}
      {line === 'location' ? (
        <AddressFields
          value={draftAddress}
          onChange={(value) => {
            setDraftAddress(value);
            setDraftError('');
          }}
          places={savedPlaces}
          hasError={!!draftError}
          isLocating={isLocating}
          onUseCurrent={() => useCurrentLocation(setDraftAddress, setDraftError)}
          testIDPrefix="review-"
          inputBackground={colors.background}
        />
      ) : null}
      {line === 'urgency' ? <UrgencyPicker value={draftUrgency} onChange={setDraftUrgency} compact testIDPrefix="review-" /> : null}
      {errorView(draftError, 'review-edit-error')}
      {line !== 'attached' ? errorView(error) : null}
      <View style={styles.editorActions}>
        {line === 'attached' ? (
          <Button label="Done" size="small" icon="checkmark" onPress={closeEditor} testID="review-done" style={styles.editorAction} />
        ) : (
          <>
            <Button label="Cancel" variant="outline" size="small" onPress={closeEditor} testID="review-cancel" style={styles.editorAction} />
            <Button label="Save" size="small" icon="checkmark" onPress={saveEditor} testID="review-save" style={styles.editorAction} />
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 24 : insets.top + 8 }]}>
        <BackButton
          onPress={goBack}
          testID="request-back-button"
          accessibilityLabel={editing ? 'Close the editor' : step > 1 ? 'Back to details' : 'Close request'}
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
              subtitle="Fill in the fields marked * and we will find a nearby technician."
            />

            <FieldLabel label="What is the problem?" required style={styles.firstLabel} />
            <TextInput
              accessibilityLabel="Describe the problem"
              testID="problem-input"
              value={problem}
              onChangeText={(value) => {
                setProblem(value);
                if (problemError) setProblemError('');
              }}
              placeholder="For example: the kitchen tap has been leaking since this morning."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.problemInput,
                { backgroundColor: colors.card, borderColor: problemError ? colors.destructive : colors.border, color: colors.foreground },
              ]}
            />
            {errorView(problemError, 'problem-error')}

            <FieldLabel label="Photo or video" optional style={styles.sectionLabel} />
            {media}

            <FieldLabel label="Where is the service needed?" required style={styles.sectionLabel} />
            <View style={[styles.mapPlaceholder, { height: mapHeight, backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={[styles.mapGrid, { backgroundColor: colors.infoMuted }]} />
              <View style={[styles.mapPin, { backgroundColor: colors.primary }]}>
                <Ionicons name="location" size={18} color={colors.primaryForeground} />
              </View>
              <Text numberOfLines={1} style={[styles.mapLabel, { color: hasAddress ? colors.foreground : colors.primary }]}>
                {hasAddress ? address : 'Service location'}
              </Text>
            </View>
            <AddressFields
              value={address}
              onChange={(value) => {
                setAddress(value);
                if (addressError) setAddressError('');
              }}
              places={savedPlaces}
              hasError={!!addressError}
              isLocating={isLocating}
              onUseCurrent={() => useCurrentLocation(setAddress, setError)}
            />
            {errorView(addressError, 'address-error')}

            <FieldLabel label="How urgent is it?" required style={styles.sectionLabel} />
            <UrgencyPicker value={urgency} onChange={setUrgency} />
            {errorView(error)}
          </>
        )}
        {step === 2 && (
          <>
            <PageHeading
              eyebrow="Almost there"
              title="Review your request"
              subtitle="Tap a line to change it. Your change is saved right here."
            />
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ReviewRow label="Service" value={service} />
              <ReviewRow
                label="Problem"
                value={problem}
                onEdit={() => openEditor('problem')}
                open={editing === 'problem'}
                editor={editing === 'problem' ? editor('problem') : null}
              />
              <ReviewRow
                label="Attached"
                value={attachments || 'Nothing attached'}
                muted={!attachments}
                onEdit={() => openEditor('attached')}
                open={editing === 'attached'}
                editor={editing === 'attached' ? editor('attached') : null}
              />
              <ReviewRow
                label="Location"
                value={address}
                onEdit={() => openEditor('location')}
                open={editing === 'location'}
                editor={editing === 'location' ? editor('location') : null}
              />
              <ReviewRow
                label="Urgency"
                value={urgency}
                onEdit={() => openEditor('urgency')}
                open={editing === 'urgency'}
                editor={editing === 'urgency' ? editor('urgency') : null}
                last
              />
            </View>
            <Notice tone="brand" icon="shield-checkmark-outline" text="You will review any visit fee and repair quote before paying." />
            {editing ? null : errorView(error)}
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      {/* Pinned, so the next step is always in reach. */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 14 },
        ]}
      >
        {step > 1 ? (
          <Button label="Back" variant="outline" onPress={goBack} testID="request-previous-button" style={narrow ? styles.backActionNarrow : styles.backAction} />
        ) : null}
        <Button
          label={step === LAST_STEP ? 'Find my technician' : 'Continue'}
          icon={narrow && step === LAST_STEP ? undefined : 'arrow-forward'}
          loading={isSubmitting}
          // An open editor has to be saved or cancelled first, so nothing half-edited is sent.
          disabled={!!editing}
          onPress={next}
          testID={step === LAST_STEP ? 'submit-request-button' : 'request-continue-button'}
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
  onUseCurrent: () => void;
  testIDPrefix?: string;
  inputBackground?: string;
};

/** Saved-place chips, the address box and "use my current location" — on the details step and in the review editor. */
function AddressFields({ value, onChange, places, hasError, isLocating, onUseCurrent, testIDPrefix = '', inputBackground }: AddressFieldsProps) {
  const colors = useColors();
  return (
    <>
      {places.length > 0 ? (
        <View style={styles.placeRow}>
          {places.map((place) => {
            const selected = value === place.address;
            return (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Use ${place.label}: ${place.address}`}
                testID={`${testIDPrefix}request-place-${place.id}`}
                onPress={() => onChange(place.address)}
                style={({ pressed }) => [
                  styles.placeChip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name={PLACE_ICON[place.kind]} size={15} color={selected ? colors.primaryForeground : colors.primary} />
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
          testID={`${testIDPrefix}address-input`}
          value={value}
          onChangeText={onChange}
          placeholder="Street, area or landmark"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.addressText, { color: colors.foreground }]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        accessibilityState={{ busy: isLocating }}
        testID={`${testIDPrefix}use-current-location-button`}
        onPress={isLocating ? undefined : onUseCurrent}
        style={({ pressed }) => [styles.useCurrent, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
      >
        {isLocating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate" size={16} color={colors.primary} />}
        <Text style={[styles.useText, { color: colors.primary }]}>{isLocating ? 'Finding you…' : 'Use my current location'}</Text>
      </Pressable>
    </>
  );
}

/** The three urgency choices; compact inside the review editor. */
function UrgencyPicker({
  value,
  onChange,
  compact,
  testIDPrefix = '',
}: {
  value: Urgency;
  onChange: (value: Urgency) => void;
  compact?: boolean;
  testIDPrefix?: string;
}) {
  const colors = useColors();
  return (
    <View accessibilityRole="radiogroup" style={[styles.urgencyList, compact && styles.urgencyListCompact]}>
      {URGENCIES.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            testID={`${testIDPrefix}urgency-${option}`}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.urgencyCard,
              compact && styles.urgencyCardCompact,
              { backgroundColor: selected ? colors.secondary : colors.card, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.input }]}>
              {selected && <View style={[styles.radioFill, { backgroundColor: colors.primary }]} />}
            </View>
            <View style={styles.urgencyCopy}>
              <Text style={[styles.urgencyTitle, { color: colors.foreground }]}>{option}</Text>
              <Text style={[styles.urgencyText, { color: colors.mutedForeground }]}>{URGENCY_COPY[option].text}</Text>
            </View>
            <Ionicons name={URGENCY_COPY[option].icon} size={22} color={selected ? colors.primary : colors.mutedForeground} />
          </Pressable>
        );
      })}
    </View>
  );
}

type MediaButtonProps = {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  thumbnailUri?: string;
  attached?: boolean;
  busy?: boolean;
  onPress: () => void;
  onRemove?: () => void;
};

function MediaButton({ testID, icon, label, hint, thumbnailUri, attached, busy, onPress, onRemove }: MediaButtonProps) {
  const colors = useColors();
  const isAttached = attached || !!thumbnailUri;
  return (
    <View style={styles.mediaCell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        testID={testID}
        onPress={busy ? undefined : onPress}
        style={({ pressed }) => [
          styles.mediaButton,
          { borderColor: isAttached ? colors.primary : colors.border, backgroundColor: isAttached ? colors.secondary : colors.card, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.mediaIcon, { backgroundColor: isAttached ? colors.primary : colors.secondary }]}>
            <Ionicons name={isAttached ? 'checkmark' : icon} size={19} color={isAttached ? colors.primaryForeground : colors.primary} />
          </View>
        )}
        <View style={styles.mediaCopy}>
          <Text numberOfLines={1} style={[styles.mediaText, { color: colors.foreground }]}>{label}</Text>
          <Text numberOfLines={1} style={[styles.mediaHint, { color: colors.mutedForeground }]}>{hint}</Text>
        </View>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label.toLowerCase().replace(' added', '')}`}
          testID={`${testID}-remove`}
          onPress={onRemove}
          hitSlop={8}
          style={[styles.removeButton, { backgroundColor: colors.foreground, borderColor: colors.card }]}
        >
          <Feather name="x" size={12} color={colors.card} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ReviewRowProps = {
  label: string;
  value: string;
  onEdit?: () => void;
  muted?: boolean;
  last?: boolean;
  /** True while this line's editor is showing. */
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
        accessibilityRole="button"
        accessibilityLabel={`Change ${label.toLowerCase()}`}
        accessibilityState={{ expanded: !!open }}
        testID={`review-edit-${label.toLowerCase()}`}
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
  problemInput: { minHeight: 120, borderWidth: 1, borderRadius: 14, padding: 14, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  mediaRow: { flexDirection: 'row', gap: 10 },
  mediaColumn: { flexDirection: 'column' },
  mediaCell: { flex: 1, minWidth: 0 },
  mediaButton: { minHeight: 64, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 10 },
  mediaIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  mediaCopy: { flex: 1 },
  mediaText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  mediaHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  thumbnail: { width: 38, height: 38, borderRadius: 9 },
  removeButton: { position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholder: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginBottom: 12 },
  mapGrid: { ...StyleSheet.absoluteFill, opacity: 0.35 },
  mapPin: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  mapLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 8, textAlign: 'center' },
  placeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  placeChip: { minHeight: 38, maxWidth: '100%', borderRadius: 19, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13 },
  placeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flexShrink: 1 },
  addressCard: { minHeight: 56, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 6 },
  addressText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, paddingVertical: 8 },
  useCurrent: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 16, marginTop: 12 },
  useText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  urgencyList: { gap: 10 },
  urgencyListCompact: { gap: 8 },
  urgencyCard: { minHeight: 70, borderWidth: 1.5, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  urgencyCardCompact: { minHeight: 60, paddingVertical: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 11, height: 11, borderRadius: 6 },
  urgencyCopy: { flex: 1 },
  urgencyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  urgencyText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
  reviewCard: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, marginTop: 22, marginBottom: 14 },
  reviewRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  reviewLabel: { width: 70, fontFamily: 'Inter_500Medium', fontSize: 13 },
  reviewValue: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  editor: { paddingBottom: 14 },
  editorInput: { minHeight: 100 },
  editorActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editorAction: { flex: 1 },
  errorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 10 },
  error: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  backAction: { minWidth: 96 },
  backActionNarrow: { minWidth: 76 },
  nextAction: { flex: 1 },
});
