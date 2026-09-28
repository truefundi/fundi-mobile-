import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TRADES, type Trade } from '@/constants/work';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

/** Certificates are usually paper, so they get photographed like a job photo. */
async function capture(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.78 });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

/**
 * What someone fills in before they can be hired.
 *
 * Fundi promises customers a *qualified* technician, so the trade claimed here
 * has to be backed by a certificate for it. Nothing on this screen turns the
 * account into a technician — it only submits the claim for review.
 */
export function WorkApplication() {
  const colors = useColors();
  const { apply } = useWork();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [years, setYears] = useState('');
  const [idPhotoUri, setIdPhotoUri] = useState<string>();
  const [certificateUris, setCertificateUris] = useState<string[]>([]);
  const [error, setError] = useState('');

  const ready = !!trade && !!idPhotoUri && certificateUris.length > 0;

  const addId = async () => {
    setError('');
    const uri = await capture();
    if (uri) setIdPhotoUri(uri);
    else setError('Camera access is needed to photograph your ID.');
  };

  const addCertificate = async () => {
    setError('');
    const uri = await capture();
    if (uri) setCertificateUris((current) => [...current, uri]);
    else setError('Camera access is needed to photograph a certificate.');
  };

  const submit = () => {
    if (!ready || !trade || !idPhotoUri) return;
    apply({
      trade,
      yearsExperience: Number(years) || 0,
      idPhotoUri,
      certificateUris,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.intro, { backgroundColor: colors.secondary }]}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
        <Text style={[styles.introText, { color: colors.secondaryForeground }]}>
          Customers are promised a qualified technician. Show us your trade papers once, and you can start taking jobs.
        </Text>
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>Your trade</Text>
      <View style={styles.tradeRow}>
        {TRADES.map((option) => {
          const selected = option === trade;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`trade-${option}`}
              onPress={() => {
                setTrade(option);
                setError('');
              }}
              style={[
                styles.trade,
                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card },
              ]}
            >
              <Text style={[styles.tradeText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.foreground }]}>Years of experience</Text>
      <TextInput
        accessibilityLabel="Years of experience"
        testID="years-input"
        value={years}
        onChangeText={(value) => setYears(value.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.yearsInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
      />

      <Text style={[styles.label, { color: colors.foreground }]}>National ID</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Photograph your national ID"
        testID="add-id-button"
        onPress={addId}
        style={[styles.upload, { borderColor: idPhotoUri ? colors.success : colors.border, backgroundColor: colors.card }]}
      >
        {idPhotoUri ? (
          <Image source={{ uri: idPhotoUri }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <Ionicons name="card-outline" size={21} color={colors.primary} />
        )}
        <Text style={[styles.uploadText, { color: colors.foreground }]}>{idPhotoUri ? 'ID added' : 'Photograph your ID'}</Text>
        {idPhotoUri ? <Feather name="check-circle" size={18} color={colors.success} /> : null}
      </Pressable>

      <Text style={[styles.label, { color: colors.foreground }]}>Certificates</Text>
      {certificateUris.map((uri, index) => (
        <View key={uri} style={[styles.upload, { borderColor: colors.success, backgroundColor: colors.card }]}>
          <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />
          <Text style={[styles.uploadText, { color: colors.foreground }]}>Certificate {index + 1}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove certificate ${index + 1}`}
            testID={`remove-certificate-${index}`}
            onPress={() => setCertificateUris((current) => current.filter((item) => item !== uri))}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Photograph a certificate"
        testID="add-certificate-button"
        onPress={addCertificate}
        style={[styles.upload, styles.uploadDashed, { borderColor: colors.border }]}
      >
        <Ionicons name="document-attach-outline" size={21} color={colors.primary} />
        <Text style={[styles.uploadText, { color: colors.foreground }]}>
          {certificateUris.length ? 'Add another certificate' : 'Photograph a certificate'}
        </Text>
      </Pressable>

      {error ? <Text testID="application-error" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Submit for review"
        accessibilityState={{ disabled: !ready }}
        testID="submit-application-button"
        onPress={submit}
        disabled={!ready}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: ready ? colors.primary : colors.muted, opacity: pressed ? 0.82 : 1 },
        ]}
      >
        <Text style={[styles.submitText, { color: ready ? colors.primaryForeground : colors.mutedForeground }]}>
          Submit for review
        </Text>
      </Pressable>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        A trade and at least one certificate are required. Your documents are only used to verify you.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 9 },
  intro: { flexDirection: 'row', gap: 11, alignItems: 'center', borderRadius: 16, padding: 15 },
  introText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 13 },
  tradeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trade: { minHeight: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  tradeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  yearsInput: { minHeight: 54, borderRadius: 14, borderWidth: 1, paddingHorizontal: 15, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  upload: { minHeight: 62, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  uploadDashed: { borderStyle: 'dashed' },
  uploadText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  thumbnail: { width: 38, height: 38, borderRadius: 9 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, marginTop: 4 },
  submit: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10 },
});
