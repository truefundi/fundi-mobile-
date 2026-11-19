import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StageScreen } from '@/components/ui/StageScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';
import { useProfile } from '@/context/ProfileContext';
import { useDisputes, type DisputeRecord } from '@/context/DisputeContext';
import { ReportDisputeModal } from '@/components/dispute/ReportDisputeModal';
import { DisputeDetailsModal } from '@/components/dispute/DisputeDetailsModal';
import { type Job } from '@/constants/jobs';

export default function DisputesScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const { disputes, getDisputeForJob } = useDisputes();
  const { jobs } = useFundi();
  const { mine: technicianJobs, actingAsTechnician } = useWork();
  const { profile } = useProfile();

  const isTechnician = actingAsTechnician;
  const currentRole = isTechnician ? 'technician' : 'client';

  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);
  const [reportJob, setReportJob] = useState<{
    id: string;
    reference: string;
    service: string;
    otherName: string;
    otherPhone: string;
    agreedPrice?: number;
  } | null>(null);

  // Pool of available jobs the user can report on
  const availableJobs = isTechnician
    ? technicianJobs.map((j) => ({
        id: j.id,
        reference: j.reference,
        service: j.service,
        otherName: j.clientName || 'Client',
        otherPhone: j.clientPhone || '',
        agreedPrice: j.agreedPrice,
      }))
    : jobs.map((j) => ({
        id: j.id,
        reference: j.reference,
        service: j.service,
        otherName: j.technician?.name || 'Technician',
        otherPhone: j.technician?.phone || '',
        agreedPrice: j.agreedPrice,
      }));

  const handleStartReport = () => {
    if (availableJobs.length > 0) {
      setReportJob(availableJobs[0]);
    } else {
      // Create a fallback negotiation context so the user can report even before a job is booked
      setReportJob({
        id: `dispute_job_${Date.now()}`,
        reference: `NEG-${Math.floor(1000 + Math.random() * 9000)}`,
        service: 'Negotiation / Service Inquiry',
        otherName: isTechnician ? 'Client' : 'Technician',
        otherPhone: '',
      });
    }
  };

  return (
    <StageScreen
      eyebrow="Admin Dispute Settlement"
      title="Disputes & Disagreements"
      subtitle={
        isTechnician
          ? 'Report disagreements faced with clients during price negotiation, payment disputes, or safety concerns. The web admin will review your case.'
          : 'Report issues faced while negotiating with a technician, bad service received, or pricing disagreements. The web admin will review your case.'
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    >
      {/* Information Banner */}
      <View
        style={[
          styles.infoBanner,
          {
            backgroundColor: isDark ? '#0a0a0a' : colors.secondary,
            borderColor: isDark ? colors.primary : colors.border,
          },
        ]}
      >
        <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
        <View style={styles.infoBannerText}>
          <Text style={[styles.infoBannerTitle, { color: colors.foreground }]}>
            Sent Directly to Web Admin
          </Text>
          <Text style={[styles.infoBannerSub, { color: colors.mutedForeground }]}>
            Disputes submitted from the mobile app are sent straight to the Fundi Web Admin console for mediation and settlement.
          </Text>
        </View>
      </View>

      {/* Primary Action Button */}
      <Button
        label={isTechnician ? 'Report Issue with Client' : 'Report Issue with Technician'}
        onPress={handleStartReport}
        featherIcon="alert-triangle"
        style={styles.actionBtn}
      />

      {/* Section Title */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Your Submitted Disputes ({disputes.length})
      </Text>

      {/* Disputes List */}
      {disputes.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="shield" size={36} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Active Disputes</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            If you encounter disagreement while negotiating price or receive bad service, tap the button above to alert the web admin.
          </Text>
        </View>
      ) : (
        disputes.map((dispute) => {
          const clientStatement = dispute.statements.find((s) => s.submittedBy === 'client');
          const technicianStatement = dispute.statements.find((s) => s.submittedBy === 'technician');

          return (
            <Pressable
              key={dispute.id}
              onPress={() => setSelectedDispute(dispute)}
              style={[
                styles.disputeCard,
                {
                  backgroundColor: isDark ? '#000000' : colors.card,
                  borderColor: isDark ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          dispute.status === 'RESOLVED'
                            ? colors.success + '20'
                            : colors.primary + '20',
                        borderColor:
                          dispute.status === 'RESOLVED' ? colors.success : colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            dispute.status === 'RESOLVED' ? colors.success : colors.primary,
                        },
                      ]}
                    >
                      {dispute.status === 'RESOLVED'
                        ? 'RESOLVED BY ADMIN'
                        : 'SUBMITTED TO WEB ADMIN'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  {new Date(dispute.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <Text style={[styles.jobRef, { color: colors.foreground }]}>
                {dispute.service} • Ref: {dispute.jobReference || dispute.jobId}
              </Text>

              <Text style={[styles.parties, { color: colors.mutedForeground }]}>
                Client: {dispute.clientName} • Technician: {dispute.technicianName}
              </Text>

              {clientStatement ? (
                <View style={[styles.statementBox, { backgroundColor: isDark ? '#0a0a0a' : colors.secondary }]}>
                  <Text style={[styles.statementLabel, { color: colors.primary }]}>
                    Client Claim ({clientStatement.reason}):
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.statementDesc, { color: colors.foreground }]}
                  >
                    {clientStatement.description}
                  </Text>
                </View>
              ) : null}

              {technicianStatement ? (
                <View style={[styles.statementBox, { backgroundColor: isDark ? '#0a0a0a' : colors.secondary, marginTop: 6 }]}>
                  <Text style={[styles.statementLabel, { color: colors.primary }]}>
                    Technician Claim ({technicianStatement.reason}):
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.statementDesc, { color: colors.foreground }]}
                  >
                    {technicianStatement.description}
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <Text style={[styles.viewDetailsText, { color: colors.primary }]}>
                  Tap to view full case details & admin review →
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      {/* Select Job Picker Modal if multiple jobs exist */}
      {reportJob && (
        <ReportDisputeModal
          visible={!!reportJob}
          onClose={() => setReportJob(null)}
          jobId={reportJob.id}
          jobReference={reportJob.reference}
          service={reportJob.service}
          role={currentRole}
          submitterName={profile?.name || (isTechnician ? 'Technician' : 'Client')}
          submitterPhone={profile?.phone || ''}
          clientName={isTechnician ? reportJob.otherName : (profile?.name || 'Client')}
          clientPhone={isTechnician ? reportJob.otherPhone : (profile?.phone || '')}
          technicianName={isTechnician ? (profile?.name || 'Technician') : reportJob.otherName}
          technicianPhone={isTechnician ? (profile?.phone || '') : reportJob.otherPhone}
          agreedPrice={reportJob.agreedPrice}
          existingDispute={getDisputeForJob(reportJob.id)}
        />
      )}

      {/* Details Modal */}
      {selectedDispute && (
        <DisputeDetailsModal
          visible={!!selectedDispute}
          onClose={() => setSelectedDispute(null)}
          dispute={selectedDispute}
          currentRole={currentRole}
          onOpenResponseModal={() => {
            const foundJob = availableJobs.find((j) => j.id === selectedDispute.jobId);
            if (foundJob) setReportJob(foundJob);
            else {
              setReportJob({
                id: selectedDispute.jobId,
                reference: selectedDispute.jobReference || selectedDispute.jobId,
                service: selectedDispute.service,
                otherName: isTechnician ? selectedDispute.clientName : selectedDispute.technicianName,
                otherPhone: isTechnician ? selectedDispute.clientPhone : selectedDispute.technicianPhone,
                agreedPrice: selectedDispute.agreedPrice,
              });
            }
          }}
        />
      )}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  infoBannerText: { flex: 1 },
  infoBannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  infoBannerSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2, lineHeight: 17 },
  actionBtn: { marginBottom: 20 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 12 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  disputeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  dateText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  jobRef: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 2 },
  parties: { fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 10 },
  statementBox: {
    borderRadius: 10,
    padding: 10,
  },
  statementLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, marginBottom: 3 },
  statementDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  cardFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#33333330',
  },
  viewDetailsText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
