import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReasonSheet } from '@/components/chat/ChatSheets';
import { JobListItem } from '@/components/jobs/JobListItem';
import { SectionNote, Segments } from '@/components/jobs/ListControls';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Job } from '@/constants/jobs';
import { useWork } from '@/context/WorkContext';
import { useProfile } from '@/context/ProfileContext';
import { useDisputes, type DisputeRecord } from '@/context/DisputeContext';
import { ReportDisputeModal } from '@/components/dispute/ReportDisputeModal';
import { DisputeDetailsModal } from '@/components/dispute/DisputeDetailsModal';
import { useColors } from '@/hooks/useColors';
import { summarizeTechnicianJob } from '@/lib/job-summary';

type Tab = 'Ongoing' | 'History';

const lastActive = (job: Job) => job.completedAt ?? job.statusSince ?? job.createdAt;
const newestFirst = (a: Job, b: Job) => new Date(lastActive(b)).getTime() - new Date(lastActive(a)).getTime();

/**
 * The technician's jobs in the same layout as a client's services: new
 * requests and active jobs under Ongoing, finished and cancelled ones under
 * History. Every job opens its chat; only a new request can be answered from
 * its card.
 */
export function WorkJobs() {
  const colors = useColors();
  const router = useRouter();
  const { profile: account } = useProfile();
  const { getDisputeForJob } = useDisputes();
  const { offers, mine, done, cancelled, earnings, acceptOffer, rejectOffer } = useWork();
  const [tab, setTab] = useState<Tab>('Ongoing');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [declining, setDeclining] = useState<Job | null>(null);
  const [disputeReportJob, setDisputeReportJob] = useState<Job | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);

  const { ongoing, history } = useMemo(() => {
    const requests = offers.map((job) => ({ job, isRequest: true, summary: summarizeTechnicianJob(job, true) }));
    const active = mine
      .map((job) => ({ job, isRequest: false, summary: summarizeTechnicianJob(job, false) }))
      .sort((a, b) => Number(b.summary.yourTurn) - Number(a.summary.yourTurn) || newestFirst(a.job, b.job));
    return {
      ongoing: [...requests, ...active],
      history: [...done, ...cancelled]
        .sort(newestFirst)
        .map((job) => ({ job, isRequest: false, summary: summarizeTechnicianJob(job, false) })),
    };
  }, [offers, mine, done, cancelled]);

  const openChat = (jobId: string) => router.push({ pathname: '/chat/[id]', params: { id: jobId } });

  const accept = async (job: Job) => {
    setBusyId(job.id);
    setErrors((current) => ({ ...current, [job.id]: '' }));
    try {
      const accepted = await acceptOffer(job.offerId || job.id);
      openChat(accepted.id);
    } catch (e) {
      setErrors((current) => ({ ...current, [job.id]: e instanceof Error ? e.message : 'Could not accept this request.' }));
    } finally {
      setBusyId(null);
    }
  };

  const rows = tab === 'Ongoing' ? ongoing : history;
  const waitingOnYou = ongoing.filter((row) => row.summary.yourTurn).length;

  return (
    <View>
      <View style={[styles.earnings, { backgroundColor: colors.secondary }]}>
        <View>
          <Text style={[styles.earningsLabel, { color: colors.secondaryForeground }]}>Total earnings</Text>
          <Text style={[styles.earningsValue, { color: colors.primary }]}>RWF {earnings.toLocaleString()}</Text>
        </View>
        <Text style={[styles.earningsStats, { color: colors.secondaryForeground }]}>
          {mine.length} active · {done.length} completed
        </Text>
      </View>

      <Segments
        value={tab}
        onChange={setTab}
        options={[
          { value: 'Ongoing', count: ongoing.length },
          { value: 'History', count: history.length },
        ]}
      />

      {rows.length === 0 ? (
        tab === 'Ongoing' ? (
          <EmptyState
            icon="inbox"
            title="No jobs right now"
            text="Requests sent to you appear here. Stay available to receive them."
          />
        ) : (
          <EmptyState icon="clock" title="No history yet" text="Completed and cancelled jobs are kept here." />
        )
      ) : (
        <View style={styles.list}>
          {tab === 'Ongoing' && waitingOnYou > 0 ? (
            <SectionNote text={waitingOnYou === 1 ? '1 job needs you' : `${waitingOnYou} jobs need you`} />
          ) : null}
          {rows.map(({ job, isRequest, summary }) => {
            const busy = busyId === job.id;
            const dispute = getDisputeForJob(job.id);
            return (
              <View key={`${isRequest ? 'request' : 'job'}-${job.id}`} style={styles.item}>
                <JobListItem
                  service={job.service}
                  summary={summary}
                  person={job.clientName ? { name: job.clientName } : null}
                  location={job.locationLabel}
                  at={lastActive(job)}
                  onPress={() => openChat(job.id)}
                  testID={`work-job-${job.id}`}
                  disputeBadge={
                    dispute ? (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedDispute(dispute);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor: colors.primary + '18',
                          borderColor: colors.primary,
                          borderWidth: 1,
                        }}
                      >
                        <Feather name="shield" size={9} color={colors.primary} />
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: colors.primary }}>
                          Dispute: {dispute.status.replace('_', ' ')}
                        </Text>
                      </Pressable>
                    ) : null
                  }
                  footer={
                    isRequest ? (
                      <>
                        <Button
                          label="Decline"
                          variant="outline"
                          size="small"
                          onPress={() => setDeclining(job)}
                          disabled={busy}
                          style={styles.flex}
                        />
                        <Button
                          label="Accept request"
                          size="small"
                          onPress={() => void accept(job)}
                          loading={busy}
                          disabled={busy}
                          style={styles.flex}
                          testID={`accept-request-${job.id}`}
                        />
                      </>
                    ) : (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%', paddingTop: 2 }}>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            if (dispute) setSelectedDispute(dispute);
                            else setDisputeReportJob(job);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 6,
                          }}
                        >
                          <Feather name="shield" size={11} color={colors.primary} />
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.primary }}>
                            {dispute ? 'View Dispute' : 'Report Disagreement'}
                          </Text>
                        </Pressable>
                      </View>
                    )
                  }
                />
                {errors[job.id] ? <Text style={[styles.error, { color: colors.destructive }]}>{errors[job.id]}</Text> : null}
              </View>
            );
          })}
        </View>
      )}

      <ReasonSheet
        visible={Boolean(declining)}
        title="Decline this request"
        description="The client will be able to choose another technician. A short reason helps them."
        confirmLabel="Decline request"
        required={false}
        busy={false}
        onClose={() => setDeclining(null)}
        onSubmit={async (reason) => {
          if (!declining) return;
          await rejectOffer(declining.offerId || declining.id, reason || 'Technician unavailable');
        }}
      />

      {disputeReportJob && (
        <ReportDisputeModal
          visible={!!disputeReportJob}
          onClose={() => setDisputeReportJob(null)}
          jobId={disputeReportJob.id}
          jobReference={disputeReportJob.reference}
          service={disputeReportJob.service}
          role="technician"
          submitterName={account?.name || 'Technician'}
          submitterPhone={account?.phone || ''}
          clientName={disputeReportJob.clientName || 'Client'}
          clientPhone={disputeReportJob.clientPhone || ''}
          technicianName={account?.name || 'Technician'}
          technicianPhone={account?.phone || ''}
          agreedPrice={disputeReportJob.agreedPrice}
          existingDispute={getDisputeForJob(disputeReportJob.id)}
        />
      )}

      {selectedDispute && (
        <DisputeDetailsModal
          visible={!!selectedDispute}
          onClose={() => setSelectedDispute(null)}
          dispute={selectedDispute}
          currentRole="technician"
          onOpenResponseModal={() => {
            const allJobs = [...mine, ...done, ...cancelled];
            const target = allJobs.find((j) => j.id === selectedDispute.jobId);
            if (target) setDisputeReportJob(target);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  earnings: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  earningsLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  earningsValue: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5, marginTop: 2 },
  earningsStats: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  list: { gap: 10 },
  item: { gap: 4 },
  flex: { flex: 1 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, paddingHorizontal: 4 },
});
