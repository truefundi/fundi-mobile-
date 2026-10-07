import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { WorkApplication } from '@/components/work/WorkApplication';
import { restoreSession } from '@/lib/auth-api';
import { useAuth } from '@/context/AuthContext';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

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

  return (
    <View style={[styles.statusCard, { backgroundColor: colors.warningMuted }]}>
      <Feather name="clock" size={26} color={colors.warning} />
      <Text style={[styles.title, { color: colors.foreground }]}>Documents under review</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {profile
          ? `Your ${profile.trade.toLowerCase()} application is waiting for an administrator to review it.`
          : 'Your application is waiting for an administrator to review it.'}
      </Text>
      {profile?.submittedAt ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Submitted {new Date(profile.submittedAt).toLocaleString()}
        </Text>
      ) : null}
      {profile?.fullName ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          {profile.fullName} · {profile.phoneNumber}
        </Text>
      ) : null}
      {profile?.baseAddress ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{profile.baseAddress}</Text>
      ) : null}
      {profile?.serviceExperiences?.map((experience, index) => (
        <Text key={`${experience.trade}-${index}`} style={[styles.body, { color: colors.mutedForeground }]}>
          {experience.trade} · {experience.yearsOfExperience} years
        </Text>
      ))}
      {profile?.documents?.map((document) => (
        <View key={document.id} style={styles.documentLine}>
          <Text style={[styles.body, styles.documentTitle, { color: colors.foreground }]}>{document.title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {document.status.replace(/_/g, ' ')}{document.reviewNote ? ` — ${document.reviewNote}` : ''}
          </Text>
        </View>
      ))}
      {applicationError || retryError ? (
        <>
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
        </>
      ) : null}
    </View>
  );
}

function WorkRejected() {
  const colors = useColors();
  const { profile } = useWork();
  return (
    <View style={[styles.statusCard, { backgroundColor: colors.destructiveMuted }]}>
      <Feather name="alert-circle" size={26} color={colors.destructive} />
      <Text style={[styles.title, { color: colors.foreground }]}>Application needs changes</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Review the feedback, update your details or documents, then retry your submission.
      </Text>
      {profile?.documents?.filter((document) => document.status === 'DENIED').map((document) => (
        <Text key={document.id} style={[styles.body, { color: colors.destructive }]}>
          {document.title}{document.reviewNote ? ` — ${document.reviewNote}` : ''}
        </Text>
      ))}
    </View>
  );
}

function WorkApproved() {
  const colors = useColors();
  const { isAvailable, setAvailable, profile, applicationError } = useWork();

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
          {profile?.trade ?? 'Your profile'} is approved. Job offers and job lifecycle actions will appear here when those backend APIs are available.
        </Text>
      </View>
    </View>
  );
}

/** Technician verification is server-owned; mock same-device jobs are not shown in working mode. */
export function WorkHome(_props: { query?: string }) {
  const { account } = useAuth();
  const { status, submissionFailed } = useWork();

  if (account?.role !== 'TECHNICIAN') {
    return (
      <EmptyState
        icon="tool"
        tone="waiting"
        title="Technician account required"
        text="Sign out and register a new account as a technician to submit a work application."
      />
    );
  }
  if (submissionFailed) return <WorkApplication />;
  if (status === 'pending') return <WorkPending />;
  if (status === 'rejected') {
    return (
      <View style={styles.screen}>
        <WorkRejected />
        <WorkApplication />
      </View>
    );
  }
  if (status === 'verified') return <WorkApproved />;
  return <WorkApplication />;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  statusCard: { alignItems: 'center', gap: 9, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 22 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  documentLine: { width: '100%', alignItems: 'center', gap: 1, marginTop: 5 },
  documentTitle: { fontFamily: 'Inter_600SemiBold' },
  retry: { fontFamily: 'Inter_700Bold', padding: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
