import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COMMISSION_RATE, formatMoney, STATUS_LABEL, type Job } from '@/constants/jobs';
import { buildQuote } from '@/constants/simulation';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { WorkApplication } from '@/components/work/WorkApplication';
import { useFundi } from '@/context/FundiContext';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

/** What the technician keeps of a visit fee once Fundi has taken its cut. */
function share(visitFee: number): number {
  return visitFee * (1 - COMMISSION_RATE);
}

/** The one thing this job is waiting on the technician to do, if anything. */
function nextAction(status: Job['status']): 'arrived' | 'diagnose' | 'complete' | null {
  if (status === 'EN_ROUTE') return 'arrived';
  if (status === 'ARRIVED' || status === 'DIAGNOSING') return 'diagnose';
  if (status === 'REPAIR_IN_PROGRESS') return 'complete';
  return null;
}

function OfferCard({ job, onAccept, onDecline }: { job: Job; onAccept: () => void; onDecline: () => void }) {
  const colors = useColors();
  const urgent = job.urgency === 'Emergency';
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: urgent ? colors.destructive : colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.tag, { backgroundColor: urgent ? colors.destructive : colors.secondary }]}>
          <Text style={[styles.tagText, { color: urgent ? colors.destructiveForeground : colors.secondaryForeground }]}>{job.urgency}</Text>
        </View>
        <Text style={[styles.fee, { color: colors.foreground }]}>{formatMoney(share(job.visitFee))}</Text>
      </View>
      <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
      <Text style={[styles.problem, { color: colors.mutedForeground }]} numberOfLines={2}>{job.problem}</Text>
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={13} color={colors.mutedForeground} />
        <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>{job.locationLabel}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decline the ${job.service} job`}
          testID={`decline-${job.id}`}
          onPress={onDecline}
          style={({ pressed }) => [styles.action, styles.outline, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Decline</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Accept the ${job.service} job`}
          testID={`accept-${job.id}`}
          onPress={onAccept}
          style={({ pressed }) => [styles.action, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
        >
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A job this technician owns, with the one button it is waiting on. */
function MyJobCard({ job }: { job: Job }) {
  const colors = useColors();
  const { markArrived, submitDiagnosis, completeRepair } = useFundi();
  const [open, setOpen] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [labour, setLabour] = useState('');
  const action = nextAction(job.status);

  const send = () => {
    // Parts come from the trade's usual bill; the technician sets the finding
    // and their labour, which are the parts only they can know.
    const base = buildQuote(job.service);
    submitDiagnosis(job.id, {
      diagnosis: diagnosis.trim() || base.diagnosis,
      parts: base.parts,
      labour: Number(labour) || base.labour,
    });
    setOpen(false);
    setDiagnosis('');
    setLabour('');
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.service, { color: colors.foreground }]}>{job.service}</Text>
        <Text style={[styles.fee, { color: colors.foreground }]}>{formatMoney(share(job.visitFee))}</Text>
      </View>
      <Text style={[styles.problem, { color: colors.mutedForeground }]} numberOfLines={2}>{job.problem}</Text>
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={13} color={colors.mutedForeground} />
        <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>{job.locationLabel}</Text>
      </View>

      {action === null ? (
        <View style={[styles.waiting, { backgroundColor: colors.muted }]}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>{STATUS_LABEL[job.status]}</Text>
        </View>
      ) : action === 'diagnose' && open ? (
        <View style={styles.form}>
          <TextInput
            accessibilityLabel="What you found"
            testID={`diagnosis-${job.id}`}
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder="What did you find?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.input, styles.multiline, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          />
          <TextInput
            accessibilityLabel="Labour cost"
            testID={`labour-${job.id}`}
            value={labour}
            onChangeText={(value) => setLabour(value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Labour cost"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send the quote"
            testID={`send-quote-${job.id}`}
            onPress={send}
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
          >
            <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Send quote</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action === 'arrived' ? 'Mark arrived' : action === 'diagnose' ? 'Start the diagnosis' : 'Mark the job completed'}
          testID={`work-action-${job.id}`}
          onPress={() => {
            if (action === 'arrived') markArrived(job.id);
            else if (action === 'diagnose') setOpen(true);
            else completeRepair(job.id);
          }}
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
        >
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
            {action === 'arrived' ? 'I have arrived' : action === 'diagnose' ? 'Add diagnosis' : 'Job completed'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function WorkPending() {
  const colors = useColors();
  const { profile } = useWork();
  return (
    <View style={[styles.pending, { backgroundColor: colors.warningMuted }]}>
      <Feather name="clock" size={26} color={colors.warning} />
      <Text style={[styles.pendingTitle, { color: colors.foreground }]}>Documents under review</Text>
      <Text style={[styles.pendingText, { color: colors.mutedForeground }]}>
        {profile
          ? `We are checking your ${profile.trade.toLowerCase()} certificate and ID. You can go online as soon as it clears.`
          : 'We are checking your documents. You can go online as soon as it clears.'}
      </Text>
    </View>
  );
}

function WorkVerified({ query }: { query: string }) {
  const colors = useColors();
  const { isAvailable, setAvailable, offers, mine, accept, decline, earnings } = useWork();
  const term = query.trim().toLowerCase();
  const shown = term
    ? offers.filter((job) => `${job.service} ${job.locationLabel} ${job.problem}`.toLowerCase().includes(term))
    : offers;

  return (
    <View style={styles.screen}>
      <SwitchRow
        title={isAvailable ? 'Available for work' : 'Not accepting jobs'}
        hint={isAvailable ? 'New jobs near you will appear here.' : 'Turn this on to start receiving jobs.'}
        value={isAvailable}
        onValueChange={setAvailable}
        accessibilityLabel="Available for work"
        testID="availability-switch"
      />

      <View style={[styles.earnings, { backgroundColor: colors.secondary }]}>
        <View>
          <Text style={[styles.earningsLabel, { color: colors.secondaryForeground }]}>EARNINGS THIS WEEK</Text>
          <Text style={[styles.earningsValue, { color: colors.secondaryForeground }]}>{formatMoney(earnings)}</Text>
        </View>
        <Text style={[styles.earningsJobs, { color: colors.secondaryForeground }]}>
          {mine.length} {mine.length === 1 ? 'job' : 'jobs'}
        </Text>
      </View>

      {mine.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your jobs</Text>
          {mine.map((job) => <MyJobCard key={job.id} job={job} />)}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>New jobs</Text>
      {!isAvailable ? (
        <EmptyState
          icon="moon"
          tone="waiting"
          title="You are offline"
          text="Turn on Available for work and jobs near you will arrive here."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={term ? 'search' : 'inbox'}
          title={term ? 'Nothing matches that' : 'No jobs waiting'}
          text={
            term
              ? `No open job mentions “${query.trim()}”. Try the service or the area.`
              : 'When a customer nearby asks for your trade, the job lands here.'
          }
        />
      ) : (
        shown.map((job) => (
          <OfferCard key={job.id} job={job} onAccept={() => accept(job.id)} onDecline={() => decline(job.id)} />
        ))
      )}
    </View>
  );
}

/**
 * The technician side of home.
 *
 * Which of the three it shows is the whole point of the gate: nobody reaches
 * the availability switch, and so no customer reaches them, until documents
 * have been read.
 */
export function WorkHome({ query = '' }: { query?: string }) {
  const { status } = useWork();
  if (status === 'none') return <WorkApplication />;
  if (status === 'pending') return <WorkPending />;
  return <WorkVerified query={query} />;
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  pending: { alignItems: 'center', gap: 9, borderRadius: 16, paddingVertical: 30, paddingHorizontal: 22 },
  pendingTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  pendingText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  earnings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 16 },
  earningsLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  earningsValue: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.8, marginTop: 4 },
  earningsJobs: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tag: { borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  fee: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  service: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3, flex: 1 },
  problem: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 5 },
  action: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  outline: { borderWidth: 1 },
  actionText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  primary: { minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginTop: 3 },
  waitingText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  form: { gap: 9, marginTop: 5 },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, fontFamily: 'Inter_400Regular', fontSize: 14 },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
});
