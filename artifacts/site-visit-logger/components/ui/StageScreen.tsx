import React, { type ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Sticky action area pinned to the bottom of the screen. */
  footer?: ReactNode;
  onBack?: () => void;
  /** Hide the back control on stages the customer cannot reverse out of. */
  hideBack?: boolean;
};

/** Shared chrome for every stage of the job journey. */
export function StageScreen({ eyebrow, title, subtitle, children, footer, onBack, hideBack }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/activity')));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 24 : insets.top + 8 }]}>
        {hideBack ? (
          <View style={styles.backButton} />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" testID="stage-back-button" onPress={goBack} style={styles.backButton}>
            <Feather name="arrow-left" size={21} color={colors.foreground} />
          </Pressable>
        )}
        <View style={styles.backButton} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: footer ? 24 : Platform.OS === 'web' ? 34 : insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 18 : insets.bottom + 14 },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 4 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 27, letterSpacing: -0.7, lineHeight: 33 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9 },
  body: { marginTop: 20, gap: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, gap: 10 },
});
