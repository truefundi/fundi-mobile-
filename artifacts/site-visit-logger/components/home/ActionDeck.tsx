import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import type { Job } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';
import type { JobSummary } from '@/lib/job-summary';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

export type DeckItem = { job: Job; summary: JobSummary };

/** Cards drawn behind the front one while the deck is closed. */
const PEEK = 2;
/** How far each card behind shows below the one in front of it. */
const PEEK_OFFSET = 14;
/** How much narrower each card behind is, per side. */
const PEEK_INSET = 12;

type Props = {
  /** Newest first: the first item is the front card. */
  items: DeckItem[];
  onOpen: (job: Job) => void;
};

/**
 * Requests waiting on the client, as a pile of cards: the newest in front, the
 * rest peeking out behind it, and a count on top. Tapping the header fans the
 * pile out into a list (and back).
 */
export function ActionDeck({ items, onOpen }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  const total = items.length;
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((value) => !value);
  };
  const behind = open ? 0 : Math.min(PEEK, total - 1);

  const card = (item: DeckItem, index: number) => (
    <Pressable
      key={item.job.id}
      accessibilityRole="button"
      accessibilityLabel={`${index + 1} of ${total}: ${item.job.service}. ${item.summary.label}. ${item.summary.hint}`}
      testID={`home-deck-card-${index}`}
      onPress={() => onOpen(item.job)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {total > 1 ? (
        <View style={[styles.corner, { backgroundColor: colors.primary }]} testID={`home-deck-position-${index}`}>
          <Text style={[styles.cornerText, { color: colors.primaryForeground }]}>
            {index + 1}/{total}
          </Text>
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.kicker, { color: colors.primary }]} numberOfLines={1}>
          {item.summary.label.toUpperCase()}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {item.job.service}
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.summary.hint}
        </Text>
      </View>
      <View style={[styles.openPill, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.openText, { color: colors.primary }]}>Open</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );

  return (
    <View testID="home-action-deck">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${total} ${total === 1 ? 'request needs' : 'requests need'} you. ${open ? 'Stack them' : 'Show all'}`}
        disabled={total === 1}
        onPress={toggle}
        hitSlop={6}
        style={styles.header}
        testID="home-deck-toggle"
      >
        <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.countText, { color: colors.primaryForeground }]}>{total}</Text>
        </View>
        <Text style={[styles.headerText, { color: colors.foreground }]}>
          {total === 1 ? 'Needs you' : 'Need you'}
        </Text>
        {total > 1 ? (
          <View style={styles.headerAction}>
            <Text style={[styles.headerActionText, { color: colors.primary }]}>{open ? 'Stack' : 'Show all'}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
          </View>
        ) : null}
      </Pressable>

      {open ? (
        <View style={styles.list}>{items.map(card)}</View>
      ) : (
        <View style={{ paddingBottom: behind * PEEK_OFFSET }}>
          {/* The cards behind, smaller and lighter the further back. */}
          {Array.from({ length: behind }, (_, i) => behind - i).map((depth) => (
            // Tapping a card behind fans the pile out.
            <Pressable
              key={`peek-${depth}`}
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={`Show all ${total} requests`}
              testID={`home-deck-peek-${depth}`}
              style={[
                styles.peek,
                {
                  // Same height as the front card, shifted down by its depth.
                  top: depth * PEEK_OFFSET,
                  bottom: (behind - depth) * PEEK_OFFSET,
                  left: depth * PEEK_INSET,
                  right: depth * PEEK_INSET,
                  backgroundColor: colors.secondary,
                  borderColor: colors.primary + (depth === 1 ? '99' : '66'),
                  opacity: depth === 1 ? 1 : 0.8,
                  elevation: 4 - depth,
                },
              ]}
            />
          ))}
          <View style={styles.front}>{card(items[0], 0)}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  headerText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15 },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerActionText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  list: { gap: 10 },
  peek: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  front: {
    borderRadius: 14,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    paddingTop: 16,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  cornerText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  copy: { flex: 1, paddingRight: 28 },
  kicker: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.3 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 5 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 3 },
  openPill: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 16, paddingLeft: 12, paddingRight: 8, paddingVertical: 7 },
  openText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});
