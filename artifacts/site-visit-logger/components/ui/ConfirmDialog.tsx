import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
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
          {/* Stacked, confirm on top: long labels such as "Decline extra work"
              stay on one line on the narrowest phones. */}
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              loading={busy}
              onPress={onConfirm}
              size="small"
              testID="confirm-accept-button"
              style={destructive && !busy ? { backgroundColor: colors.destructive, borderColor: colors.destructive } : undefined}
            />
            <Button label={cancelLabel} variant="outline" onPress={onCancel} disabled={busy} size="small" testID="confirm-cancel-button" />
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
  message: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9 },
  actions: { gap: 10, marginTop: 20 },
});
