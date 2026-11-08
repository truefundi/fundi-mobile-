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
  type TextInputInstance,
  type ScrollViewInstance,
  View,
} from 'react-native';
import { TRADES } from '@/constants/work';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
import { OTP_LENGTH, RESEND_AFTER_MS } from '@/constants/auth';
import { useWork } from '@/context/WorkContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { requestLoginOtp, verifyOtp, cleanAndNormalizePhone } from '@/lib/auth-api';
import { apiRequest, ApiRequestError } from '@/lib/api';

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

export function WorkApplication() {
  const colors = useColors();
  const { apply, profile, applicationError } = useWork();
  const { account, updateRole } = useAuth();

  // ── Step Navigation ───────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // ── Step 1: Personal Details, Location & Trades ───────────────────────────
  const [fullName, setFullName] = useState(account?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(account?.phone ?? '');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'FEMALE' | 'MALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY' | undefined>(undefined);
  const [baseAddress, setBaseAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'BANK_TRANSFER' | 'CASH' | 'OTHER'>('MOMO');
  const [paymentNumber, setPaymentNumber] = useState(account?.phone ?? '');
  const [profilePicture, setProfilePicture] = useState<FileData | null>(null);
  const [profilePictureSelectionError, setProfilePictureSelectionError] = useState('');

  const [serviceExperiences, setServiceExperiences] = useState<
    Array<{ trade: string; customName: string; yearsOfExperience: number }>
  >([{ trade: TRADES[0] ?? 'Plumbing', customName: '', yearsOfExperience: 1 }]);

  // ── Step 2: Verification & KYC Documents ─────────────────────────────────
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [idPhoto, setIdPhoto] = useState<FileData | null>(null);
  const [idPhotoSelectionError, setIdPhotoSelectionError] = useState('');

  const [certificates, setCertificates] = useState<FileData[]>([]);
  const [certificateSelectionError, setCertificateSelectionError] = useState('');

  // ── Phone Verification ────────────────────────────────────────────────────
  const [isPhoneVerified, setIsPhoneVerified] = useState(() => Boolean(account?.phone));
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<TextInputInstance>(null);

  // ── General State ─────────────────────────────────────────────────────────
  const [step1Errors, setStep1Errors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from account
  useEffect(() => {
    if (account) {
      if (account.name && !fullName) setFullName(account.name);
      if (account.phone) {
        if (!phoneNumber) setPhoneNumber(account.phone);
        if (!paymentNumber) setPaymentNumber(account.phone);
        setIsPhoneVerified(true);
      }
    }
  }, [account]);

  // Pre-fill from existing profile draft
  useEffect(() => {
    if (!profile) return;
    if (profile.fullName) setFullName(profile.fullName);
    if (profile.phoneNumber) setPhoneNumber(profile.phoneNumber);
    if (profile.email) setEmail(profile.email);
    if (profile.gender) setGender(profile.gender);
    if (profile.nationalIdNumber) setNationalIdNumber(profile.nationalIdNumber);
    if (profile.baseAddress) setBaseAddress(profile.baseAddress);
    if (profile.paymentMethod) setPaymentMethod(profile.paymentMethod);
    if (profile.paymentNumber) setPaymentNumber(profile.paymentNumber);

    if (profile.profilePictureUri || profile.profilePictureUrl) {
      setProfilePicture({
        uri: profile.profilePictureUri || profile.profilePictureUrl!,
        size: profile.profilePictureSizeBytes,
        mimeType: profile.profilePictureMimeType,
      });
    }

    if (profile.idPhotoUri) {
      setIdPhoto({
        uri: profile.idPhotoUri,
        size: profile.idPhotoSizeBytes,
        mimeType: profile.idPhotoMimeType,
      });
    }

    if (profile.certificateUris?.length) {
      setCertificates(
        profile.certificateUris.map((uri, index) => ({
          uri,
          size: profile.certificateSizeBytes?.[index],
          mimeType: profile.certificateMimeTypes?.[index],
        })),
      );
    }

    if (profile.serviceExperiences?.length) {
      setServiceExperiences(profile.serviceExperiences);
    }
  }, [profile]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ── Validation Helpers ────────────────────────────────────────────────────
  const emailError =
    email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Invalid email format' : '';

  const idError =
    nationalIdNumber.trim() && !/^\d{16}$/.test(nationalIdNumber.trim())
      ? 'National ID must be exactly 16 digits'
      : '';

  const getFileError = (file: FileData | null, allowPdf = false) => {
    if (!file) return '';
    if (/^https?:\/\//i.test(file.uri)) return '';
    if (file.size === undefined || !Number.isFinite(file.size) || file.size < 0) {
      return `File size check unavailable. Please choose again (max ${MAX_UPLOAD_SIZE_LABEL}).`;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return `File exceeds ${MAX_UPLOAD_SIZE_LABEL}. Please choose a smaller one.`;
    }
    const mimeType = inferUploadMimeType(file.name ?? file.uri, file.mimeType);
    if (mimeType?.startsWith('image/')) return '';
    if (allowPdf && mimeType === 'application/pdf') return '';
    return allowPdf ? 'Choose a photo or PDF file.' : 'Choose a photo file.';
  };

  // ── File Pickers ──────────────────────────────────────────────────────────
  async function pickFromLibrary(imagesOnly: boolean): Promise<FileData | null> {
    if (imagesOnly) {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.78 });
      if (result.canceled || !result.assets[0]?.uri) return null;
      const asset = result.assets[0];
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
      } catch (err) {
        setSourceError(err instanceof Error ? err.message : 'Could not open file.');
      }
    };

    if (Platform.OS === 'web') {
      void select('library');
      return;
    }
    Alert.alert(imagesOnly ? 'Add a photo' : 'Add a document', undefined, [
      { text: 'Take photo', onPress: () => void select('camera') },
      { text: 'Upload file', onPress: () => void select('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // ── Trades Helpers ────────────────────────────────────────────────────────
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
    if (serviceExperiences.length <= 1) return;
    setServiceExperiences(serviceExperiences.filter((_, i) => i !== index));
  };

  // ── Step 1 Validation & Transition ────────────────────────────────────────
  const handleProceedToStep2 = async () => {
    const errors: { [key: string]: string } = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full name.';
    }

    const cleanPhone = cleanAndNormalizePhone(phoneNumber.trim() || account?.phone || '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phoneNumber = 'Please enter a valid phone number (+25078/79/72/73...).';
    }

    if (!baseAddress.trim()) {
      errors.baseAddress = 'Please enter your base address or city.';
    }

    if (emailError) {
      errors.email = emailError;
    }

    const hasInvalidTrade = serviceExperiences.some(
      (exp) => exp.trade === 'Others' && !exp.customName.trim(),
    );
    if (hasInvalidTrade) {
      errors.trades = 'Please name your custom trade.';
    }

    if (Object.keys(errors).length > 0) {
      setStep1Errors(errors);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setStep1Errors({});
    setGeneralError('');
    setCurrentStep(2);
    scrollRef.current?.scrollTo({ y: 0, animated: true });

    // If phone isn't verified yet, trigger public registration OTP automatically
    if (!isPhoneVerified && !otpSent) {
      void handleSendOtp();
    }
  };

  // ── OTP Helpers (Step 2) ──────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const rawPhone = phoneNumber.trim() || account?.phone || '';
    if (!rawPhone) {
      setOtpError('Phone number missing. Please check Step 1.');
      return;
    }
    const cleanPhone = cleanAndNormalizePhone(rawPhone);

    setOtpSending(true);
    setOtpError('');
    setOtpCode('');

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
      } catch {}

      const formattedExperiences = serviceExperiences.map((exp) => ({
        customName: exp.trade === 'Others' ? (exp.customName.trim() || 'Other') : exp.trade,
        yearsOfExperience: Number(exp.yearsOfExperience) || 0,
      }));

      const activePayment = cleanAndNormalizePhone(paymentNumber.trim() || cleanPhone);

      try {
        await apiRequest('/api/v1/technicians/register', {
          method: 'POST',
          body: {
            user: {
              fullName: fullName.trim() || account?.name || 'Technician',
              phoneNumber: cleanPhone,
              ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
            },
            profile: {
              gender: gender || 'PREFER_NOT_TO_SAY',
              nationalIdNumber: nationalIdNumber.trim() || '1199080000000000',
              baseAddress: baseAddress.trim() || 'Kigali, Rwanda',
              publicLocationLabel: (baseAddress.trim() || 'Kigali').split(',')[0].trim(),
              baseLatitude,
              baseLongitude,
              paymentMethod,
              paymentNumber: activePayment,
              serviceExperiences: formattedExperiences,
            },
          },
        });
      } catch (regErr) {
        if (regErr instanceof ApiRequestError && regErr.status === 409) {
          await requestLoginOtp(cleanPhone);
        } else {
          throw regErr;
        }
      }

      setOtpSent(true);
      setResendCooldown(30);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not send verification code.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (enteredCode: string) => {
    const rawPhone = phoneNumber.trim() || account?.phone || '';
    const cleanPhone = cleanAndNormalizePhone(rawPhone);
    setOtpVerifying(true);
    setOtpError('');
    try {
      const res = await verifyOtp(cleanPhone, enteredCode);
      if (res.user) {
        setIsPhoneVerified(true);
        setOtpSent(false);
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Incorrect verification code. Please try again.');
      setOtpCode('');
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Final Application Submit (Step 2) ────────────────────────────────────
  const handleFinalSubmit = async () => {
    if (!isPhoneVerified) {
      setGeneralError('Please verify your phone number with the SMS code.');
      return;
    }
    if (!nationalIdNumber.trim() || idError) {
      setGeneralError('Please enter a valid 16-digit National ID number.');
      return;
    }
    if (!idPhoto) {
      setGeneralError('Please upload your National ID card document.');
      return;
    }

    setGeneralError('');
    setSubmitting(true);

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
      } catch {}

      const cleanPhone = cleanAndNormalizePhone(phoneNumber.trim() || account?.phone || '');
      const activePayment = cleanAndNormalizePhone(paymentNumber.trim() || cleanPhone);

      await apply({
        fullName: fullName.trim() || account?.name || 'Technician',
        phoneNumber: cleanPhone,
        trade: serviceExperiences[0]?.trade ?? 'Plumbing',
        yearsExperience: Number(serviceExperiences[0]?.yearsOfExperience) || 1,
        profilePictureUri: profilePicture?.uri,
        profilePictureSizeBytes: profilePicture?.size,
        profilePictureMimeType: profilePicture?.mimeType,
        idPhotoUri: idPhoto.uri,
        idPhotoSizeBytes: idPhoto.size,
        idPhotoMimeType: idPhoto.mimeType,
        certificateUris: certificates.map((c) => c.uri),
        certificateSizeBytes: certificates.map((c) => c.size),
        certificateMimeTypes: certificates.map((c) => c.mimeType),
        email: email.trim() || undefined,
        gender: gender || 'PREFER_NOT_TO_SAY',
        nationalIdNumber: nationalIdNumber.trim(),
        baseAddress: baseAddress.trim(),
        paymentMethod,
        paymentNumber: activePayment,
        baseLatitude,
        baseLongitude,
        serviceExperiences: serviceExperiences.map((exp) => ({
          trade: exp.trade,
          customName: exp.trade === 'Others' ? (exp.customName.trim() || 'Other') : exp.trade,
          yearsOfExperience: Number(exp.yearsOfExperience) || 0,
        })),
      });

      if (account?.phone) {
        await updateRole('TECHNICIAN');
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Application submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Top Header & 2-Step Progress Indicator ──────────────────────── */}
      <View style={styles.headerBlock}>
        <Text style={[styles.mainTitle, { color: colors.foreground }]}>Technician Application</Text>
        <Text style={[styles.mainSubtitle, { color: colors.mutedForeground }]}>
          {currentStep === 1
            ? 'Step 1 of 2: Profile details & trade qualifications'
            : 'Step 2 of 2: Phone verification & KYC credentials'}
        </Text>

        {/* Stepper Wizard Bar */}
        <View style={styles.stepperRow}>
          {/* Step 1 Pill */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setCurrentStep(1)}
            style={[
              styles.stepBadge,
              {
                backgroundColor: currentStep === 1 ? colors.primary : colors.card,
                borderColor: currentStep === 1 ? colors.primary : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.stepNumberCircle,
                {
                  backgroundColor:
                    currentStep === 1
                      ? colors.primaryForeground
                      : isPhoneVerified
                      ? colors.success
                      : colors.muted,
                },
              ]}
            >
              {currentStep === 2 ? (
                <Feather name="check" size={13} color="#ffffff" />
              ) : (
                <Text
                  style={[
                    styles.stepNumberText,
                    { color: currentStep === 1 ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  1
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepBadgeLabel,
                {
                  color: currentStep === 1 ? colors.primaryForeground : colors.foreground,
                },
              ]}
            >
              Profile & Trades
            </Text>
          </Pressable>

          {/* Connecting Connector Line */}
          <View
            style={[
              styles.stepConnector,
              { backgroundColor: currentStep === 2 ? colors.primary : colors.border },
            ]}
          />

          {/* Step 2 Pill */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (currentStep === 1) void handleProceedToStep2();
            }}
            style={[
              styles.stepBadge,
              {
                backgroundColor: currentStep === 2 ? colors.primary : colors.card,
                borderColor: currentStep === 2 ? colors.primary : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.stepNumberCircle,
                {
                  backgroundColor: currentStep === 2 ? colors.primaryForeground : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.stepNumberText,
                  { color: currentStep === 2 ? colors.primary : colors.mutedForeground },
                ]}
              >
                2
              </Text>
            </View>
            <Text
              style={[
                styles.stepBadgeLabel,
                {
                  color: currentStep === 2 ? colors.primaryForeground : colors.mutedForeground,
                },
              ]}
            >
              Verify & Docs
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── STEP 1: Personal Details, Location & Trades ─────────────────── */}
      {currentStep === 1 && (
        <View style={styles.stepContent}>
          {/* Profile Picture Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Profile Photo</Text>
            <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
              Optional professional photo for your customer-facing profile.
            </Text>

            <View style={styles.avatarRow}>
              {profilePicture?.uri ? (
                <Image source={{ uri: profilePicture.uri }} style={styles.avatarPreview} contentFit="cover" />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.muted }]}>
                  <Feather name="user" size={32} color={colors.mutedForeground} />
                </View>
              )}

              <View style={styles.avatarActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    chooseSource(
                      (file) => setProfilePicture(file),
                      setProfilePictureSelectionError,
                      true,
                    )
                  }
                  style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="camera" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.smallBtnText, { color: colors.primaryForeground }]}>
                    {profilePicture ? 'Change Photo' : 'Upload Photo'}
                  </Text>
                </Pressable>

                {profilePicture ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setProfilePicture(null)}
                    style={[styles.smallBtnOutline, { borderColor: colors.destructive }]}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                    <Text style={[styles.smallBtnText, { color: colors.destructive }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {profilePictureSelectionError ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {profilePictureSelectionError}
              </Text>
            ) : null}
          </View>

          {/* Identity Information Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Personal Information</Text>

            {/* Full Name */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              Full Name <Text style={{ color: colors.destructive }}>*</Text>
            </Text>
            <TextInput
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (step1Errors.fullName) setStep1Errors({ ...step1Errors, fullName: '' });
              }}
              placeholder="First and last name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: step1Errors.fullName ? colors.destructive : colors.border,
                  color: colors.foreground,
                },
              ]}
            />
            {step1Errors.fullName ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>{step1Errors.fullName}</Text>
            ) : null}

            {/* Phone Number */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              Phone Number <Text style={{ color: colors.destructive }}>*</Text>
            </Text>
            <TextInput
              value={phoneNumber}
              onChangeText={(val) => {
                setPhoneNumber(val);
                const currentClean = cleanAndNormalizePhone(val || '');
                const accountClean = cleanAndNormalizePhone(account?.phone ?? '');
                if (account?.phone && currentClean === accountClean) {
                  setIsPhoneVerified(true);
                } else {
                  setIsPhoneVerified(false);
                  setOtpSent(false);
                }
                if (step1Errors.phoneNumber) setStep1Errors({ ...step1Errors, phoneNumber: '' });
              }}
              keyboardType="phone-pad"
              placeholder="+250788123456"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: step1Errors.phoneNumber ? colors.destructive : colors.border,
                  color: colors.foreground,
                },
              ]}
            />
            {step1Errors.phoneNumber ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {step1Errors.phoneNumber}
              </Text>
            ) : null}

            {/* Email Address */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              Email Address <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="technician@example.com"
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

            {/* Gender Selection */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              Gender <Text style={[styles.optionalHint, { color: colors.mutedForeground }]}> (optional)</Text>
            </Text>
            <View style={styles.rowWrap}>
              {(['FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] as const).map((g) => {
                const selected = gender === g;
                return (
                  <Pressable
                    key={g}
                    accessibilityRole="button"
                    onPress={() => setGender(selected ? undefined : g)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {g.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Location & Payout Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Location & Payout</Text>

            {/* Base Address */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              Base Address / City <Text style={{ color: colors.destructive }}>*</Text>
            </Text>
            <TextInput
              value={baseAddress}
              onChangeText={(val) => {
                setBaseAddress(val);
                if (step1Errors.baseAddress) setStep1Errors({ ...step1Errors, baseAddress: '' });
              }}
              placeholder="e.g. Kigali, Nyarugenge"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: step1Errors.baseAddress ? colors.destructive : colors.border,
                  color: colors.foreground,
                },
              ]}
            />
            {step1Errors.baseAddress ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {step1Errors.baseAddress}
              </Text>
            ) : null}

            {/* Payment Method */}
            <Text style={[styles.label, { color: colors.foreground }]}>Payout Method</Text>
            <View style={styles.rowWrap}>
              {(['MOMO', 'BANK_TRANSFER', 'CASH', 'OTHER'] as const).map((m) => {
                const selected = paymentMethod === m;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    onPress={() => setPaymentMethod(m)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {m.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Payment Number */}
            <Text style={[styles.label, { color: colors.foreground }]}>Payout Phone / Account</Text>
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

          {/* Trades & Experience Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Trades & Skills</Text>
                <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
                  Select the services you offer and your experience.
                </Text>
              </View>
              {serviceExperiences.length < 10 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={addServiceExperience}
                  style={[styles.addTradeBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                >
                  <Feather name="plus" size={14} color={colors.primary} />
                  <Text style={[styles.addTradeText, { color: colors.primary }]}>Add Trade</Text>
                </Pressable>
              ) : null}
            </View>

            {serviceExperiences.map((exp, idx) => (
              <View
                key={`trade-${idx}`}
                style={[
                  styles.tradeBlock,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <View style={styles.tradeHeader}>
                  <Text style={[styles.tradeIndexTitle, { color: colors.foreground }]}>
                    Trade #{idx + 1}
                  </Text>
                  {serviceExperiences.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => removeServiceExperience(idx)}
                      hitSlop={8}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Trade Selector */}
                <View style={styles.rowWrap}>
                  {TRADES.map((trade) => {
                    const isSelected = exp.trade === trade;
                    return (
                      <Pressable
                        key={trade}
                        accessibilityRole="button"
                        onPress={() => updateServiceExperience(idx, 'trade', trade)}
                        style={[
                          styles.chip,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? colors.primary : colors.card,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? colors.primaryForeground : colors.foreground },
                          ]}
                        >
                          {trade}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {exp.trade === 'Others' ? (
                  <TextInput
                    value={exp.customName}
                    onChangeText={(val) => updateServiceExperience(idx, 'customName', val)}
                    placeholder="Enter custom trade name"
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        color: colors.foreground,
                        marginTop: 8,
                      },
                    ]}
                  />
                ) : null}

                {/* Experience Stepper */}
                <View style={styles.yearsRow}>
                  <Text style={[styles.label, { color: colors.foreground, marginTop: 0 }]}>
                    Years of experience:
                  </Text>
                  <View style={styles.stepperControl}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        updateServiceExperience(
                          idx,
                          'yearsOfExperience',
                          Math.max(1, (exp.yearsOfExperience || 1) - 1),
                        )
                      }
                      style={[styles.stepperBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Feather name="minus" size={14} color={colors.foreground} />
                    </Pressable>
                    <Text style={[styles.stepperVal, { color: colors.foreground }]}>
                      {exp.yearsOfExperience} {exp.yearsOfExperience === 1 ? 'yr' : 'yrs'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        updateServiceExperience(
                          idx,
                          'yearsOfExperience',
                          Math.min(40, (exp.yearsOfExperience || 1) + 1),
                        )
                      }
                      style={[styles.stepperBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Feather name="plus" size={14} color={colors.foreground} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            {step1Errors.trades ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>{step1Errors.trades}</Text>
            ) : null}
          </View>

          {/* Continue to Step 2 Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleProceedToStep2()}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Continue to Verification & Documents →
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── STEP 2: Phone OTP Verification & KYC Documents ──────────────── */}
      {currentStep === 2 && (
        <View style={styles.stepContent}>
          {/* Phone Verification Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Phone Verification</Text>
            <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
              A verified phone number is required to receive technician job dispatches.
            </Text>

            {isPhoneVerified ? (
              <View
                style={[
                  styles.verifiedBadgeRow,
                  { backgroundColor: colors.successMuted, borderColor: colors.success },
                ]}
              >
                <Feather name="check-circle" size={20} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.verifiedBadgeTitle, { color: colors.success }]}>
                    Phone Verified
                  </Text>
                  <Text style={[styles.verifiedBadgeSubtitle, { color: colors.foreground }]}>
                    {cleanAndNormalizePhone(phoneNumber || account?.phone || '')}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.otpBlock}>
                <View style={styles.unverifiedNotice}>
                  <Text style={[styles.bodyText, { color: colors.foreground }]}>
                    Send a 6-digit SMS verification code to:{' '}
                    <Text style={{ fontFamily: 'Inter_700Bold' }}>
                      {cleanAndNormalizePhone(phoneNumber || account?.phone || '')}
                    </Text>
                  </Text>
                </View>

                {!otpSent ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleSendOtp()}
                    disabled={otpSending}
                    style={[styles.sendCodeBtn, { backgroundColor: colors.primary }]}
                  >
                    {otpSending ? (
                      <ActivityIndicator color={colors.primaryForeground} size="small" />
                    ) : (
                      <>
                        <Feather name="send" size={15} color={colors.primaryForeground} />
                        <Text style={[styles.sendCodeText, { color: colors.primaryForeground }]}>
                          Send Verification Code
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.otpEntrySection}>
                    <Text style={[styles.label, { color: colors.foreground, marginTop: 10 }]}>
                      Enter 6-digit Code:
                    </Text>

                    {/* 6-Digit OTP Cells */}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => otpInputRef.current?.focus()}
                      style={styles.cellRow}
                    >
                      {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                        const digit = otpCode[index] ?? '';
                        const active = index === otpCode.length;
                        return (
                          <View
                            key={index}
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
                            <Text style={[styles.otpCellText, { color: colors.foreground }]}>
                              {digit}
                            </Text>
                          </View>
                        );
                      })}
                      <TextInput
                        ref={otpInputRef}
                        accessibilityLabel="Verification code input"
                        value={otpCode}
                        onChangeText={(val) => {
                          const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
                          setOtpCode(digits);
                          setOtpError('');
                          if (digits.length === OTP_LENGTH) {
                            void handleVerifyOtp(digits);
                          }
                        }}
                        keyboardType="number-pad"
                        maxLength={OTP_LENGTH}
                        style={styles.hiddenInput}
                        caretHidden
                      />
                    </Pressable>

                    {otpVerifying ? (
                      <View style={styles.verifyingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.verifyingText, { color: colors.primary }]}>
                          Verifying code…
                        </Text>
                      </View>
                    ) : null}

                    {otpError ? (
                      <Text style={[styles.fieldError, { color: colors.destructive }]}>
                        {otpError}
                      </Text>
                    ) : null}

                    {/* Resend Action */}
                    <View style={styles.resendRow}>
                      {resendCooldown > 0 ? (
                        <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                          Resend code in {resendCooldown}s
                        </Text>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void handleSendOtp()}
                          hitSlop={8}
                        >
                          <Text style={[styles.resendAction, { color: colors.primary }]}>
                            Resend verification code
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* National ID Document Card (REQUIRED) */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              National ID Document <Text style={{ color: colors.destructive }}>*</Text>
            </Text>
            <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
              Required for identity verification by Fundi administration.
            </Text>

            {/* 16-Digit National ID Number */}
            <Text style={[styles.label, { color: colors.foreground }]}>
              16-Digit National ID Number <Text style={{ color: colors.destructive }}>*</Text>
            </Text>
            <TextInput
              value={nationalIdNumber}
              onChangeText={setNationalIdNumber}
              keyboardType="number-pad"
              maxLength={16}
              placeholder="1 1990 8 0012345 6 78"
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

            {/* National ID Document Picker */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>
              National ID Card Photo / Document <Text style={{ color: colors.destructive }}>*</Text>
            </Text>

            {idPhoto ? (
              <View
                style={[
                  styles.docPreviewCard,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <View style={styles.docIconBox}>
                  <Feather name="file-text" size={24} color={colors.primary} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docName, { color: colors.foreground }]} numberOfLines={1}>
                    {idPhoto.name ?? 'National ID card'}
                  </Text>
                  <Text style={[styles.docMeta, { color: colors.mutedForeground }]}>
                    {idPhoto.size ? `${(idPhoto.size / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                    {idPhoto.mimeType?.includes('pdf') ? 'PDF Document' : 'ID Photo'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIdPhoto(null)}
                  hitSlop={8}
                  style={styles.docRemoveBtn}
                >
                  <Feather name="x" size={18} color={colors.destructive} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  chooseSource((file) => setIdPhoto(file), setIdPhotoSelectionError, false)
                }
                style={[
                  styles.uploadDropzone,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Feather name="upload-cloud" size={28} color={colors.primary} />
                <Text style={[styles.uploadDropzoneTitle, { color: colors.foreground }]}>
                  Upload National ID Card
                </Text>
                <Text style={[styles.uploadDropzoneHint, { color: colors.mutedForeground }]}>
                  Take a photo or upload PDF (max {MAX_UPLOAD_SIZE_LABEL})
                </Text>
              </Pressable>
            )}
            {idPhotoSelectionError ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {idPhotoSelectionError}
              </Text>
            ) : null}
          </View>

          {/* TVET & Trade Certificates Card (OPTIONAL) */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  Trade Certificates
                </Text>
                <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
                  Optional TVET, diploma, or vocational certifications.
                </Text>
              </View>
              {certificates.length < 5 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    chooseSource(
                      (file) => setCertificates([...certificates, file]),
                      setCertificateSelectionError,
                      false,
                    )
                  }
                  style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="plus" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.smallBtnText, { color: colors.primaryForeground }]}>
                    Add Cert
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {certificates.map((cert, idx) => (
              <View
                key={`cert-${idx}`}
                style={[
                  styles.docPreviewCard,
                  { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 },
                ]}
              >
                <View style={styles.docIconBox}>
                  <Feather name="award" size={22} color={colors.primary} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docName, { color: colors.foreground }]} numberOfLines={1}>
                    {cert.name ?? `Certificate ${idx + 1}`}
                  </Text>
                  <Text style={[styles.docMeta, { color: colors.mutedForeground }]}>
                    {cert.size ? `${(cert.size / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                    {cert.mimeType?.includes('pdf') ? 'PDF Document' : 'Certificate Image'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCertificates(certificates.filter((_, i) => i !== idx))}
                  hitSlop={8}
                  style={styles.docRemoveBtn}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </View>
            ))}
            {certificateSelectionError ? (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {certificateSelectionError}
              </Text>
            ) : null}
          </View>

          {/* General Error or Application Failure */}
          {generalError || applicationError ? (
            <View
              style={[
                styles.errorCard,
                { backgroundColor: colors.destructiveMuted, borderColor: colors.destructive },
              ]}
            >
              <Feather name="alert-triangle" size={18} color={colors.destructive} />
              <Text style={[styles.errorCardText, { color: colors.destructive }]}>
                {generalError || applicationError}
              </Text>
            </View>
          ) : null}

          {/* Action Buttons: Submit & Back */}
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleFinalSubmit()}
            disabled={submitting}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: submitting ? 0.7 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                Submit Application for Review
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setCurrentStep(1);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            style={[styles.secondaryBackBtn, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={16} color={colors.foreground} />
            <Text style={[styles.secondaryBackText, { color: colors.foreground }]}>
              Back to Profile & Trades
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  headerBlock: {
    gap: 6,
    marginBottom: 4,
  },
  mainTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
  },
  mainSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flex: 1,
    justifyContent: 'center',
  },
  stepNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  stepBadgeLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  stepConnector: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  stepContent: {
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  cardHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginTop: 6,
  },
  optionalHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  fieldError: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  avatarPreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActions: {
    gap: 8,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  smallBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
  },
  smallBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  addTradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  addTradeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  tradeBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginTop: 6,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tradeIndexTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  yearsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    minWidth: 42,
    textAlign: 'center',
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  secondaryBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBackText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  verifiedBadgeTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  verifiedBadgeSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  otpBlock: {
    gap: 10,
    marginTop: 4,
  },
  unverifiedNotice: {
    marginBottom: 4,
  },
  bodyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  sendCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
  },
  sendCodeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  otpEntrySection: {
    gap: 8,
  },
  cellRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    height: 52,
    gap: 8,
    marginVertical: 4,
  },
  otpCell: {
    flex: 1,
    height: 52,
    maxWidth: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCellText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    height: '100%',
    width: '100%',
    color: 'transparent',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  verifyingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  resendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  resendAction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  uploadDropzoneTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  uploadDropzoneHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  docPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
    gap: 2,
  },
  docName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  docMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  docRemoveBtn: {
    padding: 6,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorCardText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    flex: 1,
  },
});
