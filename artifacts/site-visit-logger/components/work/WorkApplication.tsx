import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Alert, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { TRADES } from '@/constants/work';
import { inferUploadMimeType, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_LABEL } from '@/constants/uploads';
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
    mimeType: inferUploadMimeType(asset.fileName ?? asset.uri, asset.mimeType) ??
      (asset.type === 'image' ? 'image/jpeg' : undefined),
  });
}

export function WorkApplication() {
  const colors = useColors();
  const { apply, profile, applicationError } = useWork();
  const { account } = useAuth();

  // Section 1: Profile & Identity Information (Prepopulated from account)[cite: 3]
  const [fullName, setFullName] = useState(account?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(account?.phone ?? '');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'FEMALE' | 'MALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY'>('FEMALE');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [baseAddress, setBaseAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'BANK_TRANSFER' | 'CASH' | 'OTHER'>('MOMO');
  const [paymentNumber, setPaymentNumber] = useState(account?.phone ?? '');
  
  // Keep picker metadata to validate file type and size before upload.
  const [profilePicture, setProfilePicture] = useState<FileData | null>(null);
  const [idPhoto, setIdPhoto] = useState<FileData | null>(null);
  const [profilePictureSelectionError, setProfilePictureSelectionError] = useState('');
  const [idPhotoSelectionError, setIdPhotoSelectionError] = useState('');
  const [certificateSelectionError, setCertificateSelectionError] = useState('');

  // Section 2: Job Application & Multiple Service Experiences
  const [serviceExperiences, setServiceExperiences] = useState<Array<{ trade: string; customName: string; yearsOfExperience: number }>>([
    { trade: TRADES[0] ?? 'Plumbing', customName: '', yearsOfExperience: 1 },
  ]);
  const [certificates, setCertificates] = useState<FileData[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (account) {
      if (account.name) setFullName(account.name);
      if (account.phone) {
        setPhoneNumber(account.phone);
        setPaymentNumber(account.phone);
      }
    }
  }, [account]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? account?.name ?? '');
    setPhoneNumber(profile.phoneNumber ?? account?.phone ?? '');
    setEmail(profile.email ?? '');
    setGender(profile.gender ?? 'FEMALE');
    setNationalIdNumber(profile.nationalIdNumber ?? '');
    setBaseAddress(profile.baseAddress ?? '');
    setPaymentMethod(profile.paymentMethod ?? 'MOMO');
    setPaymentNumber(profile.paymentNumber ?? account?.phone ?? '');
    
    setProfilePicture(profile.profilePictureUri || profile.profilePictureUrl ? {
      uri: profile.profilePictureUri || profile.profilePictureUrl!,
      size: profile.profilePictureSizeBytes,
      mimeType: profile.profilePictureMimeType,
    } : null);
    
    setIdPhoto(profile.idPhotoUri ? {
      uri: profile.idPhotoUri,
      size: profile.idPhotoSizeBytes,
      mimeType: profile.idPhotoMimeType,
    } : null);
    
    setCertificates(profile.certificateUris?.map((uri, index) => ({
      uri,
      size: profile.certificateSizeBytes?.[index],
      mimeType: profile.certificateMimeTypes?.[index],
    })) || []);
    
    if (profile.serviceExperiences?.length) {
      setServiceExperiences(profile.serviceExperiences);
    }
  }, [account, profile]);

  // Validations
  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Invalid email format' : '';
  const idError = nationalIdNumber && !/^\d{16}$/.test(nationalIdNumber) ? 'National ID must be exactly 16 digits' : '';

  const getFileError = (file: FileData | null, allowPdf = false) => {
    if (!file) return '';
    if (/^https?:\/\//i.test(file.uri)) return ''; // Skip size checks for already uploaded remote URLs
    
    if (file.size === undefined || !Number.isFinite(file.size) || file.size < 0) {
      return `We couldn't check this file's size. Please choose it again (maximum ${MAX_UPLOAD_SIZE_LABEL}).`;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return `This file is larger than ${MAX_UPLOAD_SIZE_LABEL}. Please choose a smaller one.`;
    }
    const mimeType = inferUploadMimeType(file.name ?? file.uri, file.mimeType);
    if (mimeType?.startsWith('image/')) return '';
    if (allowPdf && mimeType === 'application/pdf') return '';
    return allowPdf
      ? 'Choose a photo or PDF file.'
      : 'Choose a photo. Videos and documents cannot be used as a profile picture.';
  };

  const profilePicError = getFileError(profilePicture);
  const idPhotoError = getFileError(idPhoto, true);
  const certificateFileErrors = certificates.map((file) => getFileError(file, true));

  const isProfileComplete =
    !!fullName.trim() &&
    !!phoneNumber.trim() &&
    !!nationalIdNumber.trim() &&
    !!baseAddress.trim() &&
    !!paymentNumber.trim() &&
    !!profilePicture &&
    !!idPhoto;

  const isJobAppComplete =
    serviceExperiences.length > 0 &&
    serviceExperiences.every((exp) => {
      const name = exp.trade === 'Others' ? exp.customName.trim() : exp.trade;
      return name.length > 0 && exp.yearsOfExperience >= 0;
    }) &&
    certificates.length > 0;

  const noValidationErrors =
    !emailError &&
    !idError &&
    !profilePicError &&
    !idPhotoError &&
    !profilePictureSelectionError &&
    !idPhotoSelectionError &&
    !certificateSelectionError &&
    certificateFileErrors.every((message) => !message);

  const ready = isProfileComplete && isJobAppComplete && noValidationErrors;

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
        mimeType: inferUploadMimeType(asset.fileName ?? asset.uri, asset.mimeType) ??
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
    Alert.alert(imagesOnly ? 'Add a profile photo' : 'Add a document', undefined, [
      { text: 'Take a photo', onPress: () => { void select('camera'); } },
      { text: 'Upload a file', onPress: () => { void select('library'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const addServiceExperience = () => {
    if (serviceExperiences.length >= 10) return;
    const selectedTrades = serviceExperiences.map((e) => e.trade);
    const availableTrade = TRADES.find((t) => !selectedTrades.includes(t)) ?? 'Others';
    setServiceExperiences([...serviceExperiences, { trade: availableTrade, customName: '', yearsOfExperience: 1 }]);
  };

  const updateServiceExperience = (index: number, field: 'trade' | 'customName' | 'yearsOfExperience', value: string | number) => {
    const updated = [...serviceExperiences];
    updated[index] = { ...updated[index], [field]: value };
    setServiceExperiences(updated);
  };

  const removeServiceExperience = (index: number) => {
    setServiceExperiences(serviceExperiences.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!ready) return;
    setError('');
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission is required to register your service area.');
      const position = await Location.getCurrentPositionAsync({});
      
      const formattedExperiences = serviceExperiences.map((exp) => ({
        trade: exp.trade,
        customName: exp.trade === 'Others' ? exp.customName.trim() : exp.trade,
        yearsOfExperience: Number(exp.yearsOfExperience) || 0,
      }));

      await apply({
        fullName,
        phoneNumber,
        email,
        gender,
        nationalIdNumber,
        baseAddress,
        baseLatitude: position.coords.latitude,
        baseLongitude: position.coords.longitude,
        paymentMethod,
        paymentNumber,
        profilePictureUri: profilePicture?.uri,
        profilePictureMimeType: profilePicture?.mimeType,
        profilePictureSizeBytes: profilePicture?.size,
        idPhotoUri: idPhoto?.uri,
        idPhotoMimeType: idPhoto?.mimeType,
        idPhotoSizeBytes: idPhoto?.size,
        certificateUris: certificates.map(c => c.uri),
        certificateMimeTypes: certificates.map((file) => file.mimeType),
        certificateSizeBytes: certificates.map((file) => file.size),
        yearsExperience: Math.max(...formattedExperiences.map((e) => e.yearsOfExperience), 0),
        trade: formattedExperiences[0]?.customName || 'General',
        serviceExperiences: formattedExperiences,
      });
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
          Complete your profile details and submit your verified trade qualifications to start accepting jobs.
        </Text>
      </View>

      {/* SECTION 1: PROFILE & IDENTITY */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Section 1: Profile & Identity</Text>

        <Text style={[styles.label, { color: colors.foreground }]}>Profile Picture (photo only, max {MAX_UPLOAD_SIZE_LABEL})<RequiredAsterisk/></Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => chooseSource((file) => setProfilePicture(file), setProfilePictureSelectionError, true)}
          style={[styles.upload, { borderColor: profilePicError || profilePictureSelectionError ? colors.destructive : profilePicture ? colors.success : colors.border }]}
        >
          {profilePicture ? (
            <Image source={{ uri: profilePicture.uri }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <Ionicons name="person-circle-outline" size={21} color={colors.primary} />
          )}
          <Text style={[styles.uploadText, { color: colors.foreground }]}>{profilePicture ? 'Picture added' : 'Upload profile picture'}</Text>
          {profilePicture && !profilePicError && !profilePictureSelectionError ? <Feather name="check-circle" size={18} color={colors.success} /> : null}
        </Pressable>
        {profilePicError || profilePictureSelectionError ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{profilePicError || profilePictureSelectionError}</Text>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Full Name<RequiredAsterisk/></Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Amina Example"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Phone Number<RequiredAsterisk/></Text>
        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          placeholder="+250788123456"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="amina@example.com"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: emailError ? colors.destructive : colors.border, color: colors.foreground }]}
        />
        {emailError ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{emailError}</Text> : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Gender<RequiredAsterisk/></Text>
        <View style={styles.rowWrap}>
          {(['FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY'] as const).map((g) => {
            const selected = gender === g;
            return (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                style={[
                  styles.chip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{g.replace(/_/g, ' ')}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>National ID Number<RequiredAsterisk/></Text>
        <TextInput
          value={nationalIdNumber}
          onChangeText={setNationalIdNumber}
          placeholder="1234567890123456"
          keyboardType="number-pad"
          maxLength={16}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: idError ? colors.destructive : colors.border, color: colors.foreground }]}
        />
        {idError ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{idError}</Text> : null}

        <Text style={[styles.label, { color: colors.foreground }]}>National ID Document (photo or PDF, max {MAX_UPLOAD_SIZE_LABEL})<RequiredAsterisk/></Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => chooseSource((file) => setIdPhoto(file), setIdPhotoSelectionError)}
          style={[styles.upload, { borderColor: idPhotoError || idPhotoSelectionError ? colors.destructive : idPhoto ? colors.success : colors.border }]}
        >
          {idPhoto && inferUploadMimeType(idPhoto.name ?? idPhoto.uri, idPhoto.mimeType) !== 'application/pdf' ? (
            <Image source={{ uri: idPhoto.uri }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <Ionicons name="card-outline" size={21} color={colors.primary} />
          )}
          <Text style={[styles.uploadText, { color: colors.foreground }]}>{idPhoto ? 'ID added' : 'Photograph your ID'}</Text>
          {idPhoto && !idPhotoError && !idPhotoSelectionError ? <Feather name="check-circle" size={18} color={colors.success} /> : null}
        </Pressable>
        {idPhotoError || idPhotoSelectionError ? (
          <Text style={[styles.fieldError, { color: colors.destructive }]}>{idPhotoError || idPhotoSelectionError}</Text>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Base Address / Location<RequiredAsterisk/></Text>
        <TextInput
          value={baseAddress}
          onChangeText={setBaseAddress}
          placeholder="Kigali, Rwanda"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Payment Method<RequiredAsterisk/></Text>
        <View style={styles.rowWrap}>
          {(['MOMO', 'BANK_TRANSFER', 'CASH', 'OTHER'] as const).map((m) => {
            const selected = paymentMethod === m;
            return (
              <Pressable
                key={m}
                onPress={() => setPaymentMethod(m)}
                style={[
                  styles.chip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{m.replace(/_/g, ' ')}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Payment / MoMo Number<RequiredAsterisk/></Text>
        <TextInput
          value={paymentNumber}
          onChangeText={setPaymentNumber}
          keyboardType="phone-pad"
          placeholder="+250788123456"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />
      </View>

      {/* SECTION 2: JOB APPLICATION & TRADES */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Section 2: Job Application & Trades</Text>

        <Text style={[styles.label, { color: colors.foreground }]}>Service Experiences & Years of Experience<RequiredAsterisk/></Text>
        {serviceExperiences.map((exp, index) => {
          const isOther = exp.trade === 'Others';
          const otherSelectedTrades = serviceExperiences
            .filter((_, i) => i !== index)
            .map((e) => e.trade);
          const availableOptions = allTradeOptions.filter((opt) => opt === 'Others' || opt === exp.trade || !otherSelectedTrades.includes(opt));

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
                          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background },
                        ]}
                      >
                        <Text style={[styles.tradeChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{option}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <View style={styles.experienceRow}>
                <TextInput
                  value={isOther ? exp.customName : exp.trade}
                  onChangeText={(val) => {
                    if (isOther) {
                      updateServiceExperience(index, 'customName', val);
                    }
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
                  onChangeText={(val) => updateServiceExperience(index, 'yearsOfExperience', Number(val.replace(/\D/g, '')) || 0)}
                  keyboardType="number-pad"
                  placeholder="Yrs"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, styles.yearsField, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
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
                  <Pressable onPress={() => updateServiceExperience(index, 'trade', TRADES[0] ?? 'Plumbing')} style={styles.switchBackBtn}>
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
            <Text style={[styles.addExpText, { color: colors.primary }]}>Add another trade & experience</Text>
          </Pressable>
        )}

        <Text style={[styles.label, { color: colors.foreground }]}>Certificates / TVET Papers (photo or PDF, max {MAX_UPLOAD_SIZE_LABEL} each)<RequiredAsterisk/></Text>
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
          onPress={() => chooseSource(
            (file) => setCertificates((current) => [...current, file]),
            setCertificateSelectionError,
          )}
          style={[styles.upload, styles.uploadDashed, { borderColor: colors.border }]}
        >
          <Ionicons name="document-attach-outline" size={21} color={colors.primary} />
          <Text style={[styles.uploadText, { color: colors.foreground }]}>
            {certificates.length ? 'Add another certificate' : 'Add certificate photo or PDF'}
          </Text>
        </Pressable>
        {certificateSelectionError ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{certificateSelectionError}</Text> : null}
      </View>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      {applicationError ? <Text style={[styles.error, { color: colors.destructive }]}>{applicationError}</Text> : null}

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
          <Text style={[styles.submitText, { color: ready ? colors.primaryForeground : colors.mutedForeground }]}>
            {submitted ? 'Submitted' : applicationError ? 'Retry Submission' : 'Submit Application'}
          </Text>
        )}
      </Pressable>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        All required fields across profile and qualifications must be complete before submission.
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
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontFamily: 'Inter_500Medium', fontSize: 14 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  experienceCard: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', gap: 8 },
  experienceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dropdownScroll: { gap: 6, paddingVertical: 2 },
  tradeChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  tradeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  customFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, marginTop: -2 },
  customBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  switchBackBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  switchBackText: { fontFamily: 'Inter_500Medium', fontSize: 11, textDecorationLine: 'underline' },
  yearsField: { width: 70, textAlign: 'center' },
  removeBtn: { padding: 12, justifyContent: 'center', alignItems: 'center' },
  addExpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginTop: 6 },
  addExpText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  upload: { minHeight: 56, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, marginTop: 4 },
  uploadDashed: { borderStyle: 'dashed' },
  uploadText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  thumbnail: { width: 34, height: 34, borderRadius: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  fieldError: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 4, marginLeft: 4 },
  submit: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});