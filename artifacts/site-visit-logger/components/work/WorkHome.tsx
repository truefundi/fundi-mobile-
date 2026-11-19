import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SwitchRow } from '@/components/ui/SwitchRow';
import { DocumentReviewList } from '@/components/work/DocumentReviewList';
import { WorkApplication } from '@/components/work/WorkApplication';
import { restoreSession } from '@/lib/auth-api';
import { useAuth } from '@/context/AuthContext';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';
import { isWorkPending, isWorkRejected, isWorkVerified } from '@/constants/work';
import { fetchMyCompany, type MyCompany } from '@/lib/companies-api';

/** The line shown when a rejection was recorded without a reason. */
const GENERIC_REJECTION = 'Application was not approved.';

function WorkPending() {
  const colors = useColors();
  const { signOut } = useAuth();
  const { profile, applicationError, refreshApplication } = useWork();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const user = await restoreSession();
      if (!user) {
        await signOut();
        return;
      }
      await refreshApplication();
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Could not retry loading your application.');
    } finally {
      setRetrying(false);
    }
  };

  const documents = profile?.documents ?? [];
  const deniedCount = documents.filter((document) => document.status === 'DENIED').length;

  return (
    <View style={styles.screen}>
      <View style={[styles.statusCard, { backgroundColor: deniedCount ? colors.destructiveMuted : colors.warningMuted }]}>
        <Feather name={deniedCount ? 'alert-circle' : 'clock'} size={26} color={deniedCount ? colors.destructive : colors.warning} />
        <Text style={[styles.title, { color: colors.foreground }]}>
          {deniedCount
            ? `${deniedCount === 1 ? 'One document needs' : `${deniedCount} documents need`} a new file`
            : 'Application & Trades under review'}
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          {deniedCount
            ? 'Read the reviewer note and replace just that document. Everything else stays as you submitted it.'
            : 'Your application is waiting for an administrator to review your details and trades.'}
        </Text>
      
        {profile?.submittedAt ? (
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Submitted {new Date(profile.submittedAt).toLocaleString()}
          </Text>
        ) : null}
        {profile?.fullName ? (
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {profile.fullName} • {profile.phoneNumber}
          </Text>
        ) : null}
        {profile?.baseAddress ? (
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{profile.baseAddress}</Text>
        ) : null}

        <Text style={[styles.body, styles.documentTitle, { color: colors.foreground, marginTop: 12 }]}>
          Submitted Trades:
        </Text>
        {profile?.serviceExperiences?.map((experience, index) => {
          const statusColor = 
            experience.status === 'APPROVED' ? colors.success :
            experience.status === 'DENIED' || experience.status === 'SUSPENDED' ? colors.destructive :
            colors.warning;

          return (
            <View key={`${experience.trade}-${index}`} style={styles.documentLine}>
              <Text style={[styles.body, { color: colors.foreground }]}>
                • {experience.trade || experience.customName} ({experience.yearsOfExperience} yrs)
              </Text>
              <Text style={[styles.body, { color: statusColor, fontFamily: 'Inter_600SemiBold' }]}>
                Status: {experience.status ?? 'PENDING'}
                {experience.reviewNote ? ` — ${experience.reviewNote}` : ''}
              </Text>
            </View>
          );
        })}

        {applicationError || retryError ? (
          <View style={styles.retryContainer}>
            <Text style={[styles.body, { color: colors.destructive }]}>{retryError ?? applicationError}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading application"
              accessibilityState={{ disabled: retrying, busy: retrying }}
              disabled={retrying}
              onPress={() => void retry()}
            >
              <Text style={[styles.body, styles.retry, { color: colors.primary }]}>{retrying ? 'Retrying…' : 'Retry'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <DocumentReviewList documents={documents} />
    </View>
  );
}

function WorkRejected({ onlyDocuments, company }: { onlyDocuments: boolean; company: MyCompany | null }) {
  const colors = useColors();
  const { profile } = useWork();
  // The admin's own reason is shown whatever else was marked; the generic
  // fallback adds nothing next to the documents that need replacing.
  const feedback = profile?.rejectionFeedback?.trim();
  const showFeedback = Boolean(feedback && !(onlyDocuments && feedback === GENERIC_REJECTION));

  return (
    <View style={[styles.statusCard, { backgroundColor: colors.destructiveMuted }]}>
      <Feather name="alert-circle" size={26} color={colors.destructive} />
      <Text style={[styles.title, { color: colors.foreground }]}>
        {onlyDocuments ? 'Application needs changes' : 'Application not approved'}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {onlyDocuments
          ? 'Replace the documents marked below. Each one goes back to review as soon as you send it.'
          : 'Read the feedback, update your details below and submit a new application. It goes back to review as a fresh application.'}
      </Text>

      {showFeedback ? (
        <View style={[styles.feedbackBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
          <Text style={[styles.feedbackTitle, { color: colors.destructive }]}>Admin Review Feedback:</Text>
          <Text style={[styles.body, { color: colors.foreground, textAlign: 'left', marginTop: 4 }]}>
            {feedback}
          </Text>
        </View>
      ) : null}
      
      {company?.verificationStatus === 'REJECTED' ? (
        <Text style={[styles.body, { color: colors.destructive, marginTop: 4 }]} testID="rejected-company-note">
          Company ({company.name}): {company.rejectionReason?.trim() || 'not approved.'} Check its details in the form below.
        </Text>
      ) : null}

      {profile?.serviceExperiences?.filter((exp) => exp.status === 'DENIED' || exp.status === 'SUSPENDED').map((exp, idx) => (
        <Text key={`exp-err-${idx}`} style={[styles.body, { color: colors.destructive, marginTop: 4 }]}>
          Trade ({exp.trade || exp.customName}): {exp.reviewNote ?? 'Needs revision'}
        </Text>
      ))}

    </View>
  );
}

function WorkApproved() {
  const colors = useColors();
  const { isAvailable, setAvailable, applicationError } = useWork();

  return (
    <View style={styles.screen}>
      {applicationError ? <Text style={[styles.error, { color: colors.destructive }]}>{applicationError}</Text> : null}
      <SwitchRow
        title={isAvailable ? 'Available for work' : 'Not accepting jobs'}
        hint="Availability is saved to your technician profile."
        value={isAvailable}
        onValueChange={(available) => {
          void setAvailable(available).catch(() => undefined);
        }}
        accessibilityLabel="Available for work"
        testID="availability-switch"
      />
      <View style={[styles.statusCard, { backgroundColor: colors.secondary }]}>
        <Feather name="check-circle" size={24} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>Technician verified</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Your approved trades are live. Working mode is unlocked and incoming job requests can now be accepted.
        </Text>
      </View>
    </View>
  );
}

function WorkRejectedHome() {
  const colors = useColors();
  const { profile } = useWork();
  const [editAll, setEditAll] = useState(false);
  const documents = profile?.documents ?? [];
  const deniedDocuments = documents.some((document) => document.status === 'DENIED');
  const deniedTrades = profile?.serviceExperiences?.some(
    (experience) => experience.status === 'DENIED' || experience.status === 'SUSPENDED',
  );
  // A company owner's company is reviewed too; a rejected one is corrected in the form.
  const [company, setCompany] = useState<MyCompany | null>(null);
  useEffect(() => {
    if (profile?.businessType !== 'COMPANY') {
      setCompany(null);
      return;
    }
    let cancelled = false;
    fetchMyCompany()
      .then((found) => {
        if (!cancelled) setCompany(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile?.businessType]);
  const companyRejected = company?.verificationStatus === 'REJECTED';
  // Denied documents alone are fixed one by one; the full form is for anything else.
  const onlyDocuments = deniedDocuments && !deniedTrades && !companyRejected;
  const showForm = !onlyDocuments || editAll;

  return (
    <View style={styles.screen}>
      <WorkRejected onlyDocuments={onlyDocuments} company={company} />
      <DocumentReviewList documents={documents} />
      {onlyDocuments && !editAll ? (
        <Pressable accessibilityRole="button" onPress={() => setEditAll(true)} testID="edit-full-application">
          <Text style={[styles.body, styles.retry, { color: colors.primary }]}>Change other application details</Text>
        </Pressable>
      ) : null}
      {showForm ? <WorkApplication /> : null}
    </View>
  );
}

/** Technician verification is server-owned; mock same-device jobs are not shown in working mode. */
export function WorkHome(_props: { query?: string }) {
  const { status, submissionFailed } = useWork();

  // A rejected application always shows why, with the form to apply again below it.
  if (isWorkRejected(status)) return <WorkRejectedHome />;

  if (submissionFailed) return <WorkApplication />;
  
  if (isWorkPending(status)) return <WorkPending />;
  
  if (isWorkVerified(status)) return <WorkApproved />;
  
  return <WorkApplication />;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  statusCard: { alignItems: 'center', gap: 9, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 22 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  documentLine: { width: '100%', alignItems: 'center', gap: 2, marginTop: 5 },
  documentTitle: { fontFamily: 'Inter_600SemiBold' },
  retryContainer: { alignItems: 'center', marginTop: 12 },
  retry: { fontFamily: 'Inter_700Bold', padding: 8, marginTop: 4 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  feedbackBox: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  feedbackTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
});