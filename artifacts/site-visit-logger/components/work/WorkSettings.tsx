import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HOURS, MAX_JOBS_OPTIONS, RADIUS_OPTIONS, TRADES, type HoursWindow, type Trade } from '@/constants/work';
import { useWork } from '@/context/WorkContext';
import { useColors } from '@/hooks/useColors';

function Chip({
  label,
  detail,
  selected,
  tag,
  onPress,
  testID,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  tag?: string;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
      {detail ? (
        <Text style={[styles.chipDetail, { color: selected ? colors.secondary : colors.mutedForeground }]}>{detail}</Text>
      ) : null}
      {tag ? (
        <View style={[styles.chipTag, { backgroundColor: selected ? colors.primaryForeground : colors.muted }]}>
          <Text style={[styles.chipTagText, { color: selected ? colors.primary : colors.mutedForeground }]}>{tag}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * What a technician controls about the work they are sent: which job types,
 * how far, how many a day, and when. The verified trade is always on — it is
 * the one they are actually allowed to be matched for.
 */
export function WorkSettings() {
  const colors = useColors();
  const { settings, updateSettings, profile, isAvailable } = useWork();
  const verifiedTrade = profile?.trade;

  const toggleTrade = (trade: Trade) => {
    // The verified trade cannot be switched off; nothing else could be matched.
    if (trade === verifiedTrade) return;
    const on = settings.trades.includes(trade);
    updateSettings({ trades: on ? settings.trades.filter((item) => item !== trade) : [...settings.trades, trade] });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.status, { backgroundColor: isAvailable ? colors.successMuted : colors.muted }]}>
        <Feather name={isAvailable ? 'radio' : 'moon'} size={16} color={isAvailable ? colors.success : colors.mutedForeground} />
        <Text style={[styles.statusText, { color: colors.foreground }]}>
          {isAvailable ? 'You are live — jobs can reach you.' : 'You are offline — no jobs will be sent.'}
        </Text>
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Job types</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Only trades you have a certificate for can be matched. Others need a certificate first.
      </Text>
      <View style={styles.row}>
        {TRADES.map((trade) => (
          <Chip
            key={trade}
            label={trade}
            selected={settings.trades.includes(trade)}
            tag={trade === verifiedTrade ? 'Verified' : undefined}
            onPress={() => toggleTrade(trade)}
            testID={`work-trade-${trade}`}
          />
        ))}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>How far you travel</Text>
      <View style={styles.row}>
        {RADIUS_OPTIONS.map((km) => (
          <Chip
            key={km}
            label={`${km} km`}
            selected={settings.radiusKm === km}
            onPress={() => updateSettings({ radiusKm: km })}
            testID={`work-radius-${km}`}
          />
        ))}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Jobs per day</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Fundi stops sending you jobs once you reach this.
      </Text>
      <View style={styles.row}>
        {MAX_JOBS_OPTIONS.map((count) => (
          <Chip
            key={count}
            label={String(count)}
            selected={settings.maxJobsPerDay === count}
            onPress={() => updateSettings({ maxJobsPerDay: count })}
            testID={`work-maxjobs-${count}`}
          />
        ))}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>When you work</Text>
      <View style={styles.row}>
        {(Object.keys(HOURS) as HoursWindow[]).map((window) => (
          <Chip
            key={window}
            label={HOURS[window].label}
            detail={HOURS[window].detail}
            selected={settings.hours === window}
            onPress={() => updateSettings({ hours: window })}
            testID={`work-hours-${window}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, padding: 16 },
  statusText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25, marginTop: 22 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  chip: { minHeight: 40, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14 },
  chipLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  chipDetail: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  chipTag: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  chipTagText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.4 },
});
