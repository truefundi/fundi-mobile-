import React, { type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeading } from '@/components/ui/PageHeading';
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
        {hideBack ? <View style={styles.backSpacer} /> : <BackButton onPress={goBack} testID="stage-back-button" />}
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: footer ? 24 : Platform.OS === 'web' ? 34 : insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
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
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4 },
  // Keeps the title at the same height on stages that hide the back arrow.
  backSpacer: { height: 44 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  body: { marginTop: 20, gap: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, gap: 10 },
});
