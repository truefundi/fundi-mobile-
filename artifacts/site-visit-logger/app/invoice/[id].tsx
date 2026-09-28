import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';
import { balanceDue, formatMoney, quoteSubtotal, repairTotal, type Job } from '@/constants/jobs';
import { formatPhone } from '@/constants/auth';
import { Button } from '@/components/ui/Button';
import { MoneyRow } from '@/components/ui/MoneyRow';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { useAuth } from '@/context/AuthContext';
import { useFundi } from '@/context/FundiContext';
import { useColors } from '@/hooks/useColors';

/** Spec 18 — the digital invoice for a settled job. */
export default function InvoiceScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob } = useFundi();
  const { account } = useAuth();
  const customer = account?.name ?? '—';
  const customerPhone = account ? formatPhone(account.phone) : undefined;
  const job = id ? getJob(id) : undefined;

  if (!job) {
    return (
      <StageScreen title="Invoice not found" onBack={() => router.replace('/activity')}>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>This job is no longer on this device.</Text>
      </StageScreen>
    );
  }

  const issued = new Date(job.completedAt ?? job.statusSince);
  const partsTotal = job.quote?.parts.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) ?? 0;

  return (
    <StageScreen
      eyebrow="INVOICE"
      title={job.reference}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/activity'))}
      footer={<Button label="Share receipt" onPress={() => Share.share({ message: receiptText(job, customer) }).catch(() => undefined)} testID="invoice-share-button" />}
    >
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={[styles.brand, { color: colors.primaryForeground }]}>fundi</Text>
        <View style={[styles.paidBadge, { backgroundColor: colors.primaryForeground }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[styles.paidText, { color: colors.primary }]}>PAID</Text>
        </View>
      </View>

      <SectionCard title="Job">
        <MoneyRow label="Job ID" value={job.reference} />
        <MoneyRow label="Service" value={job.service} />
        <MoneyRow label="Date" value={issued.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
        <MoneyRow label="Time" value={issued.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} />
        <MoneyRow label="Location" value={job.locationLabel} />
      </SectionCard>

      <SectionCard title="Parties">
        <MoneyRow label="Customer" value={customer} hint={customerPhone} />
        <MoneyRow label="Technician" value={job.technician?.name ?? '—'} hint={job.technician?.skill} />
      </SectionCard>

      {job.quote ? (
        <>
          <SectionCard title="Diagnosis">
            <Text style={[styles.body, { color: colors.foreground }]}>{job.quote.diagnosis}</Text>
          </SectionCard>

          <SectionCard title="Parts">
            {job.quote.parts.map((line) => (
              <MoneyRow
                key={line.label}
                label={line.label}
                hint={line.quantity > 1 ? `${line.quantity} × ${formatMoney(line.unitPrice)}` : undefined}
                value={formatMoney(line.quantity * line.unitPrice)}
              />
            ))}
            {job.additionalWork && job.additionalWorkApproved
              ? job.additionalWork.parts.map((line) => (
                  <MoneyRow
                    key={line.label}
                    label={line.label}
                    hint="Approved extra work"
                    value={formatMoney(line.quantity * line.unitPrice)}
                  />
                ))
              : null}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MoneyRow label="Parts" value={formatMoney(partsTotal + (job.additionalWorkApproved && job.additionalWork ? job.additionalWork.parts.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) : 0))} />
            <MoneyRow label="Labour" value={formatMoney(job.quote.labour + (job.additionalWorkApproved && job.additionalWork ? job.additionalWork.labour : 0))} />
          </SectionCard>
        </>
      ) : null}

      <SectionCard title="Payment">
        <MoneyRow label="Repair amount" value={formatMoney(repairTotal(job))} />
        <MoneyRow label="Visit fee" value={formatMoney(job.visitFee)} hint={`Paid by ${job.visitPaymentMethod ?? 'card'}`} credit />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoneyRow label="Balance settled" value={formatMoney(balanceDue(job))} strong />
        <MoneyRow label="Settlement method" value={job.settlementMethod ?? '—'} />
      </SectionCard>

      <SectionCard emphasis>
        <Text style={[styles.totalLabel, { color: colors.primaryForeground }]}>TOTAL</Text>
        <Text style={[styles.total, { color: colors.primaryForeground }]}>
          {formatMoney(repairTotal(job) > 0 ? repairTotal(job) : job.visitFee)}
        </Text>
      </SectionCard>
    </StageScreen>
  );
}

/** Plain-text receipt used by the share sheet. */
function receiptText(job: Job, customer: string): string {
  const lines = [
    `FUNDI RECEIPT — ${job.reference}`,
    `Service: ${job.service}`,
    `Technician: ${job.technician?.name ?? '—'}`,
    `Customer: ${customer}`,
    `Location: ${job.locationLabel}`,
    '',
    job.quote ? `Diagnosis: ${job.quote.diagnosis}` : '',
    job.quote ? `Repair total: ${formatMoney(quoteSubtotal(job.quote))}` : '',
    `Visit fee paid: ${formatMoney(job.visitFee)}`,
    `Balance settled: ${formatMoney(balanceDue(job))} (${job.settlementMethod ?? '—'})`,
    '',
    'Status: PAID',
  ];
  return lines.filter(Boolean).join('\n');
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 18 },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -1 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  paidText: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  divider: { height: 1, marginVertical: 8 },
  totalLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3 },
  total: { fontFamily: 'Inter_700Bold', fontSize: 36, letterSpacing: -1.2, marginTop: 3 },
});
