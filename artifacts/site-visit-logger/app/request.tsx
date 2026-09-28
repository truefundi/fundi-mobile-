import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useFundi } from '@/context/FundiContext';

type Urgency = 'Emergency' | 'Today' | 'Schedule';

/** Shown until the customer types an address or taps "Use current". */
const PLACEHOLDER_ADDRESS = 'Add your service address';

export default function RequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { service: serviceParam, emergency } = useLocalSearchParams<{ service?: string; emergency?: string }>();
  const service = serviceParam || 'General Maintenance';
  const { addRequest } = useFundi();
  const [step, setStep] = useState(1);
  const [problem, setProblem] = useState('');
  const [urgency, setUrgency] = useState<Urgency>(emergency === 'true' ? 'Emergency' : 'Today');
  const [photoUri, setPhotoUri] = useState<string>();
  const [locationLabel, setLocationLabel] = useState(PLACEHOLDER_ADDRESS);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addPhoto = async () => {
    setError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to add a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.78 });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const submit = async () => {
    if (!problem.trim()) {
      setError('Tell us what happened so we can find the right technician.');
      setStep(1);
      return;
    }
    if (locationLabel === PLACEHOLDER_ADDRESS || locationLabel.trim().length === 0) {
      setError('Add a service location before continuing.');
      setStep(2);
      return;
    }
    setIsSubmitting(true);
    try {
      const jobId = await addRequest({ service, problem: problem.trim(), urgency, locationLabel, photoUri });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Hand straight over to the job screen, which picks the stage to show.
      router.replace(`/job/${jobId}`);
    } catch {
      setError('Your request could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" testID="request-back-button" onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.stepText, { color: colors.mutedForeground }]}>Step {step} of 4</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${step * 25}%` }]} />
      </View>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>{service.toUpperCase()}</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Tell us what happened</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A few details help us find the right person for the job.</Text>
            <TextInput
              accessibilityLabel="Describe the problem"
              testID="problem-input"
              value={problem}
              onChangeText={setProblem}
              placeholder="Describe the problem..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[styles.problemInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
            <View style={styles.mediaRow}>
              <Pressable accessibilityRole="button" testID="add-photo-button" onPress={addPhoto} style={[styles.mediaButton, { borderColor: colors.border, backgroundColor: colors.card }]}>
                {photoUri ? <Image source={{ uri: photoUri }} style={styles.thumbnail} /> : <Ionicons name="camera-outline" size={21} color={colors.primary} />}
                <Text style={[styles.mediaText, { color: colors.foreground }]}>{photoUri ? 'Photo added' : 'Add photo'}</Text>
              </Pressable>
              <View style={[styles.mediaButton, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Ionicons name="videocam-outline" size={21} color={colors.mutedForeground} />
                <Text style={[styles.mediaText, { color: colors.mutedForeground }]}>Add video</Text>
              </View>
            </View>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>SERVICE LOCATION</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Where is the service needed?</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>We use this to match you with nearby technicians.</Text>
            <View style={[styles.mapPlaceholder, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={styles.mapGrid} />
              <View style={[styles.mapPin, { backgroundColor: colors.primary }]}><Ionicons name="location" size={20} color={colors.primaryForeground} /></View>
              <Text style={[styles.mapLabel, { color: colors.primary }]}>Service location</Text>
            </View>
            <View style={[styles.addressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="location-outline" size={22} color={colors.primary} />
              <TextInput
                accessibilityLabel="Service address"
                testID="address-input"
                value={locationLabel === PLACEHOLDER_ADDRESS ? '' : locationLabel}
                onChangeText={(value) => {
                  setLocationLabel(value.length > 0 ? value : PLACEHOLDER_ADDRESS);
                  setError('');
                }}
                placeholder={PLACEHOLDER_ADDRESS}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.addressText, { color: colors.foreground }]}
              />
              <Pressable accessibilityRole="button" testID="use-current-location-button" onPress={useCurrentLocation}>
                {isLocating ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.useText, { color: colors.primary }]}>Use current</Text>}
              </Pressable>
            </View>
          </>
        )}
        {step === 3 && (
          <>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>TIMING</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>How urgent is it?</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Choose when you would like a qualified technician to arrive.</Text>
            {(['Emergency', 'Today', 'Schedule'] as Urgency[]).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: urgency === option }}
                testID={`urgency-${option}`}
                onPress={() => setUrgency(option)}
                style={[styles.urgencyCard, { backgroundColor: colors.card, borderColor: urgency === option ? colors.primary : colors.border }]}
              >
                <View style={[styles.radio, { borderColor: urgency === option ? colors.primary : colors.input }]}>
                  {urgency === option && <View style={[styles.radioFill, { backgroundColor: colors.primary }]} />}
                </View>
                <View style={styles.urgencyCopy}>
                  <Text style={[styles.urgencyTitle, { color: colors.foreground }]}>{option}</Text>
                  <Text style={[styles.urgencyText, { color: colors.mutedForeground }]}>{option === 'Emergency' ? 'Need someone immediately' : option === 'Today' ? 'As soon as possible today' : 'Choose a preferred time'}</Text>
                </View>
                <Ionicons name={option === 'Emergency' ? 'flash-outline' : option === 'Today' ? 'sunny-outline' : 'calendar-outline'} size={22} color={urgency === option ? colors.primary : colors.mutedForeground} />
              </Pressable>
            ))}
          </>
        )}
        {step === 4 && (
          <>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>ALMOST THERE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Review your request</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Make sure everything looks right before we start matching.</Text>
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ReviewRow label="Service" value={service} colors={colors} />
              <ReviewRow label="Problem" value={problem} colors={colors} />
              <ReviewRow label="Location" value={locationLabel} colors={colors} />
              <ReviewRow label="Urgency" value={urgency} colors={colors} last />
            </View>
            <View style={[styles.trustNote, { backgroundColor: colors.secondary }]}>
              <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
              <Text style={[styles.trustText, { color: colors.foreground }]}>You will review any visit fee and repair quote before paying.</Text>
            </View>
          </>
        )}
        {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
        <View style={styles.footerActions}>
          {step > 1 && <Pressable accessibilityRole="button" testID="request-previous-button" onPress={() => setStep((value) => value - 1)} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.foreground }]}>Back</Text></Pressable>}
          <Pressable
            accessibilityRole="button"
            testID={step === 4 ? 'submit-request-button' : 'request-continue-button'}
            onPress={() => (step === 4 ? submit() : setStep((value) => value + 1))}
            disabled={isSubmitting}
            style={[styles.primaryButton, { backgroundColor: colors.primary, flex: step > 1 ? 1 : undefined }]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{step === 4 ? 'Find my technician' : 'Continue'}</Text>}
            {!isSubmitting && <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />}
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function ReviewRow({ label, value, colors, last = false }: { label: string; value: string; colors: ReturnType<typeof useColors>; last?: boolean }) {
  return (
    <View style={[styles.reviewRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: colors.foreground }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 20, minHeight: 59, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  progressTrack: { height: 3, backgroundColor: '#e5e7eb' },
  progressFill: { height: 3 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.4, marginTop: 27, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9, maxWidth: 345 },
  problemInput: { minHeight: 155, borderWidth: 1, borderRadius: 15, padding: 14, fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 22 },
  mediaRow: { flexDirection: 'row', gap: 10, marginTop: 13 },
  mediaButton: { flex: 1, height: 56, borderWidth: 1, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mediaText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  thumbnail: { width: 34, height: 34, borderRadius: 8 },
  mapPlaceholder: { height: 225, borderRadius: 16, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 23 },
  mapGrid: { ...StyleSheet.absoluteFillObject, opacity: 0.35, backgroundColor: '#dbeafe' },
  mapPin: { width: 45, height: 45, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  mapLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 10 },
  addressCard: { minHeight: 62, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginTop: 13 },
  addressText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  useText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  urgencyCard: { minHeight: 80, borderWidth: 1.5, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 11, height: 11, borderRadius: 6 },
  urgencyCopy: { flex: 1 },
  urgencyTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  urgencyText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  reviewCard: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, marginTop: 22 },
  reviewRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 16 },
  reviewLabel: { width: 72, fontFamily: 'Inter_500Medium', fontSize: 11 },
  reviewValue: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  trustNote: { borderRadius: 13, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 13 },
  trustText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, marginTop: 15 },
  footerActions: { flexDirection: 'row', gap: 10, marginTop: 26, marginBottom: 16 },
  primaryButton: { minHeight: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  secondaryButton: { minHeight: 54, minWidth: 82, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});