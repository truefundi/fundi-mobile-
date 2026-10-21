import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PIN_LENGTH } from '@/constants/auth';
import { useColors } from '@/hooks/useColors';

type PinFieldProps = {
  value: string;
  onChange: (pin: string) => void;
  label?: string;
  error?: string;
  autoFocus?: boolean;
  testID?: string;
  allowToggleVisibility?: boolean;
};

export function PinField({
  value,
  onChange,
  label,
  error,
  autoFocus = false,
  testID = 'pin-input',
  allowToggleVisibility = true,
}: PinFieldProps) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);
  const [isSecure, setIsSecure] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  const cleanDigits = value.replace(/\D/g, '').slice(0, PIN_LENGTH);

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
          {allowToggleVisibility && cleanDigits.length > 0 ? (
            <Pressable
              onPress={() => setIsSecure(!isSecure)}
              hitSlop={8}
              style={styles.toggleBtn}
              accessibilityRole="button"
              accessibilityLabel={isSecure ? 'Show PIN' : 'Hide PIN'}
            >
              <Feather name={isSecure ? 'eye' : 'eye-off'} size={15} color={colors.primary} />
              <Text style={[styles.toggleText, { color: colors.primary }]}>{isSecure ? 'Show' : 'Hide'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? `Enter ${PIN_LENGTH} digit PIN`}
        onPress={() => inputRef.current?.focus()}
        style={styles.cellRow}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => {
          const char = cleanDigits[index] ?? '';
          const active = isFocused && index === cleanDigits.length;
          const filled = index < cleanDigits.length;

          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  backgroundColor: colors.card,
                  borderColor: error
                    ? colors.destructive
                    : active
                    ? colors.primary
                    : filled
                    ? colors.primary + '80'
                    : colors.border,
                },
              ]}
            >
              {char ? (
                <Text style={[styles.cellText, { color: colors.foreground }]}>
                  {isSecure ? '●' : char}
                </Text>
              ) : null}
            </View>
          );
        })}

        <TextInput
          ref={inputRef}
          accessibilityLabel={label ?? 'PIN input'}
          testID={testID}
          value={cleanDigits}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
            onChange(digits);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          autoFocus={autoFocus && Platform.OS !== 'web'}
          style={styles.hiddenInput}
          caretHidden
        />
      </Pressable>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  toggleText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  cellRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    height: 58,
    gap: 8,
  },
  cell: {
    flex: 1,
    height: 58,
    maxWidth: 62,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: 1,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    height: '100%',
    width: '100%',
    color: 'transparent',
  },
  error: {
    fontFamily: 'Inter_500Medium',
    
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
});
