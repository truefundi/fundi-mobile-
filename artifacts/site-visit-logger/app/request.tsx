import * as Haptics from 'expo-haptics';
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
import { Notice } from '@/components/ui/Notice';
import { PageHeading } from '@/components/ui/PageHeading';
import { useColors } from '@/hooks/useColors';
import { useFundi } from '@/context/FundiContext';

type Urgency = 'Emergency' | 'Today' | 'Schedule';

/** Shown until the customer types an address or taps "Use current". */
const PLACEHOLDER_ADDRESS = 'Add your service address';

/** Long clips are slow to send on mobile data; a minute or two shows the problem. */
const MAX_VIDEO_SECONDS = 120;

const STEP_NAMES = ['Problem', 'Location', 'Timing', 'Review'] as const;
const LAST_STEP = STEP_NAMES.length;

const URGENCY_COPY: Record<Urgency, { text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Emergency: { text: 'Need someone immediately', icon: 'flash-outline' },
  Today: { text: 'As soon as possible today', icon: 'sunny-outline' },
  Schedule: { text: 'Choose a preferred time', icon: 'calendar-outline' },
};

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
  // On short screens the map would push the address field below the fold.
  const mapHeight = height < 700 ? 120 : 190;
  const router = useRouter();
  const { service: serviceParam, emergency } = useLocalSearchParams<{ service?: string; emergency?: string }>();
  const service = serviceParam || 'General Maintenance';
  const { addRequest } = useFundi();
  const [step, setStep] = useState(1);
  const [problem, setProblem] = useState('');
  const [urgency, setUrgency] = useState<Urgency>(emergency === 'true' ? 'Emergency' : 'Today');
  const [photoUri, setPhotoUri] = useState<string>();
  const [videoUri, setVideoUri] = useState<string>();
  const [videoSeconds, setVideoSeconds] = useState<number>();
  const [isPickingVideo, setIsPickingVideo] = useState(false);
  const [locationLabel, setLocationLabel] = useState(PLACEHOLDER_ADDRESS);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const hasAddress = locationLabel !== PLACEHOLDER_ADDRESS && locationLabel.trim().length > 0;
  // Anything typed or attached is worth a "discard?" before the form closes.
  const hasProgress = problem.trim().length > 0 || !!photoUri || !!videoUri || hasAddress;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** The top arrow steps back through the form; only on step one does it close it. */
  const goBack = () => {
    setError('');
    if (step > 1) {
      setStep((value) => value - 1);
      return;
    }
    if (hasProgress) setConfirmLeave(true);
    else leave();
  };

  // Android's hardware back follows the same rules as the arrow: step back,
  // and ask before discarding a filled-in form.
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
      if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const useCurrentLocation = async () => {
    setError('');
    setIsLocating(true);
    try {
      if (Platform.OS === 'web') {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            setLocationLabel(await describeCoordinates(position.coords.latitude, position.coords.longitude));
            setIsLocating(false);
          },
          () => {
            setError('Allow location access to use your current location.');
            setIsLocating(false);
          },
        );
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Allow location access to use your current location.');
        setIsLocating(false);
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationLabel(await describeCoordinates(current.coords.latitude, current.coords.longitude));
    } catch {
      setError('We could not read your location. Try again.');
    } finally {
      setIsLocating(false);
    }
  };

  /** Each step is checked before moving on, so a gap is fixed where it happens. */
  const validate = (current: number): string => {
    if (current === 1 && !problem.trim()) return 'Tell us what happened so we can find the right technician.';
    if (current === 2 && !hasAddress) return 'Add a service location before continuing.';
    return '';
  };

  const next = () => {
    const problemWithStep = validate(step);
    if (problemWithStep) {
      setError(problemWithStep);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    setError('');
    if (step < LAST_STEP) setStep((value) => value + 1);
    else submit();
  };

  const submit = async () => {
    for (const check of [1, 2]) {
      const message = validate(check);
      if (message) {
        setError(message);
        setStep(check);
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const jobId = await addRequest({ service, problem: problem.trim(), urgency, locationLabel, photoUri, videoUri });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Hand straight over to the job screen, which picks the stage to show.
      router.replace(`/job/${jobId}`);
    } catch {
      setError('Your request could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editStep = (target: number) => {
    setError('');
    setStep(target);
  };

  // Shown right under the field it is about, so it is never hidden behind the pinned buttons.
  const errorView = error ? (
    <View style={styles.errorRow} accessibilityLiveRegion="polite">
      <Feather name="alert-circle" size={15} color={colors.destructive} />
      <Text testID="request-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text>
    </View>
  ) : null;

  const attachments = [photoUri ? 'Photo' : null, videoUri ? 'Video' : null].filter(Boolean).join(' and ');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 24 : insets.top + 8 }]}>
        <BackButton
          onPress={goBack}
          testID="request-back-button"
          accessibilityLabel={step > 1 ? 'Previous step' : 'Close request'}
        />
        <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
          Step {step} of {LAST_STEP} · {STEP_NAMES[step - 1]}
        </Text>
        <View style={styles.topSpacer} />
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${(step / LAST_STEP) * 100}%` }]} />
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            <PageHeading
              eyebrow={service}
              title="Tell us what happened"
              subtitle="A few details help us find the right person for the job."
            />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>What is the problem?</Text>
            <TextInput
              accessibilityLabel="Describe the problem"
              testID="problem-input"
              value={problem}
              onChangeText={(value) => {
                setProblem(value);
                if (error) setError('');
              }}
              placeholder="For example: the kitchen tap has been leaking since this morning."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.problemInput,
                { backgroundColor: colors.card, borderColor: error && !problem.trim() ? colors.destructive : colors.border, color: colors.foreground },
              ]}
            />
            {errorView}

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Photo or video <Text style={[styles.optional, { color: colors.mutedForeground }]}>(optional)</Text>
            </Text>
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
          </>
        )}
        {step === 2 && (
          <>
            <PageHeading
              eyebrow="Service location"
              title="Where is the service needed?"
              subtitle="We use this to match you with nearby technicians."
            />
            <View style={[styles.mapPlaceholder, { height: mapHeight, backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={[styles.mapGrid, { backgroundColor: colors.infoMuted }]} />
              <View style={[styles.mapPin, { backgroundColor: colors.primary }]}>
                <Ionicons name="location" size={20} color={colors.primaryForeground} />
              </View>
              <Text numberOfLines={2} style={[styles.mapLabel, { color: hasAddress ? colors.foreground : colors.primary }]}>
                {hasAddress ? locationLabel : 'Service location'}
              </Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Address</Text>
            <View
              style={[
                styles.addressCard,
                { backgroundColor: colors.card, borderColor: error && !hasAddress ? colors.destructive : colors.border },
              ]}
            >
              <Ionicons name="location-outline" size={22} color={colors.primary} />
              <TextInput
                accessibilityLabel="Service address"
                testID="address-input"
                value={hasAddress ? locationLabel : ''}
                onChangeText={(value) => {
                  setLocationLabel(value.length > 0 ? value : PLACEHOLDER_ADDRESS);
                  setError('');
                }}
                placeholder="Street, area or landmark"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[styles.addressText, { color: colors.foreground }]}
              />
            </View>
            {errorView}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              accessibilityState={{ busy: isLocating }}
              testID="use-current-location-button"
              onPress={isLocating ? undefined : useCurrentLocation}
              style={({ pressed }) => [styles.useCurrent, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
            >
              {isLocating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate" size={16} color={colors.primary} />}
              <Text style={[styles.useText, { color: colors.primary }]}>{isLocating ? 'Finding you…' : 'Use my current location'}</Text>
            </Pressable>
          </>
        )}
        {step === 3 && (
          <>
            <PageHeading
              eyebrow="Timing"
              title="How urgent is it?"
              subtitle="Choose when you would like a qualified technician to arrive."
            />
            <View accessibilityRole="radiogroup" style={styles.urgencyList}>
              {(['Emergency', 'Today', 'Schedule'] as Urgency[]).map((option) => {
                const selected = urgency === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    testID={`urgency-${option}`}
                    onPress={() => setUrgency(option)}
                    style={({ pressed }) => [
                      styles.urgencyCard,
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
          </>
        )}
        {step === 4 && (
          <>
            <PageHeading
              eyebrow="Almost there"
              title="Review your request"
              subtitle="Tap any line to change it before we start matching."
            />
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ReviewRow label="Service" value={service} />
              <ReviewRow label="Problem" value={problem} onEdit={() => editStep(1)} />
              <ReviewRow label="Attached" value={attachments || 'Nothing attached'} muted={!attachments} onEdit={() => editStep(1)} />
              <ReviewRow label="Location" value={locationLabel} onEdit={() => editStep(2)} />
              <ReviewRow label="Urgency" value={urgency} onEdit={() => editStep(3)} last />
            </View>
            <Notice tone="brand" icon="shield-checkmark-outline" text="You will review any visit fee and repair quote before paying." />
          </>
        )}
        {step > 2 ? errorView : null}
      </KeyboardAwareScrollViewCompat>

      {/* Pinned, like the journey stages, so the next step is always in reach. */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 14 },
        ]}
      >
        {step > 1 ? (
          <Button label="Back" variant="outline" onPress={goBack} testID="request-previous-button" style={styles.backAction} />
        ) : null}
        <Button
          label={step === LAST_STEP ? 'Find my technician' : 'Continue'}
          icon="arrow-forward"
          loading={isSubmitting}
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

function ReviewRow({ label, value, onEdit, muted, last = false }: { label: string; value: string; onEdit?: () => void; muted?: boolean; last?: boolean }) {
  const colors = useColors();
  const content = (
    <>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: muted ? colors.mutedForeground : colors.foreground }]} numberOfLines={3}>
        {value}
      </Text>
      {onEdit ? <Feather name="edit-2" size={15} color={colors.primary} /> : null}
    </>
  );
  const rowStyle = [styles.reviewRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }];
  if (!onEdit) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Change ${label.toLowerCase()}`}
      testID={`review-edit-${label.toLowerCase()}`}
      onPress={onEdit}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
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
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 22, marginBottom: 8 },
  optional: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  problemInput: { minHeight: 140, borderWidth: 1, borderRadius: 14, padding: 14, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
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
  mapPlaceholder: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 22 },
  mapGrid: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  mapPin: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  mapLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 10, textAlign: 'center' },
  addressCard: { minHeight: 56, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 6 },
  addressText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 20, paddingVertical: 8 },
  useCurrent: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 16, marginTop: 12 },
  useText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  urgencyList: { gap: 12, marginTop: 22 },
  urgencyCard: { minHeight: 76, borderWidth: 1.5, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 11, height: 11, borderRadius: 6 },
  urgencyCopy: { flex: 1 },
  urgencyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  urgencyText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
  reviewCard: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, marginTop: 22, marginBottom: 14 },
  reviewRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  reviewLabel: { width: 70, fontFamily: 'Inter_500Medium', fontSize: 13 },
  reviewValue: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  errorRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 10 },
  error: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  backAction: { minWidth: 96 },
  nextAction: { flex: 1 },
});
