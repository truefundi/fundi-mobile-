import React, { useCallback, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StageScreen } from '@/components/ui/StageScreen';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { useCategories } from '@/lib/categories-api';
import {
  addMyService,
  CERTIFICATE_TYPES,
  certificateIssue,
  certificateTypeLabel,
  fetchMyCertificates,
  fetchMyServices,
  reuseCertificate,
  serviceName,
  updateMyService,
  uploadServiceCertificate,
  type CertificateType,
  type MyCertificate,
  type PickedFile,
  type TechnicianService,
} from '@/lib/technician-services-api';

const OTHER = 'other';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An approved technician applies to offer another service. It is reviewed on
 * its own and gets jobs only once Fundi approves it; the services already
 * approved keep working meanwhile.
 */
export default function AddServiceScreen() {
  const colors = useColors();
  const router = useRouter();
  // With a serviceId: a rejected service sent back for review (with a new certificate).
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const { refreshApplication } = useWork();
  const { categories, isLoading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useCategories();
  const [mine, setMine] = useState<TechnicianService[] | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [years, setYears] = useState(1);
  const [certificate, setCertificate] = useState<PickedFile | null>(null);
  const [certificateType, setCertificateType] = useState<CertificateType>('TVET_CERTIFICATE');
  const [fileError, setFileError] = useState<string | null>(null);
  // Certificates Fundi already accepted: one can cover this service too, without a new upload.
  const [certificates, setCertificates] = useState<MyCertificate[]>([]);
  const [reuseId, setReuseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchMyCertificates()
        .then(setCertificates)
        .catch(() => setCertificates([]));
      fetchMyServices()
        .then((services) => {
          setMine(services);
          const again = serviceId ? services.find((service) => service.id === serviceId) : undefined;
          if (again) setYears(again.yearsOfExperience);
        })
        .catch(() => setMine([]));
    }, [serviceId]),
  );
  const resubmitting = serviceId ? (mine ?? []).find((service) => service.id === serviceId) : undefined;

  // Catalog services the technician does not list yet.
  const options = useMemo(() => {
    const listed = new Set((mine ?? []).map((service) => service.categoryId).filter(Boolean));
    return categories.filter((service) => service.id && UUID.test(service.id) && !listed.has(service.id));
  }, [categories, mine]);

  const chosen = options.find((service) => service.id === choice);
  // Reuse links a certificate to a catalog service; a service named by the technician needs an upload.
  const targetCategoryId = resubmitting ? resubmitting.categoryId ?? null : chosen?.id ?? null;
  const reusable = targetCategoryId
    ? certificates.filter(
        (doc) => doc.status === 'ACCEPTED' && !doc.serviceCategories.some((service) => service.id === targetCategoryId),
      )
    : [];
  const reusing = reuseId && reusable.some((doc) => doc.id === reuseId) ? reuseId : null;
  const ownName = customName.trim();
  const ready = resubmitting
    ? true
    : Boolean((choice && choice !== OTHER) || (choice === OTHER && ownName.length >= 2));
  const missing = resubmitting
    ? null
    : !choice
    ? 'Choose the service you want to offer.'
    : choice === OTHER && ownName.length < 2
      ? 'Name the service.'
      : null;

  const pickCertificate = async () => {
    setFileError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const file = { uri: asset.uri, name: asset.name, size: asset.size, mimeType: asset.mimeType };
    const issue = certificateIssue(file);
    if (issue) {
      setFileError(issue);
      return;
    }
    setCertificate(file);
    setReuseId(null);
  };

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = resubmitting
        ? await updateMyService(resubmitting.id, { yearsOfExperience: years })
        : await addMyService(
            choice === OTHER ? { customName: ownName, yearsOfExperience: years } : { categoryId: choice!, yearsOfExperience: years },
          );
      if (reusing && targetCategoryId) {
        try {
          await reuseCertificate(reusing, targetCategoryId);
        } catch (linkError) {
          setError(
            `${serviceName(created)} was sent for review, but the certificate could not be added: ${
              linkError instanceof Error ? linkError.message : 'try again from your profile.'
            }`,
          );
          await refreshApplication().catch(() => undefined);
          return;
        }
      } else if (certificate) {
        try {
          await uploadServiceCertificate(created, certificate, certificateType);
        } catch (uploadError) {
          // The service is saved; only the file failed. Say so instead of losing the request.
          setError(
            `${serviceName(created)} was sent for review, but the certificate did not upload: ${
              uploadError instanceof Error ? uploadError.message : 'try again from your profile.'
            }`,
          );
          await refreshApplication().catch(() => undefined);
          return;
        }
      }
      await refreshApplication().catch(() => undefined);
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The service could not be sent for review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StageScreen
      eyebrow="YOUR SERVICES"
      title={resubmitting ? `Send ${serviceName(resubmitting)} again` : 'Add a service'}
      subtitle={
        resubmitting
          ? 'Fix what Fundi asked for and send it back. It is reviewed again on its own.'
          : 'Fundi reviews each new service on its own. Your approved services keep getting jobs meanwhile.'
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      footer={
        <View style={{ gap: 8 }}>
          {missing ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]} testID="add-service-missing">
              {missing}
            </Text>
          ) : null}
          <Button
            label={saving ? 'Sending…' : resubmitting ? 'Send again for review' : 'Send for review'}
            featherIcon="send"
            iconPosition="trailing"
            onPress={() => void submit()}
            loading={saving}
            disabled={!ready || saving}
            testID="add-service-submit"
          />
        </View>
      }
    >
      {error ? <Notice tone="warning" icon="alert-circle-outline" text={error} /> : null}
      {resubmitting?.reviewNote ? (
        <Notice tone="warning" icon="alert-circle-outline" text={`Reason from Fundi: ${resubmitting.reviewNote}`} />
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {resubmitting ? serviceName(resubmitting) : 'Which service?'}
        </Text>
        {resubmitting ? null : (
        <>
        {(catalogLoading && !categories.length) || mine === null ? <ActivityIndicator color={colors.primary} /> : null}
        {catalogError && !categories.length ? (
          <Pressable accessibilityRole="button" onPress={() => void refreshCatalog()}>
            <Text style={[styles.hint, { color: colors.destructive }]}>Could not load the services. Tap to try again.</Text>
          </Pressable>
        ) : null}
        <View style={styles.chips}>
          {[...options.map((service) => ({ id: service.id!, label: service.label })), { id: OTHER, label: 'Others' }].map(
            (option) => {
              const selected = choice === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setChoice(option.id)}
                  style={[
                    styles.chip,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
        {choice === OTHER ? (
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Name the service, e.g. Solar panel installation"
            placeholderTextColor={colors.mutedForeground}
            maxLength={80}
            accessibilityLabel="Service name"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          />
        ) : null}
        </>
        )}

        <View style={styles.yearsRow}>
          <Text style={[styles.label, { color: colors.foreground }]}>Years of experience</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fewer years"
              onPress={() => setYears((value) => Math.max(0, value - 1))}
              style={[styles.stepperButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Feather name="minus" size={14} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.stepperValue, { color: colors.foreground }]}>
              {years} {years === 1 ? 'yr' : 'yrs'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More years"
              onPress={() => setYears((value) => Math.min(60, value + 1))}
              style={[styles.stepperButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Feather name="plus" size={14} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          Certificate <Text style={[styles.hint, { color: colors.mutedForeground }]}>(recommended)</Text>
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          A certificate for {resubmitting ? serviceName(resubmitting) : chosen?.label ?? (ownName || 'this service')} helps Fundi approve
          it faster.
        </Text>
        {reusable.length ? (
          <View style={{ gap: 8 }} testID="add-service-reuse">
            <Text style={[styles.label, { color: colors.foreground }]}>Use one Fundi already accepted</Text>
            {reusable.map((doc) => {
              const selected = reusing === doc.id;
              const covers = doc.serviceCategories.map((service) => service.name).join(', ');
              return (
                <Pressable
                  key={doc.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    setReuseId(selected ? null : doc.id);
                    if (!selected) setCertificate(null);
                  }}
                  style={[
                    styles.reuseRow,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '10' : colors.background },
                  ]}
                  testID={`add-service-reuse-${doc.id}`}
                >
                  <Feather name={selected ? 'check-circle' : 'circle'} size={18} color={selected ? colors.primary : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reuseTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text style={[styles.hint, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {certificateTypeLabel(doc.certificateType)}
                      {covers ? ` · accepted for ${covers}` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 4 }]}>Or upload a new one</Text>
          </View>
        ) : null}
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Photo or PDF, up to 5 MB.</Text>
        <View style={styles.chips}>
          {CERTIFICATE_TYPES.map((type) => {
            const selected = certificateType === type.value;
            return (
              <Pressable
                key={type.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setCertificateType(type.value)}
                style={[
                  styles.smallChip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '15' : colors.background },
                ]}
              >
                <Text style={[styles.smallChipText, { color: selected ? colors.primary : colors.foreground }]}>{type.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void pickCertificate()}
          style={[styles.fileButton, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
          testID="add-service-certificate"
        >
          <Feather name={certificate ? 'file-text' : 'upload'} size={16} color={colors.primary} />
          <Text style={[styles.fileText, { color: colors.primary }]} numberOfLines={1}>
            {certificate ? certificate.name ?? 'Certificate chosen' : 'Choose a file'}
          </Text>
          {certificate ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Remove certificate" hitSlop={8} onPress={() => setCertificate(null)}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </Pressable>
        {fileError ? <Text style={[styles.hint, { color: colors.destructive }]}>{fileError}</Text> : null}
      </View>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  smallChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  smallChipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_500Medium', fontSize: 14 },
  yearsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontFamily: 'Inter_700Bold', fontSize: 14, minWidth: 44, textAlign: 'center' },
  fileButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 12 },
  fileText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  reuseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  reuseTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
