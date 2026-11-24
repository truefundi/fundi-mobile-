import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeading } from '@/components/ui/PageHeading';
import { JobListItem } from '@/components/jobs/JobListItem';
import { SectionNote, Segments } from '@/components/jobs/ListControls';
import { WorkJobs } from '@/components/work/WorkJobs';
import { WorkLocked } from '@/components/work/WorkLocked';
import { isTerminated, type Job } from '@/constants/jobs';
import { isWorkVerified } from '@/constants/work';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';
import { useProfile } from '@/context/ProfileContext';
import { useDisputes, type DisputeRecord } from '@/context/DisputeContext';
import { ReportDisputeModal } from '@/components/dispute/ReportDisputeModal';
import { DisputeDetailsModal } from '@/components/dispute/DisputeDetailsModal';
import { useColors } from '@/hooks/useColors';
import { useTabScreenPadding } from '@/hooks/useTabScreenPadding';
import { lastActive, newestJobFirst, summarizeClientJob } from '@/lib/job-summary';
import { openClientJob } from '@/lib/checkout-nav';

type Tab = 'Ongoing' | 'History';

const newestFirst = newestJobFirst;

/**
 * The user's jobs. Clients see their requests; technicians in work mode see
 * the jobs sent to them. Every job opens in one place (its chat), so the list
 * only says where each job stands and whose turn it is.
 */
export default function ActivityScreen() {
  const colors = useColors();
  const bottomPadding = useTabScreenPadding();
  const { mode, status } = useWork();
  const inWork = mode === 'working';
  const working = inWork && isWorkVerified(status);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeading eyebrow={inWork ? 'Your work' : 'Your requests'} title={inWork ? 'My jobs' : 'My services'} />
        <View style={styles.content}>{working ? <WorkJobs /> : inWork ? <WorkLocked /> : <ClientJobs />}</View>
      </ScrollView>
    </View>
  );
}

function ClientJobs() {
  const router = useRouter();
  const colors = useColors();
  const { jobs, isHydrated, refreshJobs } = useFundi();
  // Requests move on elsewhere (a technician accepts, a payment is confirmed,
  // a job is cancelled from its chat): show where each one is now.
  useFocusEffect(
    useCallback(() => {
      void refreshJobs();
    }, [refreshJobs]),
  );
  const { profile: account } = useProfile();
  const { getDisputeForJob } = useDisputes();
  const [tab, setTab] = useState<Tab>('Ongoing');
  const [disputeReportJob, setDisputeReportJob] = useState<Job | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);

  const { ongoing, history } = useMemo(() => {
    const rows = jobs.map((job) => ({ job, summary: summarizeClientJob(job) }));
    return {
      // Jobs waiting on the client first, then the most recently active.
      ongoing: rows
        .filter((row) => row.summary.ongoing)
        .sort((a, b) => Number(b.summary.yourTurn) - Number(a.summary.yourTurn) || newestFirst(a.job, b.job)),
      history: rows.filter((row) => !row.summary.ongoing).sort((a, b) => newestFirst(a.job, b.job)),
    };
  }, [jobs]);

  const open = (job: Job) => openClientJob(router, job);

  const rows = tab === 'Ongoing' ? ongoing : history;
  const waitingOnYou = ongoing.filter((row) => row.summary.yourTurn).length;

  return (
    <>
      <Segments
        value={tab}
        onChange={setTab}
        options={[
          { value: 'Ongoing', count: ongoing.length },
          { value: 'History', count: history.length },
        ]}
      />

      {!isHydrated ? (
        <LoadingState label="Loading your services…" />
      ) : rows.length === 0 ? (
        tab === 'Ongoing' ? (
          <EmptyState
            icon="clipboard"
            title="No ongoing services"
            text="Requests you send appear here until the job is done."
            action={{ label: 'Browse services', onPress: () => router.navigate('/services'), testID: 'activity-browse-button' }}
          />
        ) : (
          <EmptyState icon="clock" title="No history yet" text="Completed and cancelled services are kept here." />
        )
      ) : (
        <View style={styles.list}>
          {tab === 'Ongoing' && waitingOnYou > 0 ? (
            <SectionNote text={waitingOnYou === 1 ? '1 service needs you' : `${waitingOnYou} services need you`} />
          ) : null}
          {rows.map(({ job, summary }) => {
            const dispute = getDisputeForJob(job.id);
            return (
              <JobListItem
                key={job.id}
                service={job.service}
                summary={tab === 'History' && isTerminated(job.status) ? { ...summary, hint: `${summary.hint} Tap to book again.` } : summary}
                person={job.technician ? { name: job.technician.name, avatarUrl: job.technician.avatarUrl } : null}
                location={job.locationLabel}
                at={lastActive(job)}
                onPress={() => open(job)}
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
                }
                testID={`activity-job-${job.reference}`}
              />
            );
          })}
        </View>
      )}

      {disputeReportJob && (
        <ReportDisputeModal
          visible={!!disputeReportJob}
          onClose={() => setDisputeReportJob(null)}
          jobId={disputeReportJob.id}
          jobReference={disputeReportJob.reference}
          service={disputeReportJob.service}
          role="client"
          submitterName={account?.name || 'Client'}
          submitterPhone={account?.phone || ''}
          clientName={account?.name || 'Client'}
          clientPhone={account?.phone || ''}
          technicianName={disputeReportJob.technician?.name || 'Assigned Technician'}
          technicianPhone={disputeReportJob.technician?.phone || ''}
          agreedPrice={disputeReportJob.agreedPrice}
          existingDispute={getDisputeForJob(disputeReportJob.id)}
        />
      )}

      {selectedDispute && (
        <DisputeDetailsModal
          visible={!!selectedDispute}
          onClose={() => setSelectedDispute(null)}
          dispute={selectedDispute}
          currentRole="client"
          onOpenResponseModal={() => {
            const job = jobs.find((j) => j.id === selectedDispute.jobId);
            if (job) setDisputeReportJob(job);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { marginTop: 18 },
  list: { gap: 10 },
});
