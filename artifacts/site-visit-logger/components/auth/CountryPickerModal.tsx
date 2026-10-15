import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SUPPORTED_COUNTRIES, type Country } from '@/constants/countries';
import { useColors } from '@/hooks/useColors';

type CountryPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
  selectedCountry: Country;
};

export function CountryPickerModal({ visible, onClose, onSelect, selectedCountry }: CountryPickerModalProps) {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = SUPPORTED_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery)
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Select Country</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <TextInput
            placeholder="Search country or code (+250)"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
          />

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const isSelected = item.code === selectedCountry.code;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[
                    styles.countryItem,
                    { backgroundColor: isSelected ? colors.primary + '15' : 'transparent', borderColor: colors.border },
                  ]}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.countryName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.dialCode, { color: colors.mutedForeground }]}>{item.dialCode}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', ...(Platform.OS === 'web' ? { alignItems: 'center', justifyContent: 'center' } : {}) },
  container: { width: '100%', maxWidth: 450, height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, ...(Platform.OS === 'web' ? { borderRadius: 20 } : {}) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  closeBtn: { padding: 4 },
  searchInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  listContainer: { gap: 6 },
  countryItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
  flag: { fontSize: 22, marginRight: 12 },
  countryName: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14 },
  dialCode: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});