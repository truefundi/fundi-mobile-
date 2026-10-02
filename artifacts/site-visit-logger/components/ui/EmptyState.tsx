import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text: string;
  /** Amber instead of the brand tint, for "waiting on someone else" states. */
  tone?: 'default' | 'waiting';
  /** The way forward, when there is one — an empty screen should not be a dead end. */
  action?: { label: string; onPress: () => void; testID?: string };
};

/**
 * The one empty state, matching the card language the customer screens already
 * use: a solid card, a tinted icon chip, a title and a line of explanation.
 *
 * Dashed borders read as a placeholder someone forgot to finish — fine in a
 * wireframe, wrong beside real content.
 */
export function EmptyState({ icon, title, text, tone = 'default', action }: Props) {
  const colors = useColors();
  const waiting = tone === 'waiting';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: waiting ? colors.warningMuted : colors.secondary }]}>
        <Feather name={icon} size={23} color={waiting ? colors.warning : colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>{text}</Text>
      {action ? (
        <Button label={action.label} onPress={action.onPress} size="small" testID={action.testID} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', marginTop: 6 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 14, textAlign: 'center' },
  text: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7, maxWidth: 320 },
  action: { marginTop: 16, alignSelf: 'center' },
});
