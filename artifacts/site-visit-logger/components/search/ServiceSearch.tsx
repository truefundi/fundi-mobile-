import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import type { CatalogGroup } from '@/lib/categories-api';
import { vibrate } from '@/lib/haptics';
import { DEFAULT_FILTERS, FEE_OPTIONS, SORT_OPTIONS, type ServiceFilters } from '@/lib/service-search';

const NATIVE = Platform.OS !== 'web';

/** Keyword box with a clear button and a filter button that shows how many filters are on. */
export function ServiceSearchBar({
  value,
  onChange,
  filterCount,
  onOpenFilters,
  placeholder = 'Search a service, e.g. leak, wiring',
  testID = 'service-search',
  onFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  filterCount: number;
  onOpenFilters: () => void;
  placeholder?: string;
  testID?: string;
  onFocus?: () => void;
}) {
  const colors = useColors();
  const active = value.trim().length > 0;
  return (
    <View style={[styles.bar, { backgroundColor: colors.card, borderColor: active ? colors.primary : colors.border }]}>
      <Feather name="search" size={19} color={active ? colors.primary : colors.mutedForeground} />
      <TextInput
        accessibilityLabel="Search services"
        testID={`${testID}-input`}
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        style={[styles.input, { color: colors.foreground }]}
      />
      {active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          testID={`${testID}-clear`}
          onPress={() => onChange('')}
          hitSlop={8}
          style={styles.clear}
        >
          <Feather name="x-circle" size={18} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filterCount ? `Filters, ${filterCount} on` : 'Filters'}
        testID={`${testID}-filters`}
        onPress={onOpenFilters}
        style={({ pressed }) => [
          styles.filterBtn,
          { backgroundColor: filterCount ? colors.primary : colors.secondary, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="sliders" size={16} color={filterCount ? colors.primaryForeground : colors.primary} />
        {filterCount ? (
          <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{filterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  onRemove,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={onRemove ? `Remove ${label}` : label}
      testID={testID}
      onPress={onRemove ?? onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected || onRemove ? colors.primary + '1A' : colors.card,
          borderColor: selected || onRemove ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected || onRemove ? colors.primary : colors.foreground }]} numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? <Feather name="x" size={13} color={colors.primary} /> : null}
    </Pressable>
  );
}

/** The filters that are on, each removable with a tap, plus "Clear all". */
export function ActiveFilterChips({
  filters,
  groups,
  onChange,
}: {
  filters: ServiceFilters;
  groups: CatalogGroup[];
  onChange: (next: ServiceFilters) => void;
}) {
  const colors = useColors();
  const chips: { key: string; label: string; next: ServiceFilters }[] = [];
  for (const id of filters.groupIds) {
    chips.push({
      key: `g-${id}`,
      label: groups.find((group) => group.id === id)?.name ?? 'Group',
      next: { ...filters, groupIds: filters.groupIds.filter((other) => other !== id) },
    });
  }
  if (filters.maxFee !== null) {
    chips.push({
      key: 'fee',
      label: FEE_OPTIONS.find((option) => option.value === filters.maxFee)?.label ?? 'Fee',
      next: { ...filters, maxFee: null },
    });
  }
  if (filters.sort !== 'relevance') {
    chips.push({
      key: 'sort',
      label: SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? 'Sort',
      next: { ...filters, sort: 'relevance' },
    });
  }
  if (chips.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroll}>
      {chips.map((chip) => (
        <Chip key={chip.key} label={chip.label} onRemove={() => onChange(chip.next)} testID={`active-filter-${chip.key}`} />
      ))}
      <Pressable onPress={() => onChange(DEFAULT_FILTERS)} hitSlop={6} style={styles.clearAll} testID="active-filter-clear">
        <Text style={[styles.clearAllText, { color: colors.mutedForeground }]}>Clear all</Text>
      </Pressable>
    </ScrollView>
  );
}

/** One-tap keyword searches drawn from the catalog. */
export function KeywordSuggestions({ words, onPick }: { words: string[]; onPick: (word: string) => void }) {
  const colors = useColors();
  if (words.length === 0) return null;
  return (
    <View style={styles.suggestBlock}>
      <Text style={[styles.suggestTitle, { color: colors.mutedForeground }]}>Try searching</Text>
      <View style={styles.wrapRow}>
        {words.map((word) => (
          <Chip key={word} label={word} onPress={() => onPick(word)} testID={`keyword-${word}`} />
        ))}
      </View>
    </View>
  );
}

/** Bottom sheet for service group, booking fee and sort. Nothing applies until "Show". */
export function ServiceFilterSheet({
  visible,
  filters,
  groups,
  countFor,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: ServiceFilters;
  groups: CatalogGroup[];
  countFor: (filters: ServiceFilters) => number;
  onApply: (filters: ServiceFilters) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setMounted(true);
      Animated.spring(progress, { toValue: 1, friction: 9, tension: 70, useNativeDriver: NATIVE }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(() =>
        setMounted(false),
      );
    }
    // Only open/close drives this; the draft is reset from the latest filters on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const toggleGroup = (id: string) => {
    void vibrate();
    setDraft((current) => ({
      ...current,
      groupIds: current.groupIds.includes(id) ? current.groupIds.filter((other) => other !== id) : [...current.groupIds, id],
    }));
  };
  const count = countFor(draft);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close filters" />
      </Animated.View>
      <Animated.View
        testID="service-filter-sheet"
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [480, 0] }) }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Filters</Text>
          <Pressable onPress={() => setDraft(DEFAULT_FILTERS)} hitSlop={8} testID="filters-reset">
            <Text style={[styles.reset, { color: colors.primary }]}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {groups.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Service group</Text>
              <View style={styles.wrapRow}>
                <Chip
                  label="All"
                  selected={draft.groupIds.length === 0}
                  onPress={() => setDraft((current) => ({ ...current, groupIds: [] }))}
                  testID="filter-group-all"
                />
                {groups.map((group) => (
                  <Chip
                    key={group.id}
                    label={group.name}
                    selected={draft.groupIds.includes(group.id)}
                    onPress={() => toggleGroup(group.id)}
                    testID={`filter-group-${group.id}`}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Booking fee</Text>
          <View style={styles.wrapRow}>
            {FEE_OPTIONS.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={draft.maxFee === option.value}
                onPress={() => setDraft((current) => ({ ...current, maxFee: option.value }))}
                testID={`filter-fee-${option.value ?? 'any'}`}
              />
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Sort by</Text>
          <View style={styles.wrapRow}>
            {SORT_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={draft.sort === option.value}
                onPress={() => setDraft((current) => ({ ...current, sort: option.value }))}
                testID={`filter-sort-${option.value}`}
              />
            ))}
          </View>
        </ScrollView>

        <Button
          label={count === 0 ? 'No services match' : `Show ${count} service${count === 1 ? '' : 's'}`}
          disabled={count === 0}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          testID="filters-apply"
          style={styles.apply}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    minHeight: 48,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  clear: { padding: 4 },
  filterBtn: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  chipScroll: { marginTop: 10, flexGrow: 0 },
  chipRow: { gap: 8, alignItems: 'center', paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, height: 34 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, maxWidth: 180 },
  clearAll: { paddingHorizontal: 6, height: 34, justifyContent: 'center' },
  clearAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textDecorationLine: 'underline' },
  suggestBlock: { marginTop: 12 },
  suggestTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8, letterSpacing: 0.2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  reset: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  sheetBody: { flexGrow: 0 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 18, marginBottom: 10 },
  apply: { marginTop: 20 },
});
