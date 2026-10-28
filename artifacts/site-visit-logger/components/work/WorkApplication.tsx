import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TRADES } from '@/constants/work';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
import { OTP_LENGTH } from '@/constants/auth';
import { useWork } from '@/context/WorkContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type FileData = {
  uri: string;
  name?: string;
  size?: number;
  mimeType?: string;
};

async function readBrowserFileMetadata(file: FileData): Promise<FileData> {
  if (Platform.OS !== 'web') return file;
  try {
    const response = await fetch(file.uri);
    if (!response.ok) throw new Error('We could not read that file. Please choose it again.');
    const blob = await response.blob();
    return {
      ...file,
      size: blob.size,
      mimeType: inferUploadMimeType(file.name ?? file.uri, file.mimeType ?? blob.type),
    };
  } catch (error) {
    console.error('Web file reading error:', error);
    return file;
  }
}

async function capture(): Promise<FileData | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Allow camera access to take a photo.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.78 });
  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  if (asset.type && asset.type !== 'image' && asset.type !== 'livePhoto') {
    throw new Error('Choose a photo for this field.');
  }
  return readBrowserFileMetadata({
    uri: asset.uri,
    name: asset.fileName ?? undefined,
    size: asset.fileSize ?? undefined,
    mimeType:
      inferUploadMimeType(asset.fileName ?? asset.uri, asset.mimeType) ??
      (asset.type === 'image' ? 'image/jpeg' : undefined),
  });
}

/** Simulates sending an OTP to the given phone number. Replace with real API call. */
async function sendApplicationOtp(_phone: string): Promise<void> {
  // TODO: wire to real SMS OTP API endpoint
  await new Promise((r) => setTimeout(r, 900));
}

/** Simulates verifying an OTP. Replace with real API call. Returns true if correct. */
async function verifyApplicationOtp(_phone: string, code: string): Promise<boolean> {
  // TODO: wire to real OTP verify API endpoint
  // For now, any 6-digit code is accepted so the form can be tested end-to-end.
  await new Promise((r) => setTimeout(r, 700));
  return code.length === OTP_LENGTH;
}

