import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PinField } from '@/components/auth/PinField';
import { PinResetFlow } from '@/components/auth/PinResetFlow';
import { Button } from '@/components/ui/Button';
import { StageScreen } from '@/components/ui/StageScreen';
import { PIN_LENGTH } from '@/constants/auth';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { changePin } from '@/lib/auth-api';
import { notify } from '@/lib/haptics';

/**
 * Reached from Settings. Change the PIN with the current one, or, if it is
 * forgotten (or was never set), reset it with an SMS code to the account phone.
 */
export default function ChangePinScreen() {
  const colors = useColors();
  const router = useRouter();
  const { account } = useAuth();
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'change' | 'reset'>(initialMode === 'reset' ? 'reset' : 'change');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  if (!account) return null;

  const submit = async () => {
    if (next !== confirm) return setError('The two new PINs do not match.');
    if (next === current) return setError('Choose a PIN different from your current one.');
    setBusy(true);
    setError('');
    try {
      await changePin(current, next);
      await notify('success');
      setDone('Your PIN was changed. Use the new one next time you sign in.');
    } catch (problem) {
      setError(problem instanceof Error && problem.message ? problem.message : 'We could not change your PIN. Try again.');
      setCurrent('');
      await notify('error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <StageScreen
        eyebrow="Security"
        title="PIN updated"
        subtitle={done}
        onBack={goBack}
        footer={<Button label="Back to settings" onPress={goBack} testID="pin-done-button" />}
      >
        <View />
      </StageScreen>
    );
  }

  if (mode === 'reset') {
    return (
      <StageScreen
        eyebrow="Security"
        title="Reset your PIN"
        subtitle="We'll text a code to your phone. Enter it with a new PIN. Any other device signed in to this account will be signed out."
        onBack={() => (initialMode === 'reset' ? goBack() : setMode('change'))}
      >
        <PinResetFlow
          phone={account.phone}
          onDone={() => setDone('Your PIN was reset. Use the new one next time you sign in.')}
        />
      </StageScreen>
    );
  }

  const ready = current.length === PIN_LENGTH && next.length === PIN_LENGTH && confirm.length === PIN_LENGTH;

  return (
    <StageScreen
      eyebrow="Security"
      title="Change your PIN"
      subtitle={`Enter your current PIN, then choose a new ${PIN_LENGTH}-digit one.`}
      onBack={goBack}
      footer={
        <Button
          label="Save new PIN"
          onPress={() => void submit()}
          disabled={!ready}
          loading={busy}
          testID="change-pin-submit"
        />
      }
    >
      <PinField
        value={current}
        onChange={(value) => {
          setCurrent(value);
          setError('');
        }}
        label="Current PIN"
        testID="change-pin-current"
        autoFocus
      />
      <PinField
        value={next}
        onChange={(value) => {
          setNext(value);
          setError('');
        }}
        label={`New ${PIN_LENGTH}-digit PIN`}
        testID="change-pin-new"
      />
      <PinField
        value={confirm}
        onChange={(value) => {
          setConfirm(value);
          setError('');
        }}
        label="Confirm new PIN"
        testID="change-pin-confirm"
      />

      {error ? (
        <Text testID="change-pin-error" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        testID="change-pin-forgot"
        onPress={() => {
          setMode('reset');
          setError('');
        }}
        hitSlop={8}
        style={styles.forgot}
      >
        <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot your PIN, or never set one?</Text>
        <Text style={[styles.forgotHint, { color: colors.mutedForeground }]}>Reset it with an SMS code instead</Text>
      </Pressable>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  forgot: { alignItems: 'center', paddingVertical: 8, gap: 2 },
  forgotText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  forgotHint: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
