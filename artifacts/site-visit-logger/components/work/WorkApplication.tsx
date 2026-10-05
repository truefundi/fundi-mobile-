import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { TRADES, type Trade } from '@/constants/work';
import { useWork } from '@/context/WorkContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

async function capture(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.78 });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export function WorkApplication() {
  const colors = useColors();
  const { apply, profile } = useWork();
  const { account } = useAuth();

  // Section 1: Profile & Identity Information (Prepopulated from account)[cite: 3]
  const [fullName, setFullName] = useState(account?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(account?.phone ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [gender, setGender] = useState<'FEMALE' | 'MALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY'>('FEMALE');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [baseAddress, setBaseAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'MOMO' | 'BANK_TRANSFER' | 'CASH' | 'OTHER'>('MOMO');
  const [paymentNumber, setPaymentNumber] = useState(account?.phone ?? '');
  const [profilePictureUri, setProfilePictureUri] = useState<string>();
  const [idPhotoUri, setIdPhotoUri] = useState<string>();

  // Section 2: Job Application & Multiple Service Experiences
  const [serviceExperiences, setServiceExperiences] = useState<Array<{ trade: string; customName: string; yearsOfExperience: number }>>([
    { trade: TRADES[0] ?? 'Plumbing', customName: '', yearsOfExperience: 1 },
  ]);
  const [certificateUris, setCertificateUris] = useState<string[]>([]);
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
      if (account.email) setEmail(account.email);
    }
  }, [account]);

  const isProfileComplete =
    !!fullName.trim() &&
    !!phoneNumber.trim() &&
    !!nationalIdNumber.trim() &&
    !!baseAddress.trim() &&
    !!paymentNumber.trim() &&
    !!profilePictureUri &&
    !!idPhotoUri;

  const isJobAppComplete =
    serviceExperiences.length > 0 &&
    serviceExperiences.every((exp) => {
      const name = exp.trade === 'Others' ? exp.customName.trim() : exp.trade;
      return name.length > 0 && exp.yearsOfExperience >= 0;
    }) &&
    certificateUris.length > 0;

  const ready = isProfileComplete && isJobAppComplete;

  async function pickFromLibrary(): Promise<string | null> {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.78 });
    if (result.canceled || !result.assets[0]?.uri) return null;
    return result.assets[0].uri;
  }

  function chooseSource(onChosen: (uri: string) => void) {
    Alert.alert('Add document', undefined, [
      { text: 'Take a photo', onPress: async () => {
        const uri = await capture();
        if (uri) onChosen(uri);
        else setError('Camera access is needed to take a photo.');
      } },
      { text: 'Upload a file', onPress: async () => {
        const uri = await pickFromLibrary();
        if (uri) onChosen(uri);
        else setError('No file selected.');
      } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const addServiceExperience = () => {
    if (serviceExperiences.length >= 10) return;
    // Find first available trade that hasn't been selected yet
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
      const formattedExperiences = serviceExperiences.map((exp) => ({
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
        baseLatitude: -1.95,
        baseLongitude: 30.06,
        paymentMethod,
        paymentNumber,
        profilePictureUri,
        idPhotoUri,
        certificateUris,
        yearsExperience: Math.max(...formattedExperiences.map((e) => e.yearsOfExperience), 0),
        trade: formattedExperiences[0]?.customName || 'General',
        serviceExperiences: formattedExperiences,
      } as any);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const allTradeOptions = [...TRADES, 'Others'];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={[styles.intro, { backgroundColor: colors.secondary }]}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
        <Text style={[styles.introText, { color: colors.secondaryForeground }]}>
          Complete your profile details and submit your verified trade qualifications to start accepting jobs[cite: 1, 3].
        </Text>
      </View>

      {/* SECTION 1: PROFILE & IDENTITY */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Section 1: Profile & Identity</Text>

        <Text style={[styles.label, { color: colors.foreground }]}>Profile Picture</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => chooseSource((uri) => setProfilePictureUri(uri))}
          style={[styles.upload, { borderColor: profilePictureUri ? colors.success : colors.border }]}
        >
          {profilePictureUri ? (
            <Image source={{ uri: profilePictureUri }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <Ionicons name="person-circle-outline" size={21} color={colors.primary} />
          )}
          <Text style={[styles.uploadText, { color: colors.foreground }]}>{profilePictureUri ? 'Picture added' : 'Upload profile picture'}</Text>
          {profilePictureUri ? <Feather name="check-circle" size={18} color={colors.success} /> : null}
        </Pressable>

        <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Amina Example"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Phone Number</Text>
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
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Gender</Text>
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

        <Text style={[styles.label, { color: colors.foreground }]}>National ID Number</Text>
        <TextInput
          value={nationalIdNumber}
          onChangeText={setNationalIdNumber}
          placeholder="ID123456"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>National ID Document Photo</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => chooseSource((uri) => setIdPhotoUri(uri))}
          style={[styles.upload, { borderColor: idPhotoUri ? colors.success : colors.border }]}
        >
          {idPhotoUri ? (
            <Image source={{ uri: idPhotoUri }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <Ionicons name="card-outline" size={21} color={colors.primary} />
          )}
          <Text style={[styles.uploadText, { color: colors.foreground }]}>{idPhotoUri ? 'ID added' : 'Photograph your ID'}</Text>
          {idPhotoUri ? <Feather name="check-circle" size={18} color={colors.success} /> : null}
        </Pressable>

        <Text style={[styles.label, { color: colors.foreground }]}>Base Address / Location</Text>
        <TextInput
          value={baseAddress}
          onChangeText={setBaseAddress}
          placeholder="Kigali, Rwanda"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Payment Method</Text>
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

        <Text style={[styles.label, { color: colors.foreground }]}>Payment / MoMo Number</Text>
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

        <Text style={[styles.label, { color: colors.foreground }]}>Service Experiences & Years of Experience</Text>
        {serviceExperiences.map((exp, index) => {
          const isOther = exp.trade === 'Others';
          // Filter out trades already selected in *other* rows, but keep the current row's trade option available
          const otherSelectedTrades = serviceExperiences
            .filter((_, i) => i !== index)
            .map((e) => e.trade);
          const availableOptions = allTradeOptions.filter((opt) => opt === 'Others' || opt === exp.trade || !otherSelectedTrades.includes(opt));

          return (
            <View key={index} style={styles.experienceCard}>
              <View style={styles.experienceRow}>
                <View style={{ flex: 2, gap: 4 }}>
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
                  ) : (
                    <View style={styles.customTradeHeader}>
                      <Text style={[styles.customBadgeText, { color: colors.primary }]}>Custom Trade</Text>
                      <Pressable onPress={() => updateServiceExperience(index, 'trade', TRADES[0] ?? 'Plumbing')} style={styles.switchBackBtn}>
                        <Text style={[styles.switchBackText, { color: colors.mutedForeground }]}>Change to preset</Text>
                      </Pressable>
                    </View>
                  )}

                  {isOther && (
                    <TextInput
                      value={exp.customName}
                      onChangeText={(val) => updateServiceExperience(index, 'customName', val)}
                      placeholder="Enter custom trade name"
                      placeholderTextColor={colors.mutedForeground}
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    />
                  )}
                </View>

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
            </View>
          );
        })}

        {serviceExperiences.length < 10 && (
          <Pressable onPress={addServiceExperience} style={[styles.addExpBtn, { borderColor: colors.primary }]}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={[styles.addExpText, { color: colors.primary }]}>Add another trade & experience</Text>
          </Pressable>
        )}

        <Text style={[styles.label, { color: colors.foreground }]}>Certificates / TVET Papers</Text>
        {certificateUris.map((uri, index) => (
          <View key={uri} style={[styles.upload, { borderColor: colors.success }]}>
            <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />
            <Text style={[styles.uploadText, { color: colors.foreground }]}>Certificate {index + 1}</Text>
            <Pressable onPress={() => setCertificateUris((current) => current.filter((item) => item !== uri))}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={() => chooseSource((uri) => setCertificateUris((current) => [...current, uri]))}
          style={[styles.upload, styles.uploadDashed, { borderColor: colors.border }]}
        >
          <Ionicons name="document-attach-outline" size={21} color={colors.primary} />
          <Text style={[styles.uploadText, { color: colors.foreground }]}>
            {certificateUris.length ? 'Add another certificate' : 'Photograph a certificate'}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

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
            {submitted ? 'Submitted' : 'Submit Application'}
          </Text>
        )}
      </Pressable>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        All required fields across profile and qualifications must be complete before submission[cite: 3].
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
  experienceCard: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', gap: 8 },
  experienceRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dropdownScroll: { gap: 6, paddingVertical: 2 },
  tradeChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  tradeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  customTradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, height: 34 },
  customBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
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
  submit: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});