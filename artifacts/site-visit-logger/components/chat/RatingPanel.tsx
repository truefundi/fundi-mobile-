import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { notify, vibrate } from '@/lib/haptics';
import type { JobRating, JobRatingState, RatingInput, RatingItem } from '@/lib/ratings-api';

const NATIVE_DRIVER = Platform.OS !== 'web';
const SCORE_LABEL = ['Tap a star', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const COMMENT_MAX = 2000;

/** Five stars; the tapped one pops so the choice registers. */
function StarRow({
  value,
  size,
  onChange,
  label,
  testID,
}: {
  value: number;
  size: number;
  onChange?: (score: number) => void;
  label?: string;
  testID?: string;
}) {
  const colors = useColors();
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  const press = (star: number) => {
    if (!onChange) return;
    void vibrate();
    onChange(star);
    const scale = scales[star - 1];
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 220, useNativeDriver: NATIVE_DRIVER }).start();
  };

  return (
    <View style={[styles.starRow, { gap: size > 24 ? 6 : 4 }]}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const icon = (
          <Animated.View style={{ transform: [{ scale: scales[star - 1] }] }}>
            <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? colors.warning : colors.mutedForeground} />
          </Animated.View>
        );
        return onChange ? (
          <Pressable
            key={star}
            onPress={() => press(star)}
            hitSlop={size > 24 ? 4 : 6}
            accessibilityRole="button"
            accessibilityLabel={`${label ? `${label}: ` : ''}${star} star${star > 1 ? 's' : ''}`}
            testID={testID ? `${testID}-${star}` : undefined}
          >
            {icon}
          </Pressable>
        ) : (
          <View key={star}>{icon}</View>
        );
      })}
    </View>
  );
}

/**
 * Sits where the composer was once the job is complete: invites the client to
 * rate, or shows their rating with a way to change it.
 */
export function RatingBar({
  technicianName,
  state,
  loading,
  bottomInset,
  onRate,
}: {
  technicianName: string;
  state: JobRatingState | null;
  loading: boolean;
  bottomInset: number;
  /** Opens the sheet, optionally with the star the client tapped here. */
  onRate: (initialScore?: number) => void;
}) {
  const colors = useColors();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start();
  }, [rise]);

  const rating = state?.rating ?? null;
  const name = technicianName.trim();

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(bottomInset, 12),
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
      testID="rating-bar"
    >
      {loading && !state ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: 14 }} />
      ) : rating ? (
        <View style={styles.barRow}>
          <View style={[styles.barIcon, { backgroundColor: colors.warning + '22' }]}>
            <Ionicons name="star" size={18} color={colors.warning} />
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.barTitle, { color: colors.foreground }]}>You rated {name}</Text>
            <View style={styles.barStars}>
              <StarRow value={rating.averageScore ?? 0} size={14} />
              <Text style={[styles.barScore, { color: colors.mutedForeground }]}>
                {(rating.averageScore ?? 0).toFixed(1)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => onRate()}
            accessibilityRole="button"
            accessibilityLabel="Edit your rating"
            testID="rating-edit-button"
            style={({ pressed }) => [styles.editBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="edit-2" size={14} color={colors.primary} />
            <Text style={[styles.editLabel, { color: colors.primary }]}>Edit</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inviteRow}>
          <View style={styles.flex1}>
            <Text style={[styles.barTitle, { color: colors.foreground }]}>How did {name} do?</Text>
            <Text style={[styles.barHint, { color: colors.mutedForeground }]}>Job complete · rate the work</Text>
          </View>
          <StarRow value={0} size={26} onChange={(score) => onRate(score)} label="Rate" testID="rating-bar-star" />
        </View>
      )}
    </Animated.View>
  );
}

