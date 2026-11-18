import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatBookingFee, type Job } from '@/constants/jobs';
import { PriceBreakdown } from '@/components/checkout/PriceBreakdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useFundi } from '@/context/FundiContext';
import { useColors } from '@/hooks/useColors';
import { fetchMyPayments, type MyBookingPayment, type PaymentQuote } from '@/lib/payments-api';

type Entry = {
  key: string;
  /** The job on this device, when there is one; the row opens its invoice. */
  job?: Job;
  label: string;
  detail: string;
  reference: string;
  amount: number;
  /** Service Booking Fees run through Fundi; service balances may settle outside it. */
  viaFundi: boolean;
  at: string;
  /** How the booking fee was priced, from the payment the API recorded. */
  pricing?: PaymentQuote | null;
  /** A short status shown under the amount, e.g. an unused fee that expired. */
  note?: string;
};

const PAYMENT_NOTES: Partial<Record<MyBookingPayment['status'], string>> = {
  EXPIRED: 'Expired',
  PAUSED: 'Paused',
};

/** Payment history reached from Profile — every amount the customer committed to. */
export default function PaymentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobs } = useFundi();
  // Booking fees come from the API, which keeps every payment and how it was priced.
  // Until it answers (or when it cannot be reached) the jobs on this device stand in.
  const [payments, setPayments] = useState<MyBookingPayment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchMyPayments()
        .then((rows) => {
          if (cancelled) return;
          setPayments(rows);
          setLoadError(null);
        })
        .catch((error: unknown) => {
          if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load your payments.');
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const entries = useMemo(() => {
    const rows: Entry[] = [];
    const jobsById = new Map(jobs.map((job) => [job.id, job]));

    if (payments) {
      for (const payment of payments) {
        const job = payment.jobId ? jobsById.get(payment.jobId) : undefined;
        rows.push({
          key: `payment-${payment.id}`,
          job,
          label: payment.requestType === 'SOS' ? 'Emergency booking fee' : 'Service Booking Fee',
          detail: `${payment.service} · Paid via Fundi`,
          reference: job?.reference ?? payment.externalPaymentId,
          amount: payment.amount,
          viaFundi: true,
          at: payment.paidAt,
          pricing: payment.pricingDetails,
          note: payment.jobId ? undefined : PAYMENT_NOTES[payment.status],
        });
      }
    }

    for (const job of jobs) {
      if (!payments && job.bookingFee?.status === 'PAID') {
        rows.push({
          key: `${job.id}-booking`,
          job,
          label: 'Service Booking Fee',
          detail: `${job.service} · Paid via Fundi`,
          reference: job.reference,
          amount: job.bookingFee.amount,
          viaFundi: true,
          at: job.bookingFee.paidAt ?? job.createdAt,
        });
      }
      if (job.settlementMethod) {
        rows.push({
          key: `${job.id}-repair`,
          job,
          label: 'Repair balance',
          detail: `${job.service} · ${job.settlementMethod}`,
          reference: job.reference,
          amount: balanceDue(job),
          viaFundi: job.settlementMethod === 'Fundi',
          at: job.completedAt ?? job.statusSince,
        });
      }
    }
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [jobs, payments]);

  const throughFundi = entries.filter((entry) => entry.viaFundi).reduce((sum, entry) => sum + entry.amount, 0);
  const outside = entries.filter((entry) => !entry.viaFundi).reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <StageScreen
      eyebrow="PAYMENTS"
      title="Payment history"
      subtitle="Service Booking Fees are handled by Fundi. Service and repair balances may be settled directly with your technician."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    >
      {loadError && !payments ? (
        <Text style={[styles.loadError, { color: colors.mutedForeground }]} testID="payments-load-error">
          Showing the payments saved on this phone. {loadError}
        </Text>
      ) : null}
      {entries.length === 0 ? (
        <EmptyState
          icon="credit-card"
          title="No payments yet"
          text="Service Booking Fees and service settlements will be listed here once you complete a job."
          action={{ label: 'Browse services', onPress: () => router.navigate('/services'), testID: 'payments-browse-button' }}
        />
      ) : (
        <>
        <SectionCard title="Totals">
          <MoneyRow label="Paid through Fundi" value={formatBookingFee(throughFundi)} />
          <MoneyRow label="Settled outside Fundi" value={formatBookingFee(outside)} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MoneyRow label="Total spent" value={formatBookingFee(throughFundi + outside)} strong />
        </SectionCard>
        {entries.map((entry) => {
          const job = entry.job;
          return (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityLabel={`${entry.label}, ${entry.reference}`}
              accessibilityState={{ disabled: !job }}
              disabled={!job}
              testID={`payment-${entry.key}`}
              onPress={() => job && router.push(`/invoice/${job.id}`)}
              style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: entry.viaFundi ? colors.secondary : colors.muted }]}>
                  <Ionicons
                    name={entry.viaFundi ? 'shield-checkmark-outline' : 'swap-horizontal-outline'}
                    size={19}
                    color={entry.viaFundi ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.label, { color: colors.foreground }]}>{entry.label}</Text>
                  <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {entry.detail}
                  </Text>
                  <Text style={[styles.reference, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {entry.reference}
                  </Text>
                </View>
                <View style={styles.amountColumn}>
                  <View style={styles.amountRow}>
                    <Text style={[styles.amount, { color: colors.foreground }]}>{formatBookingFee(entry.amount)}</Text>
                    {job ? <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} /> : null}
                  </View>
                  {entry.note ? (
                    <Text style={[styles.note, { color: colors.warningForeground, backgroundColor: colors.warningMuted }]}>
                      {entry.note}
                    </Text>
                  ) : null}
                </View>
              </View>
              <PriceBreakdown quote={entry.pricing ?? null} testID={`payment-breakdown-${entry.key}`} />
            </Pressable>
          );
        })}
        </>
      )}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: 8 },
  loadError: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  reference: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  amountColumn: { alignItems: 'flex-end', gap: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  note: { fontFamily: 'Inter_600SemiBold', fontSize: 11, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
});
