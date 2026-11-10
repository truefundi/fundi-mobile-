import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { CONVERSATION_MAX_AMOUNT, CONVERSATION_MAX_MESSAGE_LENGTH } from '@/lib/conversations-api';

function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.topRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Amount + note sheet used for a first offer and for counter-offers. */
export function OfferSheet({
  visible,
  mode,
  currency,
  referenceAmount,
  remaining,
  busy,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  mode: 'offer' | 'counter';
  currency: string;
  /** The amount being countered, shown for context. */
  referenceAmount?: number;
  remaining: number;
  busy: boolean;
  onClose: () => void;
  onSubmit: (amount: number, notes?: string) => Promise<void>;
}) {
  const colors = useColors();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setNotes('');
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    const value = Number(amount.replace(/[^\d]/g, ''));
    if (!Number.isInteger(value) || value < 1 || value > CONVERSATION_MAX_AMOUNT) {
      setError(`Enter a whole amount in ${currency}.`);
      return;
    }
    if (referenceAmount !== undefined && value === referenceAmount) {
      setError('That is already the amount on the table.');
      return;
    }
    try {
      await onSubmit(value, notes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the offer.');
    }
  };

  return (
    <Sheet visible={visible} title={mode === 'counter' ? 'Counter-offer' : 'Propose a price'} onClose={onClose}>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        {mode === 'counter' && referenceAmount !== undefined
          ? `Current offer: ${currency} ${referenceAmount.toLocaleString()}. Your counter replaces it.`
          : 'This is the repair and labour price, separate from the booking fee.'}
        {` You can send ${remaining} more offer${remaining === 1 ? '' : 's'}.`}
      </Text>
      <TextInput
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          setError(null);
        }}
        keyboardType="number-pad"
        placeholder={`Amount in ${currency}`}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        testID="offer-amount-input"
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        maxLength={CONVERSATION_MAX_MESSAGE_LENGTH}
        placeholder="Note (optional, e.g. includes parts)"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
      />
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <Button
        label={mode === 'counter' ? 'Send counter-offer' : 'Send offer'}
        onPress={() => void submit()}
        loading={busy}
        disabled={busy || !amount.trim()}
        style={{ marginTop: 8 }}
        testID="offer-submit"
      />
    </Sheet>
  );
}

/** Collects a reason before a cancel / pull-out / decline. */
export function ReasonSheet({
  visible,
  title,
  description,
  confirmLabel,
  required = true,
  busy,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  required?: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const colors = useColors();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    const text = reason.trim();
    if (required && text.length < 3) {
      setError('Please give a short reason (at least 3 characters).');
      return;
    }
    try {
      await onSubmit(text);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{description}</Text>
      <TextInput
        value={reason}
        onChangeText={(v) => {
          setReason(v);
          setError(null);
        }}
        maxLength={1000}
        multiline
        placeholder={required ? 'Reason' : 'Reason (optional)'}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          styles.multiline,
          { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
        ]}
        testID="reason-input"
      />
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <Button
        label={confirmLabel}
        variant="danger"
        onPress={() => void submit()}
        loading={busy}
        disabled={busy}
        style={{ marginTop: 8 }}
        testID="reason-submit"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    marginBottom: 8,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 4 },
});
