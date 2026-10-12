import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { formatSchedule } from '@/constants/jobs';
import { useColors } from '@/hooks/useColors';

/** How far ahead a visit can be booked. */
const DAYS_AHEAD = 14;
/** Visit start times offered each day, 08:00 to 18:00. */
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
/** A technician needs at least this long to plan a same-day visit. */
const LEAD_MS = 60 * 60 * 1000;

type Props = {
  /** The booked time as an ISO date-time, if one is chosen. */
  value?: string;
  onChange: (iso: string | undefined) => void;
  hasError?: boolean;
  testIDPrefix?: string;
};

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

function at(day: Date, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
}

/** The hours still bookable on a day; today drops the ones less than an hour away. */
function openHours(day: Date, now: Date): number[] {
  return HOURS.filter((hour) => at(day, hour).getTime() - now.getTime() >= LEAD_MS);
}

/**
 * A day strip and the times for the chosen day — the calendar behind
 * "Schedule". Days with no time left (today, late in the day) are not offered.
 */
export function SchedulePicker({ value, onChange, hasError, testIDPrefix = '' }: Props) {
  const colors = useColors();
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const list: Date[] = [];
    for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (openHours(day, now).length > 0) list.push(day);
    }
    return list;
  }, [now]);

  const chosen = value ? new Date(value) : undefined;
  const [dayIndex, setDayIndex] = useState(() => {
    const index = chosen ? days.findIndex((day) => dayKey(day) === dayKey(chosen)) : -1;
    return index >= 0 ? index : 0;
  });
  const day = days[dayIndex] ?? days[0];
  const hours = day ? openHours(day, now) : [];

  const pickDay = (index: number) => {
    setDayIndex(index);
    // Keep the same hour on the new day when it is still open there; otherwise ask again.
    if (chosen) {
      const target = days[index];
      onChange(target && openHours(target, now).includes(chosen.getHours()) ? at(target, chosen.getHours()).toISOString() : undefined);
    }
  };

  return (
    <View style={[styles.box, { backgroundColor: colors.card, borderColor: hasError ? colors.destructive : colors.border }]}>
      <FieldLabel label="Day" required />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map((item, index) => {
          const selected = index === dayIndex;
          const isToday = dayKey(item) === dayKey(now);
          return (
            <Pressable
              key={dayKey(item)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={item.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              testID={`${testIDPrefix}schedule-day-${index}`}
              onPress={() => pickDay(index)}
              style={({ pressed }) => [
                styles.day,
                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.dayName, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>
                {isToday ? 'Today' : item.toLocaleDateString('en-GB', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNumber, { color: selected ? colors.primaryForeground : colors.foreground }]}>{item.getDate()}</Text>
              <Text style={[styles.dayMonth, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>
                {item.toLocaleDateString('en-GB', { month: 'short' })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FieldLabel label="Time" required style={styles.timeLabel} />
      <View accessibilityRole="radiogroup" style={styles.timeRow}>
        {hours.map((hour) => {
          const iso = day ? at(day, hour).toISOString() : '';
          const selected = !!chosen && !!day && dayKey(chosen) === dayKey(day) && chosen.getHours() === hour;
          return (
            <Pressable
              key={hour}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`${testIDPrefix}schedule-time-${hour}`}
              onPress={() => onChange(iso)}
              style={({ pressed }) => [
                styles.time,
                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.background, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.timeText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                {String(hour).padStart(2, '0')}:00
              </Text>
            </Pressable>
          );
        })}
      </View>

      {chosen ? (
        <View style={[styles.summary, { backgroundColor: colors.secondary }]}>
          <Feather name="calendar" size={15} color={colors.primary} />
          <Text testID={`${testIDPrefix}schedule-summary`} style={[styles.summaryText, { color: colors.secondaryForeground }]}>
            Technician visit: {formatSchedule(chosen.toISOString())}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 15, padding: 14, marginTop: 10 },
  dayRow: { gap: 8, paddingRight: 4 },
  day: { width: 58, minHeight: 72, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  dayName: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  dayNumber: { fontFamily: 'Inter_700Bold', fontSize: 19, marginTop: 2 },
  dayMonth: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 1 },
  timeLabel: { marginTop: 16 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: { minWidth: 70, minHeight: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  timeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
  summaryText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
