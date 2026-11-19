import React, { useCallback, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StageScreen } from '@/components/ui/StageScreen';
import { COMPANY_STATUS, CompanyFields } from '@/components/work/CompanyFields';
import { useColors } from '@/hooks/useColors';
import {
  companyIssues,
  draftFromCompany,
  fetchMyCompany,
  updateMyCompany,
  type CompanyDraft,
  type MyCompany,
} from '@/lib/companies-api';


/** The technician's registered company: review status and details, editable until approved. */
export default function CompanyScreen() {
  const colors = useColors();
  const router = useRouter();
  const [company, setCompany] = useState<MyCompany | null>(null);
  const [draft, setDraft] = useState<CompanyDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyDraft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchMyCompany()
        .then((found) => {
          if (cancelled) return;
          setCompany(found);
          setDraft(found ? draftFromCompany(found) : null);
          setLoadError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load your company.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const editable = company?.verificationStatus === 'PENDING' || company?.verificationStatus === 'REJECTED';
  const changed = Boolean(company && draft && JSON.stringify(draftFromCompany(company)) !== JSON.stringify(draft));

  const save = async () => {
    if (!draft) return;
    const issues = companyIssues(draft);
    setErrors(issues);
    if (Object.keys(issues).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateMyCompany(draft);
      setCompany(updated);
      setDraft(draftFromCompany(updated));
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Your changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const status = company ? COMPANY_STATUS[company.verificationStatus] : null;
  const toneColor = status ? colors[status.tone] : colors.mutedForeground;
  const toneMuted = status ? colors[`${status.tone}Muted` as 'successMuted' | 'warningMuted' | 'destructiveMuted'] : colors.muted;

  return (
    <StageScreen
      eyebrow="BUSINESS"
      title={company?.name ?? 'Your company'}
      subtitle="The company you registered when you applied to work on Fundi."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      footer={
        editable && draft ? (
          <Button
            label={saving ? 'Saving…' : 'Save and send for review'}
            icon="checkmark"
            onPress={() => void save()}
            loading={saving}
            disabled={!changed || saving}
            testID="company-save-button"
          />
        ) : undefined
      }
    >
      {loading && !company ? <ActivityIndicator color={colors.primary} /> : null}
      {loadError ? <Notice tone="warning" icon="alert-circle-outline" text={loadError} /> : null}
      {!loading && !company && !loadError ? (
        <Notice tone="info" icon="information-circle-outline" text="You applied as an individual, so there is no company on file." />
      ) : null}

      {status ? (
        <View style={[styles.statusCard, { backgroundColor: toneMuted, borderColor: toneColor }]} testID="company-status">
          <Feather name={status.icon} size={18} color={toneColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: colors.foreground }]}>{status.label}</Text>
            <Text style={[styles.statusHint, { color: colors.mutedForeground }]}>{status.hint}</Text>
            {company?.verificationStatus === 'REJECTED' && company.rejectionReason ? (
              <View style={[styles.reasonBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
                <Text style={[styles.reasonTitle, { color: colors.destructive }]}>Reason from Fundi</Text>
                <Text style={[styles.reasonText, { color: colors.foreground }]} testID="company-rejection-reason">
                  {company.rejectionReason}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {saved && !changed ? (
        <Notice tone="success" icon="checkmark-circle-outline" text="Saved. Your company is back in review." />
      ) : null}
      {saveError ? <Notice tone="warning" icon="alert-circle-outline" text={saveError} /> : null}

      {draft ? (
        <CompanyFields
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setSaved(false);
            if (Object.keys(errors).length) setErrors(companyIssues(next));
          }}
          errors={errors}
          editable={editable}
        />
      ) : null}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 12 },
  statusLabel: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  statusHint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 2 },
  reasonBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8, gap: 2 },
  reasonTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  reasonText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
});
