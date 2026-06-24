import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Angular Ionic PWA uses a centered column max ~480px on wide screens
const MAX_WIDTH = 480;

const LANGUAGES = [
  { id: 'tm', native: 'தமிழ்', english: 'Tamil' },
  { id: 'en', native: 'English', english: 'English' },
  { id: 'tl', native: 'తెలుగు', english: 'Telugu' },
  { id: 'ml', native: 'മലയാളം', english: 'Malayalam' },
  { id: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { id: 'mt', native: 'मराठी', english: 'Marathi' },
  { id: 'or', native: 'ଓଡ଼ିଆ', english: 'Odia' },
  { id: 'gj', native: 'ગુજરાતી', english: 'Gujarati' },
  { id: 'bn', native: 'বাংলা', english: 'Bengali' },
  { id: 'hi', native: 'हिंदी', english: 'Hindi' },
  { id: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
];

type Language = (typeof LANGUAGES)[number];

type Props = {
  onSelect: (langId: string) => void;
};

export default function LanguageSelectionScreen({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const renderItem = ({ item }: { item: Language }) => {
    const isSelected = selected === item.id;
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => setSelected(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <Text style={styles.nativeName}>{item.native}</Text>
          <Text style={styles.englishName}>{item.english}</Text>
        </View>
        <View style={[styles.radio, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  const footerHeight = 80 + (Platform.OS === 'ios' ? insets.bottom : 16);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.inner}>
        <Text style={styles.heading}>Choose your display language</Text>
        <FlatList
          data={LANGUAGES}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.list, { paddingBottom: footerHeight + 12 }]}
          showsVerticalScrollIndicator={false}
        />
        <View style={[styles.footer, { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 16 }]}>
          <TouchableOpacity
            style={[styles.selectBtn, !selected && styles.selectBtnDisabled]}
            onPress={() => selected && onSelect(selected)}
            disabled={!selected}
            activeOpacity={0.8}
          >
            <Text style={styles.selectBtnText}>SELECT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const BRAND = '#B30033';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f1e1b',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  list: {
    paddingHorizontal: 12,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSelected: {
    borderColor: BRAND,
    backgroundColor: '#FEFAFB',
  },
  cardContent: {
    flex: 1,
  },
  nativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1e1b',
  },
  englishName: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#cccccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: BRAND,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: BRAND,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectBtn: {
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  selectBtnDisabled: {
    backgroundColor: '#cccccc',
  },
  selectBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