/** Bottom sheet for giving or changing a rating, one score per rating item. */
export function RatingSheet({
  visible,
  technicianName,
  state,
  initialScore,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  technicianName: string;
  state: JobRatingState | null;
  initialScore?: number;
  onClose: () => void;
  onSubmit: (input: RatingInput, existing: JobRating | null) => Promise<void>;
}) {
  const colors = useColors();
  const existing = state?.rating ?? null;
  // A rating keeps the items it was given on, even if admins changed the list since.
  const items: RatingItem[] = useMemo(() => {
    if (!existing) return state?.items ?? [];
    // Keep the admins' order for the items still listed; any retired ones go last.
    const order = new Map((state?.items ?? []).map((item, index) => [item.id, index]));
    return [...existing.responses]
      .sort((a, b) => (order.get(a.itemId) ?? Infinity) - (order.get(b.itemId) ?? Infinity))
      .map((r) => ({ id: r.itemId, name: r.item }));
  }, [existing, state?.items]);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  // Fresh values each time the sheet opens (not when a save updates the rating while it closes).
  const wasVisible = useRef(false);
  useEffect(() => {
    const opened = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!opened) return;
    const next: Record<string, number> = {};
    for (const item of items) {
      const given = existing?.responses.find((r) => r.itemId === item.id)?.score;
      next[item.id] = given ?? initialScore ?? 0;
    }
    setScores(next);
    setComment(existing?.comment ?? '');
    setError(null);
    setBusy(false);
  }, [visible, items, existing, initialScore]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(progress, { toValue: 1, friction: 9, tension: 70, useNativeDriver: NATIVE_DRIVER }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start(
        () => setMounted(false),
      );
    }
  }, [visible, mounted, progress]);

  const values = items.map((item) => scores[item.id] ?? 0);
  const scored = values.filter((v) => v > 0);
  const average = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  const complete = items.length > 0 && scored.length === items.length;
  const name = technicianName.trim();

  const setAll = (score: number) => {
    setScores(Object.fromEntries(items.map((item) => [item.id, score])));
    setError(null);
  };

  const submit = async () => {
    if (!complete) {
      setError('Give every item a score from 1 to 5.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(
        { responses: items.map((item) => ({ itemId: item.id, score: scores[item.id] })), comment: comment.trim() || null },
        existing,
      );
      void notify('success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your rating. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close rating" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }],
            },
          ]}
          testID="rating-sheet"
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.flex1}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                {existing ? 'Edit your rating' : `Rate ${name}`}
              </Text>
              <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>
                {existing ? 'Change any score or your comment.' : 'Your rating helps other clients choose well.'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: 6 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.overall, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <StarRow value={average} size={38} onChange={setAll} label="Overall" testID="rating-overall" />
              <Text style={[styles.overallLabel, { color: average ? colors.foreground : colors.mutedForeground }]}>
                {average ? `${average.toFixed(1)} · ${SCORE_LABEL[Math.round(average)]}` : SCORE_LABEL[0]}
              </Text>
            </View>

            {items.length === 0 ? (
              <Text style={[styles.sheetHint, { color: colors.mutedForeground, marginVertical: 12 }]}>
                Rating isn't available right now. Try again later.
              </Text>
            ) : (
              items.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.itemRow, index < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <StarRow
                    value={scores[item.id] ?? 0}
                    size={22}
                    label={item.name}
                    onChange={(score) => {
                      setScores((current) => ({ ...current, [item.id]: score }));
                      setError(null);
                    }}
                  />
                </View>
              ))
            )}

            <TextInput
              value={comment}
              onChangeText={setComment}
              maxLength={COMMENT_MAX}
              multiline
              placeholder="Add a comment (optional)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.comment, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              testID="rating-comment-input"
            />
          </ScrollView>

          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <Button
            label={existing ? 'Save changes' : 'Submit rating'}
            onPress={() => void submit()}
            loading={busy}
            disabled={busy || items.length === 0}
            testID="rating-submit-button"
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  bar: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  barTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  barHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  barStars: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  barScore: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, height: 36 },
  editLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sheetHint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 3 },
  sheetBody: { flexGrow: 0 },
  overall: { alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingVertical: 16, marginBottom: 8 },
  overallLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  itemName: { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },
  comment: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : {}),
  },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, marginBottom: 8, textAlign: 'center' },
});
