import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PAYMENT_CODE_OPTIONS, paymentCodeOption } from '@/constants/paymentCodes';
import { formatBookingFee } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';
import type { PaymentClaim, PaymentClaimMethod } from '@/lib/payments-api';
import { Button } from '@/components/ui/Button';

type PayByCodeProps = {
  method: PaymentClaimMethod;
  onMethodChange: (method: PaymentClaimMethod) => void;
  payerNumber: string;
  onPayerNumberChange: (value: string) => void;
  amount: number;
  /** Locks the choices once a claim is waiting for review. */
  disabled?: boolean;
  /** Light colours for a dark (SOS) screen. */
  tone?: 'default' | 'danger';
};

/** MTN / Airtel merchant codes, how to pay, and the number the customer paid from. */
export function PayByCode({ method, onMethodChange, payerNumber, onPayerNumberChange, amount, disabled, tone = 'default' }: PayByCodeProps) {
  const colors = useColors();
  const accent = tone === 'danger' ? colors.destructive : colors.primary;
  const selected = paymentCodeOption(method);
  const canDial = Platform.OS !== 'web' && !!selected.dial;

  return (
    <View style={styles.wrap}>
      <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {PAYMENT_CODE_OPTIONS.map((option, index) => {
          const isSelected = option.method === method;
          return (
            <Pressable
              key={option.method}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onMethodChange(option.method)}
              testID={`pay-code-${option.method.toLowerCase()}`}
              style={[
                styles.option,
                index < PAYMENT_CODE_OPTIONS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                disabled && !isSelected && { opacity: 0.5 },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: isSelected ? accent + '18' : colors.muted }]}>
                <Ionicons name="phone-portrait-outline" size={20} color={isSelected ? accent : colors.mutedForeground} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.title, { color: colors.foreground }]}>{option.title}</Text>
                <Text style={[styles.codeLine, { color: colors.mutedForeground }]}>
                  Pay code{' '}
                  <Text selectable style={[styles.code, { color: option.code ? colors.foreground : colors.mutedForeground }]}>
                    {option.code ?? 'not set yet'}
                  </Text>
                </Text>
              </View>
              <View style={[styles.radio, { borderColor: isSelected ? accent : colors.input }]}>
                {isSelected ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.boxTitle, { color: colors.foreground }]}>
          Pay {formatBookingFee(amount)} with {selected.title}
        </Text>
        {selected.dial ? (
          <Text selectable style={[styles.dial, { color: colors.foreground, backgroundColor: colors.muted }]} testID="pay-code-dial">
            {selected.dial}
          </Text>
        ) : null}
        <Text style={[styles.steps, { color: colors.mutedForeground }]}>{selected.steps}</Text>
        {canDial ? (
          <Button
            label="Dial now"
            icon="call-outline"
            variant="outline"
            size="small"
            onPress={() => void Linking.openURL(`tel:${selected.dial!.replace(/#/g, '%23')}`)}
            testID="pay-code-dial-button"
          />
        ) : null}

        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Number you paid from</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="call-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <TextInput
            value={payerNumber}
            onChangeText={onPayerNumberChange}
            editable={!disabled}
            keyboardType="phone-pad"
            placeholder="e.g. 0788 123 456"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Number you paid from"
            testID="pay-code-payer-number"
            style={[styles.input, { color: colors.foreground }]}
          />
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Fundi matches your payment by this number before your request is sent.
        </Text>
      </View>
    </View>
  );
}

type ClaimStatusProps = {
  claim: PaymentClaim;
  checking: boolean;
  onCheck: () => void;
  onRetry: () => void;
  /** Sends the request with the confirmed payment again, e.g. after it failed. */
  onContinue: () => void;
  /** True while the request is being sent. */
  continuing: boolean;
};

/** Where an "I have paid" report stands: waiting, confirmed or not found. */
export function ClaimStatus({ claim, checking, onCheck, onRetry, onContinue, continuing }: ClaimStatusProps) {
  const colors = useColors();
  const method = claim.paymentMethod === 'AIRTEL' ? 'Airtel Money' : 'MTN Mobile Money';

  if (claim.status === 'REJECTED') {
    return (
      <View style={[styles.status, { backgroundColor: colors.card, borderColor: colors.destructive }]} testID="claim-status-rejected">
        <View style={styles.statusHead}>
          <Ionicons name="close-circle" size={20} color={colors.destructive} />
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>We could not confirm your payment</Text>
        </View>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {claim.reviewNote?.trim() || `No ${method} payment of ${formatBookingFee(claim.amount)} from ${claim.paymentNumber} was found.`}
        </Text>
        <Button label="Report the payment again" icon="refresh" variant="outline" size="small" onPress={onRetry} testID="claim-retry-button" />
      </View>
    );
  }

  if (claim.status === 'APPROVED') {
    return (
      <View style={[styles.status, { backgroundColor: colors.card, borderColor: colors.success }]} testID="claim-status-approved">
        <View style={styles.statusHead}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.statusTitle, { color: colors.foreground }]}>Payment confirmed</Text>
        </View>
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          Fundi received {formatBookingFee(claim.amount)}. {continuing ? 'Sending your request now…' : 'Your payment is kept for 7 days.'}
        </Text>
        {continuing ? null : (
          <Button label="Send my request" icon="send" size="small" onPress={onContinue} testID="claim-continue-button" />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.status, { backgroundColor: colors.card, borderColor: colors.warning }]} testID="claim-status-pending">
      <View style={styles.statusHead}>
        <Ionicons name="time-outline" size={20} color={colors.warning} />
        <Text style={[styles.statusTitle, { color: colors.foreground }]}>Waiting for Fundi to confirm</Text>
      </View>
      <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
        You reported {formatBookingFee(claim.amount)} by {method} from {claim.paymentNumber}. Your request is sent as soon as
        the payment is confirmed. You can leave this screen and come back.
      </Text>
      <Button
        label={checking ? 'Checking…' : 'Check now'}
        icon="refresh"
        variant="outline"
        size="small"
        loading={checking}
        onPress={onCheck}
        testID="claim-check-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  codeLine: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  code: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  box: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  boxTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  dial: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  steps: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 46 },
  input: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, paddingVertical: 10 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  status: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, flex: 1 },
  statusText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
});
