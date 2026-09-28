import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Paints the confirm action red for the destructive ones. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Two-button confirmation used before anything irreversible.
 *
 * React Native's Alert is a no-op on web and this app ships to web, so the
 * dialog is drawn rather than delegated to the platform.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const colors = useColors();
  const accent = destructive ? colors.destructive : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        testID="confirm-backdrop"
        onPress={busy ? undefined : onCancel}
        style={styles.backdrop}
      >
        {/* Swallows taps so pressing the card itself never dismisses it. */}
        <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => undefined}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              testID="confirm-cancel-button"
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [styles.button, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ busy: !!busy }}
              testID="confirm-accept-button"
              onPress={busy ? undefined : onConfirm}
              style={({ pressed }) => [styles.button, { backgroundColor: accent, borderColor: accent, opacity: pressed ? 0.8 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  card: { width: '100%', maxWidth: 380, borderRadius: 18, borderWidth: 1, padding: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.4 },
  message: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 9 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
