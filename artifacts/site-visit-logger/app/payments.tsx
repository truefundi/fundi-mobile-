import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, type Job } from '@/constants/jobs';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useFundi } from '@/context/FundiContext';
import { useColors } from '@/hooks/useColors';

type Entry = {
  key: string;
  job: Job;
  label: string;
  detail: string;
  amount: number;
  /** Visit fees run through Fundi; repair balances may settle outside it. */
  viaFundi: boolean;
  at: string;
};

/** Payment history reached from Profile — every amount the customer committed to. */
export default function PaymentsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { jobs } = useFundi();

  const entries = useMemo(() => {
    const rows: Entry[] = [];
    for (const job of jobs) {
      if (job.visitPaymentMethod) {
        rows.push({
          key: `${job.id}-visit`,
          job,
          label: 'Visit & diagnostic fee',
          detail: `${job.service} · ${job.visitPaymentMethod}`,
          amount: job.visitFee,
          viaFundi: true,
          at: job.createdAt,
        });
      }
      if (job.settlementMethod) {
        rows.push({
          key: `${job.id}-repair`,
          job,
          label: 'Repair balance',
          detail: `${job.service} · ${job.settlementMethod}`,
          amount: balanceDue(job),
          viaFundi: job.settlementMethod === 'Fundi',
          at: job.completedAt ?? job.statusSince,
        });
      }
    }
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [jobs]);

  const throughFundi = entries.filter((entry) => entry.viaFundi).reduce((sum, entry) => sum + entry.amount, 0);
  const outside = entries.filter((entry) => !entry.viaFundi).reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <StageScreen
      eyebrow="PAYMENTS"
      title="Payment history"
      subtitle="Visit fees are handled by Fundi. Repair balances may be settled directly with your technician."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
    >
      {entries.length === 0 ? (
        <EmptyState
          icon="credit-card"
          title="No payments yet"
          text="Visit fees and repair settlements will be listed here once you complete a job."
          action={{ label: 'Browse services', onPress: () => router.navigate('/services'), testID: 'payments-browse-button' }}
        />
      ) : (
        <>
        <SectionCard title="Totals">
          <MoneyRow label="Paid through Fundi" value={formatMoney(throughFundi)} />
          <MoneyRow label="Settled outside Fundi" value={formatMoney(outside)} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <MoneyRow label="Total spent" value={formatMoney(throughFundi + outside)} strong />
        </SectionCard>
        {entries.map((entry) => (
          <Pressable
            key={entry.key}
            accessibilityRole="button"
            accessibilityLabel={`${entry.label}, ${entry.job.reference}`}
            testID={`payment-${entry.key}`}
            onPress={() => router.push(`/invoice/${entry.job.id}`)}
            style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
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
              <Text style={[styles.reference, { color: colors.mutedForeground }]}>{entry.job.reference}</Text>
            </View>
            <View style={styles.amountColumn}>
              <Text style={[styles.amount, { color: colors.foreground }]}>{formatMoney(entry.amount)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
        ))}
        </>
      )}
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  reference: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  amountColumn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
