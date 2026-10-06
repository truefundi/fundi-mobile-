import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { notify } from '@/lib/haptics';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Rating } from '@/constants/jobs';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { StageScreen } from '@/components/ui/StageScreen';
import { TechnicianCard } from '@/components/ui/TechnicianCard';
import { useFundi } from '@/context/FundiContext';
import { useColors } from '@/hooks/useColors';

/** Read out under the stars, so the number means something before it is sent. */
const OVERALL_LABEL = ['Tap a star to rate', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

const CATEGORIES = ['quality', 'professionalism', 'arrival', 'communication', 'value'] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  quality: 'Quality of work',
  professionalism: 'Professionalism',
  arrival: 'Arrival time',
  communication: 'Communication',
  value: 'Value for money',
};

/** Spec 19 — rate the technician once the job is settled. */
export default function RateScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, submitRating } = useFundi();
  const job = id ? getJob(id) : undefined;

  const [overall, setOverall] = useState(job?.rating?.overall ?? 0);
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const existing = job?.rating;
    const initial: Record<string, number> = {};
    if (existing) {
      initial.quality = existing.quality;
      initial.professionalism = existing.professionalism;
      initial.arrival = existing.arrival;
      initial.communication = existing.communication;
      initial.value = existing.value;
    }
    return initial;
  });
  const [comment, setComment] = useState(job?.rating?.comment ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!job) {
    return (
      <StageScreen
        title="Job not found"
        onBack={() => router.replace('/activity')}
        footer={<Button label="Back to my services" onPress={() => router.replace('/activity')} testID="rate-missing-back" />}
      >
        <EmptyState icon="star" title="This job is not available" text="It is no longer on this device, so it cannot be rated." />
      </StageScreen>
    );
  }

  const alreadyRated = !!job.rating;

  const submit = () => {
    if (overall === 0) {
      setError('Choose an overall rating before submitting.');
      return;
    }
    const rating: Rating = {
      overall,
      quality: scores.quality ?? overall,
      professionalism: scores.professionalism ?? overall,
      arrival: scores.arrival ?? overall,
      communication: scores.communication ?? overall,
      value: scores.value ?? overall,
      comment: comment.trim(),
    };
    setIsSubmitting(true);
    submitRating(job.id, rating);
    notify('success');
    router.replace(`/job/${job.id}`);
  };

  return (
    <StageScreen
      eyebrow={alreadyRated ? 'YOUR REVIEW' : 'RATE YOUR TECHNICIAN'}
      title="How was your experience?"
      subtitle={alreadyRated ? 'You can update your review at any time.' : 'Your rating helps other customers choose well.'}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/activity'))}
      footer={<Button label={alreadyRated ? 'Update review' : 'Submit review'} loading={isSubmitting} onPress={submit} testID="rating-submit-button" />}
    >
      {job.technician ? <TechnicianCard technician={job.technician} compact /> : null}

      <SectionCard title="Overall">
        <View style={styles.overallRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              accessibilityRole="button"
              accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
              testID={`rating-star-${star}`}
              onPress={() => {
                setOverall(star);
                setError('');
              }}
              style={({ pressed }) => [styles.starButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name={star <= overall ? 'star' : 'star-outline'} size={36} color={star <= overall ? colors.warning : colors.input} />
            </Pressable>
          ))}
        </View>
        <Text style={[styles.overallLabel, { color: overall > 0 ? colors.foreground : colors.mutedForeground }]}>{OVERALL_LABEL[overall]}</Text>
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      </SectionCard>

      <SectionCard title="Details">
        {CATEGORIES.map((category, index) => (
          <View
            key={category}
            style={[styles.categoryRow, index < CATEGORIES.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
          >
            <Text style={[styles.categoryLabel, { color: colors.foreground }]}>{CATEGORY_LABEL[category]}</Text>
            <View style={styles.categoryStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  accessibilityRole="button"
                  accessibilityLabel={`${CATEGORY_LABEL[category]}: ${star}`}
                  testID={`rating-${category}-${star}`}
                  onPress={() => setScores((current) => ({ ...current, [category]: star }))}
                  hitSlop={6}
                >
                  <Ionicons
                    name={star <= (scores[category] ?? 0) ? 'star' : 'star-outline'}
                    size={22}
                    color={star <= (scores[category] ?? 0) ? colors.warning : colors.input}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Comment">
        <TextInput
          accessibilityLabel="Tell us about your experience"
          testID="rating-comment-input"
          value={comment}
          onChangeText={setComment}
          placeholder="Tell us about your experience..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
        />
      </SectionCard>
    </StageScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
  overallRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  starButton: { padding: 3 },
  overallLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 8, textAlign: 'center' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 6, textAlign: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11 },
  categoryLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },
  categoryStars: { flexDirection: 'row', gap: 6 },
  input: { minHeight: 96, borderRadius: 12, borderWidth: 1, padding: 13, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
});
