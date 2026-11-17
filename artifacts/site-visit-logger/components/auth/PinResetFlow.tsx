import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatPhone, OTP_LENGTH, PIN_LENGTH, RESEND_AFTER_MS } from '@/constants/auth';
import { DEFAULT_COUNTRY, type Country } from '@/constants/countries';
import { PhoneField } from '@/components/auth/PhoneField';
import { PinField } from '@/components/auth/PinField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useCountdown } from '@/hooks/useCountdown';
import { cleanAndNormalizePhone, requestLoginOtp } from '@/lib/auth-api';
import { notify } from '@/lib/haptics';

type Props = {
  /** The account's phone when it is already known (signed in); otherwise the user types it. */
  phone?: string;
  /** Called once the new PIN is saved and the user is signed in with it. */
  onDone: () => void;
};

function errorText(problem: unknown, fallback: string) {
  return problem instanceof Error && problem.message ? problem.message : fallback;
}

/**
 * Forgotten PIN: an SMS code proves the phone, then the new PIN replaces the
 * old one and the user is signed in with it. Other devices are signed out.
 */
export function PinResetFlow({ phone: knownPhone, onDone }: Props) {
  const colors = useColors();
  const { resetPin } = useAuth();

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [digits, setDigits] = useState('');
  const [phone, setPhone] = useState(knownPhone ?? '');
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'send' | 'reset' | null>(null);

  const { remainingSeconds } = useCountdown(sentAt ?? new Date(0).toISOString(), RESEND_AFTER_MS);
  const minPhoneDigits = country.nationalDigits ? country.nationalDigits - 1 : 7;
  const typedPhone = `${country.dialCode}${digits.replace(/^0+/, '')}`;

  const sendCode = async (target: string) => {
    setBusy('send');
    setError('');
    try {
      await requestLoginOtp(target);
      setPhone(cleanAndNormalizePhone(target));
      setSentAt(new Date().toISOString());
      setCode('');
    } catch (problem) {
      setError(errorText(problem, 'We could not send a code. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (code.length !== OTP_LENGTH) return setError(`Enter the ${OTP_LENGTH}-digit code from the SMS.`);
    if (pin.length !== PIN_LENGTH) return setError(`Choose a ${PIN_LENGTH}-digit PIN.`);
    if (pin !== confirm) return setError('The two PINs do not match.');
    setBusy('reset');
    setError('');
    try {
      await resetPin(phone, code, pin);
      await notify('success');
      onDone();
    } catch (problem) {
      setError(errorText(problem, 'We could not reset your PIN. Try again.'));
      await notify('error');
    } finally {
      setBusy(null);
    }
  };

  // Step 1: where to send the code.
  if (!sentAt) {
    return (
      <View>
        {knownPhone ? (
          <View style={[styles.phoneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="message-square" size={18} color={colors.primary} />
            <Text style={[styles.phoneCardText, { color: colors.foreground }]}>
              We'll text a code to <Text style={styles.bold}>{formatPhone(knownPhone)}</Text>
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Phone number</Text>
            <PhoneField
              value={digits}
              onChange={(value) => {
                setDigits(value);
                setError('');
              }}
              selectedCountry={country}
              onCountryChange={(next) => {
                setCountry(next);
                setError('');
              }}
              placeholder={country.sampleNumber ?? '7XX XXX XXX'}
              testID="reset-phone-input"
              autoFocus
            />
          </>
        )}
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        <Button
          label="Send code"
          onPress={() => void sendCode(knownPhone ?? typedPhone)}
          disabled={!knownPhone && digits.length < minPhoneDigits}
          loading={busy === 'send'}
          testID="reset-send-code"
          style={styles.primary}
        />
      </View>
    );
  }

  // Step 2: the code and the new PIN, twice.
  return (
    <View>
      <View style={[styles.phoneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="check-circle" size={18} color={colors.success} />
        <Text style={[styles.phoneCardText, { color: colors.foreground }]}>
          Code sent to <Text style={styles.bold}>{formatPhone(phone)}</Text>
        </Text>
        {!knownPhone ? (
          <Pressable
            onPress={() => {
              setSentAt(null);
              setError('');
            }}
            hitSlop={8}
            accessibilityRole="button"
            testID="reset-change-number"
          >
            <Text style={[styles.link, { color: colors.primary }]}>Change</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.field}>
        <PinField
          value={code}
          onChange={(value) => {
            setCode(value);
            setError('');
          }}
          length={OTP_LENGTH}
          masked={false}
          label={`${OTP_LENGTH}-digit code from the SMS`}
          testID="reset-code-input"
          autoFocus
        />
      </View>
      <View style={styles.field}>
        <PinField
          value={pin}
          onChange={(value) => {
            setPin(value);
            setError('');
          }}
          label={`New ${PIN_LENGTH}-digit PIN`}
          testID="reset-new-pin"
        />
      </View>
      <View style={styles.field}>
        <PinField
          value={confirm}
          onChange={(value) => {
            setConfirm(value);
            setError('');
          }}
          label="Confirm new PIN"
          testID="reset-confirm-pin"
        />
      </View>

      {error ? (
        <Text testID="reset-error" style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      <Button
        label="Reset PIN"
        onPress={() => void submit()}
        disabled={code.length !== OTP_LENGTH || pin.length !== PIN_LENGTH || confirm.length !== PIN_LENGTH}
        loading={busy === 'reset'}
        testID="reset-submit"
        style={styles.primary}
      />

      <Pressable
        onPress={() => void sendCode(phone)}
        disabled={remainingSeconds > 0 || busy !== null}
        hitSlop={8}
        accessibilityRole="button"
        testID="reset-resend"
        style={styles.resend}
      >
        <Text style={[styles.link, { color: remainingSeconds > 0 ? colors.mutedForeground : colors.primary }]}>
          {remainingSeconds > 0 ? `Resend code in ${remainingSeconds}s` : 'Resend code'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 18, marginBottom: 8 },
  phoneCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 },
  phoneCardText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  bold: { fontFamily: 'Inter_700Bold' },
  field: { marginTop: 16 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, marginTop: 14 },
  primary: { marginTop: 22 },
  resend: { alignItems: 'center', marginTop: 14, paddingVertical: 6 },
});
