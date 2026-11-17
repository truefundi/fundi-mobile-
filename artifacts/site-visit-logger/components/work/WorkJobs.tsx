import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReasonSheet } from '@/components/chat/ChatSheets';
import { JobListItem } from '@/components/jobs/JobListItem';
import { SectionNote, Segments } from '@/components/jobs/ListControls';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Job } from '@/constants/jobs';
import { useWork } from '@/context/WorkContext';
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
  const { offers, mine, done, cancelled, earnings, acceptOffer, rejectOffer } = useWork();
  const [tab, setTab] = useState<Tab>('Ongoing');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [declining, setDeclining] = useState<Job | null>(null);

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
                    ) : undefined
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
