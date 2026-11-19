import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatBookingFee, formatMoney, getServiceBookingFee, repairTotal, type Job } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useColors } from '@/hooks/useColors';
import { useDisputes } from '@/context/DisputeContext';
import { useProfile } from '@/context/ProfileContext';
import { ReportDisputeModal } from '@/components/dispute/ReportDisputeModal';
import { DisputeDetailsModal } from '@/components/dispute/DisputeDetailsModal';

/** Terminal view for a finished or cancelled job, reachable from My services. */
export function JobClosed({ job, hideBack = false, onRebook }: { job: Job; hideBack?: boolean; onRebook?: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { profile } = useProfile();
  const { getDisputeForJob } = useDisputes();
  const [showDisputeReport, setShowDisputeReport] = useState(false);
  const [showDisputeDetails, setShowDisputeDetails] = useState(false);

  const existingDispute = getDisputeForJob(job.id);
  const cancelled = job.status === 'CANCELLED';
  const declined = job.status === 'DECLINED';
  const terminated = cancelled || declined;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/activity'));

  return (
    <StageScreen
      eyebrow={declined ? 'DECLINED' : cancelled ? 'CANCELLED' : 'COMPLETED'}
      title={declined ? 'Request declined' : cancelled ? 'Request cancelled' : 'Job completed'}
      subtitle={terminated ? 'This request ended and no repair was carried out. You can rebook with another technician.' : undefined}
      hideBack={hideBack}
      onBack={goBack}
      footer={
        terminated ? (
          <>
            {onRebook ? (
              <Button
                label="Book next technician"
                icon="person-add-outline"
                onPress={onRebook}
                testID="closed-rebook-button"
              />
            ) : null}
            <Button label="Go back" variant="outline" onPress={goBack} testID="closed-back-button" />
          </>
        ) : (
          <>
            <Button label="View invoice" onPress={() => router.push(`/invoice/${job.id}`)} testID="closed-invoice-button" />
            <Button
              label={job.rating ? 'Edit your rating' : 'Rate technician'}
              variant="outline"
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: job.id, rate: '1' } })}
              testID="closed-rate-button"
            />
          </>
        )
      }
    >
      {!cancelled && (
        <View style={styles.hero}>
          <View style={[styles.iconCore, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={32} color={colors.primaryForeground} />
          </View>
        </View>
      )}

      <SectionCard>
        <StatusBadge status={job.status} testID="closed-status-badge" />
        <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
        <Text style={[styles.problem, { color: colors.mutedForeground }]}>{job.problem}</Text>
      </SectionCard>

      <SectionCard title="Summary">
        <MoneyRow label="Job ID" value={job.reference} />
        <MoneyRow label="Technician" value={job.technician?.name ?? 'Not matched'} />
        <MoneyRow label="Location" value={job.locationLabel} />
        {!cancelled && (
          <>
            <MoneyRow label="Repair total" value={formatMoney(repairTotal(job))} />
            <MoneyRow label="Booking fee" value={formatBookingFee(job.bookingFee?.amount ?? getServiceBookingFee(job.service))} />
            <MoneyRow label="Settled by" value={job.settlementMethod ?? '—'} />
            <MoneyRow label="Balance" value={formatMoney(balanceDue(job))} strong />
          </>
        )}
      </SectionCard>

      {/* Disagreement / Dispute Section */}
      <SectionCard title="Need Help or Have a Disagreement?">
        <Text style={[styles.problem, { color: colors.mutedForeground, marginTop: 0 }]}>
          {existingDispute
            ? 'You have submitted a disagreement statement for this job. Our support team on the web admin dashboard will review and mediate.'
            : 'If you experienced poor quality, an overcharging dispute, or an issue with the technician, you can submit a statement for web admin review.'}
        </Text>
        <Button
          label={existingDispute ? 'View Dispute Details' : 'Report Disagreement with Technician'}
          variant="outline"
          size="small"
          icon="shield-outline"
          onPress={() => {
            if (existingDispute) {
              setShowDisputeDetails(true);
            } else {
              setShowDisputeReport(true);
            }
          }}
          style={{ marginTop: 12 }}
        />
      </SectionCard>

      {job.rating ? (
        <SectionCard title="Your rating">
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= job.rating!.overall ? 'star' : 'star-outline'}
                size={18}
                color={colors.warning}
              />
            ))}
            <Text style={[styles.ratingValue, { color: colors.foreground }]}>{job.rating.overall}.0</Text>
          </View>
          {job.rating.comment ? <Text style={[styles.comment, { color: colors.mutedForeground }]}>{job.rating.comment}</Text> : null}
        </SectionCard>
      ) : null}

      {showDisputeReport && (
        <ReportDisputeModal
          visible={showDisputeReport}
          onClose={() => setShowDisputeReport(false)}
          jobId={job.id}
          jobReference={job.reference}
          service={job.service}
          role="client"
          submitterName={profile?.name || 'Client'}
          submitterPhone={profile?.phone || ''}
          clientName={profile?.name || 'Client'}
          clientPhone={profile?.phone || ''}
          technicianName={job.technician?.name || 'Assigned Technician'}
          technicianPhone={job.technician?.phone || ''}
          agreedPrice={job.agreedPrice}
          existingDispute={existingDispute}
        />
      )}

      {showDisputeDetails && existingDispute && (
        <DisputeDetailsModal
          visible={showDisputeDetails}
          onClose={() => setShowDisputeDetails(false)}
          dispute={existingDispute}
          currentRole="client"
          onOpenResponseModal={() => {
            setShowDisputeDetails(false);
            setShowDisputeReport(true);
          }}
        />
      )}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 2 },
  iconCore: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  service: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 11 },
  problem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 5 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontFamily: 'Inter_700Bold', fontSize: 14, marginLeft: 5 },
  comment: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 9 },
});
