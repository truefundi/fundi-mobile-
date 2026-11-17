import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';

export type DialogAction = {
  label: string;
  /** 'cancel' closes the dialog only; 'destructive' paints the action red. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type DialogRequest = {
  title: string;
  message?: string;
  actions: DialogAction[];
};

type Props = {
  request: DialogRequest | null;
  onClose: () => void;
};

/**
 * Drawn replacement for `Alert.alert` with buttons. React Native's Alert does
 * nothing on web, which silently swallowed confirmations such as accepting a
 * price; this dialog behaves the same on every platform.
 */
export function ActionDialog({ request, onClose }: Props) {
  const colors = useColors();
  // Keep the last content while the dialog fades out, so it never redraws empty.
  const lastRequest = useRef<DialogRequest | null>(null);
  if (request) lastRequest.current = request;
  const shown = request ?? lastRequest.current;
  const actions = shown?.actions.length ? shown.actions : [{ label: 'OK', style: 'cancel' as const }];
  // Primary actions first, the cancel action last.
  const ordered = [...actions.filter((a) => a.style !== 'cancel'), ...actions.filter((a) => a.style === 'cancel')];

  return (
    <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="action-dialog">
          <Text style={[styles.title, { color: colors.foreground }]}>{shown?.title}</Text>
          {shown?.message ? (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>{shown.message}</Text>
          ) : null}
          <View style={styles.actions}>
            {ordered.map((action, index) => (
              <Button
                key={`${action.label}-${index}`}
                label={action.label}
                size="small"
                variant={action.style === 'cancel' || (index > 0 && action.style !== 'destructive') ? 'outline' : undefined}
                testID={`dialog-action-${action.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                style={
                  action.style === 'destructive'
                    ? { backgroundColor: colors.destructive, borderColor: colors.destructive }
                    : undefined
                }
                onPress={() => {
                  onClose();
                  action.onPress?.();
                }}
              />
            ))}
          </View>
        </View>
      </View>
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