export function WorkApplication() {
  const colors = useColors();
  const { apply, profile, applicationError } = useWork();
  const { account, updateRole } = useAuth();

  // ── Section 1: Profile & Identity ─────────────────────────────────────────
  // Prepopulated from logged in / registered account, but editable by the user.
  const [fullName, setFullName] = useState(account?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(account?.phone ?? '');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'FEMALE' | 'MALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY' | undefined>(undefined);
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [baseAddress, setBaseAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'BANK_TRANSFER' | 'CASH' | 'OTHER'>('MOMO');
  const [paymentNumber, setPaymentNumber] = useState(account?.phone ?? '');

  // Files: Profile Picture (optional) & ID Photo (required)
  const [profilePicture, setProfilePicture] = useState<FileData | null>(null);
  const [profilePictureSelectionError, setProfilePictureSelectionError] = useState('');
  const [idPhoto, setIdPhoto] = useState<FileData | null>(null);
  const [idPhotoSelectionError, setIdPhotoSelectionError] = useState('');

  // ── Section 2: Trades & Certificates ─────────────────────────────────────
  const [serviceExperiences, setServiceExperiences] = useState<
    Array<{ trade: string; customName: string; yearsOfExperience: number }>
  >([{ trade: TRADES[0] ?? 'Plumbing', customName: '', yearsOfExperience: 1 }]);
  const [certificates, setCertificates] = useState<FileData[]>([]);
  const [certificateSelectionError, setCertificateSelectionError] = useState('');

  // ── Phone OTP verification ────────────────────────────────────────────────
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const otpInputRef = useRef<TextInput>(null);

  // ── General ───────────────────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill from account whenever it changes.
  useEffect(() => {
    if (account) {
      if (account.name && !fullName) setFullName(account.name);
      if (account.phone) {
        if (!phoneNumber) setPhoneNumber(account.phone);
        if (!paymentNumber) setPaymentNumber(account.phone);
      }
    }
  }, [account]);

  // Pre-fill from existing work profile when it loads.
  useEffect(() => {
    if (!profile) return;
    if (profile.fullName) setFullName(profile.fullName);
    if (profile.phoneNumber) setPhoneNumber(profile.phoneNumber);
    if (profile.email) setEmail(profile.email);
    if (profile.gender) setGender(profile.gender);
    setNationalIdNumber(profile.nationalIdNumber ?? '');
    setBaseAddress(profile.baseAddress ?? '');
    setPaymentMethod(profile.paymentMethod ?? 'MOMO');
    setPaymentNumber(profile.paymentNumber ?? account?.phone ?? '');

    setProfilePicture(
      profile.profilePictureUri || profile.profilePictureUrl
        ? {
            uri: profile.profilePictureUri || profile.profilePictureUrl!,
            size: profile.profilePictureSizeBytes,
            mimeType: profile.profilePictureMimeType,
          }
        : null,
    );

    setIdPhoto(
      profile.idPhotoUri
        ? { uri: profile.idPhotoUri, size: profile.idPhotoSizeBytes, mimeType: profile.idPhotoMimeType }
        : null,
    );

    setCertificates(
      profile.certificateUris?.map((uri, index) => ({
        uri,
        size: profile.certificateSizeBytes?.[index],
        mimeType: profile.certificateMimeTypes?.[index],
      })) || [],
    );

    if (profile.serviceExperiences?.length) {
      setServiceExperiences(profile.serviceExperiences);
    }
  }, [account, profile]);

  // ── Validations ────────────────────────────────────────────────────────────
  const emailError =
    email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Invalid email format' : '';

  const idError =
    nationalIdNumber && !/^\d{16}$/.test(nationalIdNumber)
      ? 'National ID must be exactly 16 digits'
      : '';

  const getFileError = (file: FileData | null, allowPdf = false) => {
    if (!file) return '';
    if (/^https?:\/\//i.test(file.uri)) return '';
    if (file.size === undefined || !Number.isFinite(file.size) || file.size < 0) {
      return `We couldn't check this file's size. Please choose it again (maximum ${MAX_UPLOAD_SIZE_LABEL}).`;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return `This file is larger than ${MAX_UPLOAD_SIZE_LABEL}. Please choose a smaller one.`;
    }
    const mimeType = inferUploadMimeType(file.name ?? file.uri, file.mimeType);
    if (mimeType?.startsWith('image/')) return '';
    if (allowPdf && mimeType === 'application/pdf') return '';
    return allowPdf ? 'Choose a photo or PDF file.' : 'Choose a photo file.';
  };

  const profilePicError = getFileError(profilePicture);
  const idPhotoError = getFileError(idPhoto, true);
  const certificateFileErrors = certificates.map((file) => getFileError(file, true));

  // ONLY National ID Number, ID Photo, and Phone OTP verification are strictly REQUIRED!
  const isProfileComplete =
    !!nationalIdNumber.trim() &&
    !idError &&
    !!idPhoto &&
    !idPhotoError;

  const noValidationErrors =
    !emailError &&
    !idError &&
    !profilePicError &&
    !idPhotoError &&
    !profilePictureSelectionError &&
    !idPhotoSelectionError &&
    !certificateSelectionError &&
    certificateFileErrors.every((message) => !message);

  const ready = isProfileComplete && noValidationErrors && isPhoneVerified;

  // ── File pickers ───────────────────────────────────────────────────────────
  async function pickFromLibrary(imagesOnly: boolean): Promise<FileData | null> {
    if (imagesOnly) {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.78 });
      if (result.canceled || !result.assets[0]?.uri) return null;
      const asset = result.assets[0];
      if (asset.type && asset.type !== 'image' && asset.type !== 'livePhoto') {
        throw new Error('Choose a photo for this field.');
      }
      return {
        uri: asset.uri,
        name: asset.fileName ?? undefined,
        size: asset.fileSize ?? undefined,
        mimeType:
          inferUploadMimeType(asset.fileName ?? asset.uri, asset.mimeType) ??
          (asset.type === 'image' ? 'image/jpeg' : undefined),
      };
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return null;
    const asset = result.assets[0];
    return readBrowserFileMetadata({
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? undefined,
      mimeType: inferUploadMimeType(asset.name || asset.uri, asset.mimeType),
    });
  }

  function chooseSource(
    onChosen: (file: FileData) => void,
    setSourceError: (message: string) => void,
    imagesOnly = false,
  ) {
    const select = async (source: 'camera' | 'library') => {
      setSourceError('');
      try {
        const file = source === 'camera' ? await capture() : await pickFromLibrary(imagesOnly);
        if (!file) return;
        const validationError = getFileError(file, !imagesOnly);
        if (validationError) {
          setSourceError(validationError);
          return;
        }
        onChosen(file);
        setSourceError('');
      } catch (selectionError) {
        setSourceError(
          selectionError instanceof Error
            ? selectionError.message
            : 'We could not open that file. Please try again.',
        );
      }
    };

    if (Platform.OS === 'web') {
      void select('library');
      return;
    }
    Alert.alert(imagesOnly ? 'Add a photo' : 'Add a document', undefined, [
      { text: 'Take a photo', onPress: () => { void select('camera'); } },
      { text: 'Upload a file', onPress: () => { void select('library'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // ── Service experience helpers ─────────────────────────────────────────────
  const addServiceExperience = () => {
    if (serviceExperiences.length >= 10) return;
    const selectedTrades = serviceExperiences.map((e) => e.trade);
    const availableTrade = TRADES.find((t) => !selectedTrades.includes(t)) ?? 'Others';
    setServiceExperiences([...serviceExperiences, { trade: availableTrade, customName: '', yearsOfExperience: 1 }]);
  };

  const updateServiceExperience = (
    index: number,
    field: 'trade' | 'customName' | 'yearsOfExperience',
    value: string | number,
  ) => {
    const updated = [...serviceExperiences];
    updated[index] = { ...updated[index], [field]: value };
    setServiceExperiences(updated);
  };

  const removeServiceExperience = (index: number) => {
    setServiceExperiences(serviceExperiences.filter((_, i) => i !== index));
  };

  // ── OTP helpers ────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const phone = phoneNumber.trim() || account?.phone || '';
    if (!phone) {
      setOtpError('Please enter a phone number first.');
      return;
    }
    setOtpSending(true);
    setOtpError('');
    setOtpCode('');
    try {
      await sendApplicationOtp(phone);
      setOtpSent(true);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not send the code. Try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (enteredCode: string) => {
    const phone = phoneNumber.trim() || account?.phone || '';
    setOtpVerifying(true);
    setOtpError('');
    try {
      const ok = await verifyApplicationOtp(phone, enteredCode);
      if (ok) {
        setIsPhoneVerified(true);
        setOtpSent(false);
      } else {
        setOtpError('Incorrect code. Please try again.');
        setOtpCode('');
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed. Try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!ready) return;
    setError('');
    setLoading(true);
    try {
      let baseLatitude = -1.9441;
      let baseLongitude = 30.0619;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const position = await Location.getCurrentPositionAsync({});
          baseLatitude = position.coords.latitude;
          baseLongitude = position.coords.longitude;
        }
      } catch (locErr) {
        console.warn('Could not determine position:', locErr);
      }

      const formattedExperiences = serviceExperiences.map((exp) => ({
        trade: exp.trade,
        customName: exp.trade === 'Others' ? (exp.customName.trim() || 'Other') : exp.trade,
        yearsOfExperience: Number(exp.yearsOfExperience) || 0,
      }));

      const activePhone = phoneNumber.trim() || account?.phone || '';

      await apply({
        fullName: fullName.trim() || account?.name || 'Technician',
        phoneNumber: activePhone,
        email: email.trim() || undefined,
        gender: gender || undefined,
        nationalIdNumber: nationalIdNumber.trim(),
        baseAddress: baseAddress.trim() || 'Kigali, Rwanda',
        baseLatitude,
        baseLongitude,
        paymentMethod,
        paymentNumber: paymentNumber.trim() || activePhone,
        profilePictureUri: profilePicture?.uri,
        profilePictureMimeType: profilePicture?.mimeType,
        profilePictureSizeBytes: profilePicture?.size,
        idPhotoUri: idPhoto?.uri,
        idPhotoMimeType: idPhoto?.mimeType,
        idPhotoSizeBytes: idPhoto?.size,
        certificateUris: certificates.map((c) => c.uri),
        certificateMimeTypes: certificates.map((file) => file.mimeType),
        certificateSizeBytes: certificates.map((file) => file.size),
        yearsExperience: Math.max(...formattedExperiences.map((e) => e.yearsOfExperience), 0),
        trade: formattedExperiences[0]?.customName || 'General Maintenance',
        serviceExperiences: formattedExperiences,
      });
      await updateRole('TECHNICIAN');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const allTradeOptions = [...TRADES, 'Others'];
  const RequiredAsterisk = () => <Text style={{ color: colors.destructive }}> *</Text>;

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={[styles.intro, { backgroundColor: colors.secondary }]}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
        <Text style={[styles.introText, { color: colors.secondaryForeground }]}>
          Complete your application below, verify your phone number with OTP, then submit to start accepting jobs.
        </Text>
      </View>

      {/* ─── SECTION 1: PROFILE & IDENTITY ─────────────────────────────── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Section 1: Profile &amp; Identity
        </Text>

        {/* Profile Picture – Optional */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Profile Picture <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional, photo only, max {MAX_UPLOAD_SIZE_LABEL})</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => chooseSource((file) => setProfilePicture(file), setProfilePictureSelectionError, true)}
          style={[
            styles.upload,
            {
              borderColor:
                profilePicError || profilePictureSelectionError
                  ? colors.destructive
                  : profilePicture
                  ? colors.success
                  : colors.border,
            },
          ]}
        >
          {profilePicture ? (
            <Image source={{ uri: profilePicture.uri }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <Ionicons name="person-circle-outline" size={21} color={colors.primary} />
          )}
          <Text style={[styles.uploadText, { color: colors.foreground }]}>
            {profilePicture ? 'Profile picture added ✓' : 'Upload profile picture'}
          </Text>
          {profilePicture && !profilePicError && !profilePictureSelectionError ? (
            <Feather name="check-circle" size={18} color={colors.success} />
          ) : null}
        </Pressable>
        {profilePicError || profilePictureSelectionError ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>
            {profilePicError || profilePictureSelectionError}
          </Text>
        ) : null}

        {/* Full Name – Optional & Editable */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Full Name <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
          ]}
        />

        {/* Phone Number – Optional & Editable */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Phone Number <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        <TextInput
          value={phoneNumber}
          onChangeText={(val) => {
            setPhoneNumber(val);
            if (isPhoneVerified) {
              setIsPhoneVerified(false);
              setOtpSent(false);
            }
          }}
          keyboardType="phone-pad"
          placeholder="+250788123456"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
          ]}
        />

        {/* Email Address – Optional */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Email Address <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="email@example.com"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: emailError ? colors.destructive : colors.border,
              color: colors.foreground,
            },
          ]}
        />
        {emailError ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{emailError}</Text>
        ) : null}

        {/* Gender – Optional */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Gender <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        <View style={styles.rowWrap}>
          {(['FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] as const).map((g) => {
            const selected = gender === g;
            return (
              <Pressable
                key={g}
                onPress={() => setGender(selected ? undefined : g)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : colors.background,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                  {g.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* National ID Number – REQUIRED */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          National ID Number<RequiredAsterisk />
        </Text>
        <TextInput
          value={nationalIdNumber}
          onChangeText={setNationalIdNumber}
          placeholder="1234567890123456"
          keyboardType="number-pad"
          maxLength={16}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: idError ? colors.destructive : colors.border,
              color: colors.foreground,
            },
          ]}
        />
        {idError ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{idError}</Text>
        ) : null}

        {/* National ID Document Photo – REQUIRED */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          National ID Document Photo (photo or PDF, max {MAX_UPLOAD_SIZE_LABEL})<RequiredAsterisk />
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => chooseSource((file) => setIdPhoto(file), setIdPhotoSelectionError)}
          style={[
            styles.upload,
            {
              borderColor:
                idPhotoError || idPhotoSelectionError
                  ? colors.destructive
                  : idPhoto
                  ? colors.success
                  : colors.border,
            },
          ]}
        >
          {idPhoto && inferUploadMimeType(idPhoto.name ?? idPhoto.uri, idPhoto.mimeType) !== 'application/pdf' ? (
            <Image source={{ uri: idPhoto.uri }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <Ionicons name="card-outline" size={21} color={colors.primary} />
          )}
          <Text style={[styles.uploadText, { color: colors.foreground }]}>
            {idPhoto ? 'ID document added ✓' : 'Photograph your National ID'}
          </Text>
          {idPhoto && !idPhotoError && !idPhotoSelectionError ? (
            <Feather name="check-circle" size={18} color={colors.success} />
          ) : null}
        </Pressable>
        {idPhotoError || idPhotoSelectionError ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>
            {idPhotoError || idPhotoSelectionError}
          </Text>
        ) : null}

        {/* Base Address / Location – Optional */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Base Address / Location <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        <TextInput
          value={baseAddress}
          onChangeText={setBaseAddress}
          placeholder="Kigali, Rwanda"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
          ]}
        />

        {/* Payment Method – Optional */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Payment Method <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        <View style={styles.rowWrap}>
          {(['MOMO', 'BANK_TRANSFER', 'CASH', 'OTHER'] as const).map((m) => {
            const selected = paymentMethod === m;
            return (
              <Pressable
                key={m}
                onPress={() => setPaymentMethod(m)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : colors.background,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                  {m.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Payment / MoMo Number – Optional */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Payment / MoMo Number <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        <TextInput
          value={paymentNumber}
          onChangeText={setPaymentNumber}
          keyboardType="phone-pad"
          placeholder="+250788123456"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
          ]}
        />
      </View>

      {/* ─── SECTION 2: TRADES & CERTIFICATES ───────────────────────────── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Section 2: Job Application &amp; Trades
        </Text>

        <Text style={[styles.label, { color: colors.foreground }]}>
          Service Experiences &amp; Years of Experience <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
        </Text>
        {serviceExperiences.map((exp, index) => {
          const isOther = exp.trade === 'Others';
          const otherSelectedTrades = serviceExperiences
            .filter((_, i) => i !== index)
            .map((e) => e.trade);
          const availableOptions = allTradeOptions.filter(
            (opt) => opt === 'Others' || opt === exp.trade || !otherSelectedTrades.includes(opt),
          );

          return (
            <View key={index} style={styles.experienceCard}>
              {!isOther ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropdownScroll}>
                  {availableOptions.map((option) => {
                    const selected = exp.trade === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => updateServiceExperience(index, 'trade', option)}
                        style={[
                          styles.tradeChip,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary : colors.background,
                          },
                        ]}
                      >
                        <Text style={[styles.tradeChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <View style={styles.experienceRow}>
                <TextInput
                  value={isOther ? exp.customName : exp.trade}
                  onChangeText={(val) => {
                    if (isOther) updateServiceExperience(index, 'customName', val);
                  }}
                  editable={isOther}
                  placeholder={isOther ? 'Enter custom trade name' : undefined}
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    { flex: 2, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                  ]}
                />

                <TextInput
                  value={String(exp.yearsOfExperience)}
                  onChangeText={(val) =>
                    updateServiceExperience(index, 'yearsOfExperience', Number(val.replace(/\D/g, '')) || 0)
                  }
                  keyboardType="number-pad"
                  placeholder="Yrs"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    styles.yearsField,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                  ]}
                />

                {serviceExperiences.length > 1 && (
                  <Pressable onPress={() => removeServiceExperience(index)} style={styles.removeBtn}>
                    <Feather name="x" size={18} color={colors.destructive} />
                  </Pressable>
                )}
              </View>

              {isOther && (
                <View style={styles.customFooter}>
                  <Text style={[styles.customBadgeText, { color: colors.primary }]}>Custom Trade</Text>
                  <Pressable
                    onPress={() => updateServiceExperience(index, 'trade', TRADES[0] ?? 'Plumbing')}
                    style={styles.switchBackBtn}
                  >
                    <Text style={[styles.switchBackText, { color: colors.mutedForeground }]}>Change to preset</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        {serviceExperiences.length < 10 && (
          <Pressable onPress={addServiceExperience} style={[styles.addExpBtn, { borderColor: colors.primary }]}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={[styles.addExpText, { color: colors.primary }]}>Add another trade &amp; experience</Text>
          </Pressable>
        )}

        {/* Certificates / TVET Papers – Optional */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Certificates / TVET Papers <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional, photo or PDF, max {MAX_UPLOAD_SIZE_LABEL} each)</Text>
        </Text>
        {certificates.map((file, index) => {
          const fileError = certificateFileErrors[index] ?? '';
          return (
            <View key={file.uri} style={{ marginTop: 4 }}>
              <View style={[styles.upload, { borderColor: fileError ? colors.destructive : colors.success }]}>
                {inferUploadMimeType(file.name ?? file.uri, file.mimeType) === 'application/pdf' ? (
                  <Ionicons name="document-text-outline" size={21} color={colors.primary} />
                ) : (
                  <Image source={{ uri: file.uri }} style={styles.thumbnail} contentFit="cover" />
                )}
                <Text style={[styles.uploadText, { color: colors.foreground }]}>Certificate {index + 1}</Text>
                <Pressable onPress={() => setCertificates((current) => current.filter((item) => item.uri !== file.uri))}>
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {fileError ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fileError}</Text> : null}
            </View>
          );
        })}
        <Pressable
          onPress={() =>
            chooseSource(
              (file) => setCertificates((current) => [...current, file]),
              setCertificateSelectionError,
            )
          }
          style={[styles.upload, styles.uploadDashed, { borderColor: colors.border }]}
        >
          <Ionicons name="document-attach-outline" size={21} color={colors.primary} />
          <Text style={[styles.uploadText, { color: colors.foreground }]}>
            {certificates.length ? 'Add another certificate' : 'Add certificate photo or PDF'}
          </Text>
        </Pressable>
        {certificateSelectionError ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{certificateSelectionError}</Text>
        ) : null}
      </View>

      {/* ─── SECTION 3: PHONE VERIFICATION (OTP) ────────────────────────── */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: isPhoneVerified ? colors.success : colors.border },
        ]}
      >
        <View style={styles.verifyHeader}>
          <Ionicons
            name={isPhoneVerified ? 'checkmark-circle' : 'phone-portrait-outline'}
            size={20}
            color={isPhoneVerified ? colors.success : colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
            Phone Verification<RequiredAsterisk />
          </Text>
          {isPhoneVerified && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
              <Text style={[styles.verifiedBadgeText, { color: '#fff' }]}>Verified</Text>
            </View>
          )}
        </View>

        {isPhoneVerified ? (
          <Text style={[styles.verifiedNote, { color: colors.success }]}>
            Your phone number has been verified. You may now submit your application.
          </Text>
        ) : (
          <>
            <Text style={[styles.verifyHint, { color: colors.mutedForeground }]}>
              We will send a {OTP_LENGTH}-digit code to{' '}
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {phoneNumber.trim() || account?.phone || 'your phone number'}
              </Text>{' '}
              to verify before application submission.
            </Text>

            {!otpSent ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleSendOtp}
                disabled={otpSending}
                style={({ pressed }) => [
                  styles.otpSendBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
                ]}
              >
                {otpSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.otpSendBtnText, { color: colors.primaryForeground }]}>
                    Send Verification Code
                  </Text>
                )}
              </Pressable>
            ) : (
              <>
                <Text style={[styles.otpPrompt, { color: colors.foreground }]}>
                  Enter the {OTP_LENGTH}-digit code sent to your phone:
                </Text>

                {/* OTP digit cells */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Enter the ${OTP_LENGTH} digit code`}
                  onPress={() => otpInputRef.current?.focus()}
                  style={styles.otpCellRow}
                >
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                    const digit = otpCode[i] ?? '';
                    const active = i === otpCode.length;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.otpCell,
                          {
                            backgroundColor: colors.background,
                            borderColor: otpError
                              ? colors.destructive
                              : active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.otpCellText, { color: colors.foreground }]}>{digit}</Text>
                      </View>
                    );
                  })}
                  <TextInput
                    ref={otpInputRef}
                    value={otpCode}
                    onChangeText={(val) => {
                      const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
                      setOtpCode(digits);
                      setOtpError('');
                      if (digits.length === OTP_LENGTH) void handleVerifyOtp(digits);
                    }}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    maxLength={OTP_LENGTH}
                    autoFocus={Platform.OS !== 'web'}
                    caretHidden
                    style={styles.otpHiddenInput}
                  />
                </Pressable>

                {otpError ? (
                  <Text style={[styles.fieldError, { color: colors.destructive }]}>{otpError}</Text>
                ) : null}

                <View style={styles.otpActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleVerifyOtp(otpCode)}
                    disabled={otpCode.length !== OTP_LENGTH || otpVerifying}
                    style={({ pressed }) => [
                      styles.otpVerifyBtn,
                      {
                        backgroundColor:
                          otpCode.length === OTP_LENGTH ? colors.primary : colors.muted,
                        opacity: pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    {otpVerifying ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text
                        style={[
                          styles.otpVerifyBtnText,
                          {
                            color:
                              otpCode.length === OTP_LENGTH
                                ? colors.primaryForeground
                                : colors.mutedForeground,
                          },
                        ]}
                      >
                        Verify Code
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSendOtp}
                    disabled={otpSending}
                    hitSlop={10}
                  >
                    <Text style={[styles.resendText, { color: colors.primary }]}>
                      {otpSending ? 'Sending…' : 'Resend code'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}
      </View>

      {/* ─── ERRORS & SUBMIT ────────────────────────────────────────────── */}
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      {applicationError ? (
        <Text style={[styles.error, { color: colors.destructive }]}>{applicationError}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready || loading }}
        onPress={submit}
        disabled={!ready || loading}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: ready ? colors.primary : colors.muted, opacity: pressed ? 0.82 : 1 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text
            style={[
              styles.submitText,
              { color: ready ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            {submitted ? 'Submitted ✓' : applicationError ? 'Retry Submission' : 'Submit Application'}
          </Text>
        )}
      </Pressable>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Only National ID number, National ID photo, and phone OTP verification are required. Other fields are optional.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 24, gap: 12 },
  intro: { flexDirection: 'row', gap: 11, alignItems: 'center', borderRadius: 16, padding: 15 },
  introText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  sectionCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 },
  optionalHint: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  experienceCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  experienceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dropdownScroll: { gap: 6, paddingVertical: 2 },
  tradeChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tradeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  customFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginTop: -2,
  },
  customBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  switchBackBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  switchBackText: { fontFamily: 'Inter_500Medium', fontSize: 11, textDecorationLine: 'underline' },
  yearsField: { width: 70, textAlign: 'center' },
  removeBtn: { padding: 12, justifyContent: 'center', alignItems: 'center' },
  addExpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  addExpText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  upload: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  uploadDashed: { borderStyle: 'dashed' },
  uploadText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  thumbnail: { width: 34, height: 34, borderRadius: 8 },
  // Verify section
  verifyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 'auto' },
  verifiedBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  verifiedNote: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  verifyHint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  otpSendBtn: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  otpSendBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  otpPrompt: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 4 },
  otpCellRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  otpCell: {
    flex: 1,
    height: 56,
    maxWidth: 64,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCellText: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  otpHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
  otpActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  otpVerifyBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpVerifyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  resendText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  // Submit area
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  fieldError: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 4, marginLeft: 4 },
  submit: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },
});