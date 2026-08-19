import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/app-header/AppHeader';
import ButtonRevamp from '../components/button-revamp/ButtonRevamp';
import { Colors } from '../constants/colors';
import { FontSizes } from '../constants/fontSizes';
import { FontsByLanguage } from '../src/theme/fonts';
import { loadFonts } from '../src/config/fonts';
import i18n from '../i18n';
import { getCurrentLanguage, submitLanguage } from '../service/languageService';
import { useIsDesktopWeb } from '../hooks/useIsDesktopWeb';
import LanguageSelectionDesktopLayout from './LanguageSelectionDesktopLayout';
import { getItem } from '../service/storageService';
import { StorageKeys } from '../constants/storage.keys';
import { openMembershipTab } from '../service/paymentService';
import type { FooterTab } from '../components/app-footer/AppFooter';

// Language order matches Figma design (en.json node-id 11851:6689)
const LANGUAGES = [
  { id: 'en', native: 'English',   english: 'English'   },
  { id: 'tm', native: 'தமிழ்',     english: 'Tamil'     },
  { id: 'tl', native: 'తెలుగు',    english: 'Telugu'    },
  { id: 'hi', native: 'हिंदी',      english: 'Hindi'     },
  { id: 'ml', native: 'മലയാളം',    english: 'Malayalam' },
  { id: 'kn', native: 'ಕನ್ನಡ',     english: 'Kannada'   },
  { id: 'bn', native: 'বাংলা',      english: 'Bengali'   },
  { id: 'mt', native: 'मराठी',      english: 'Marathi'   },
  { id: 'or', native: 'ଓଡ଼ିଆ',     english: 'Odia'      },
  { id: 'gj', native: 'ગુજરાતી',   english: 'Gujarati'  },
  { id: 'pa', native: 'ਪੰਜਾਬੀ',    english: 'Punjabi'   },
] as const;

type LangId = (typeof LANGUAGES)[number]['id'];

type Props = { onSelect: (langId: string) => void; navigation?: any; presentedAsModal?: boolean };

export default function LanguageSelectionScreen({ onSelect, navigation, presentedAsModal = false }: Props) {
  const [selected, setSelected]   = useState<LangId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isDesktop = useIsDesktopWeb();
  const [userName, setUserName] = useState('');
  const [scriptFontsReady, setScriptFontsReady] = useState(false);

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''));
  }, []);

  // This screen shows every language's native name at once (unlike the rest of
  // the app, which only ever needs the current language's font), so every
  // Noto Sans script font must be preloaded here.
  useEffect(() => {
    Promise.all(LANGUAGES.map(lang => loadFonts(lang.id))).then(() => setScriptFontsReady(true));
  }, []);

  const handleNext = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    const current = await getCurrentLanguage();
    await Promise.all([
      i18n.changeLanguage(selected),
      submitLanguage(current, selected),
    ]);
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      onSelect(selected);
    }
  };

  function handleTabPress(tab: FooterTab) {
    if (!navigation) return;
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  if (isDesktop) {
    return (
      <LanguageSelectionDesktopLayout
        navigation={navigation}
        userName={userName}
        selected={selected}
        submitting={submitting}
        onSelect={setSelected}
        onNext={handleNext}
        onTabPress={handleTabPress}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* First-run onboarding has nothing to go back to and no reason to show
          the (redundant) change-language header — only render it for the
          mid-app modal switch, where the close icon is the only way to dismiss. */}
      {presentedAsModal && (
        <AppHeader
          type="registration"
          showBackBtn={navigation?.canGoBack() ?? false}
          closeIcon
          onBackPress={() => navigation?.goBack()}
        />
      )}

      {/* Scrollable area: title + 2-col language grid */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          // Header (when shown) already handles the top inset via its own
          // SafeAreaView — only add it here for the header-less onboarding case.
          { paddingTop: (presentedAsModal ? 0 : insets.top) + 20 },
          { paddingBottom: FOOTER_H + insets.bottom + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('LOGIN_PAGE.SELECT_LANG')}</Text>

        <View style={styles.grid}>
          {LANGUAGES.map(lang => {
            const isSelected = selected === lang.id;
            return (
              <Pressable
                key={lang.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(lang.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${lang.native} ${lang.english}`}
              >
                <View style={styles.cardText}>
                  <Text
                    style={[
                      styles.nativeName,
                      scriptFontsReady && { fontFamily: FontsByLanguage[lang.id]?.semiBold },
                    ]}
                    numberOfLines={1}
                  >
                    {lang.native}
                  </Text>
                  <Text style={styles.englishName} numberOfLines={1}>{lang.english}</Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky footer CTA — Primary CTA (Figma node 561:518 → ButtonRevamp) */}
      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        <ButtonRevamp
          label={t('LOGIN_PAGE.NEXT', 'Next')}
          variant="primary"
          size="standard"
          fullWidth
          disabled={!selected}
          loading={submitting}
          onPress={handleNext}
        />
      </View>
    </View>
  );
}

// ─── Design tokens (from Figma node 11851:6689) ───────────────────────────────

const GRID_H_PAD = 24;   // horizontal padding matching Figma left:24px
const GRID_GAP   = 16;   // gap between cards
const CARD_W     = 148;  // fixed card width (2 cards + gap = 312px content area)
const CARD_H     = 64;   // fixed card height
const FOOTER_H   = 84;   // footer container height

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },

  // Scrollable content (paddingTop set inline — depends on safe-area insets)
  scrollContent: {
    paddingHorizontal: GRID_H_PAD,
  },
  title: {
    fontFamily:   FontsByLanguage.en.semiBold,
    fontSize:     FontSizes.font22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    marginBottom: 37,
  },

  // 2-column grid using flexWrap (avoids FlatList numColumns quirks)
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           GRID_GAP,
  },

  // Language card
  card: {
    width:           CARD_W,
    height:          CARD_H,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    backgroundColor: Colors.surface,
    flexDirection:   'row',
    alignItems:      'center',
    paddingLeft:     16,
    paddingRight:    16,
  },
  cardSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.selectionBg,
  },
  cardText: {
    flex: 1,
    gap:  8,
  },
  nativeName: {
    fontFamily: FontsByLanguage.en.semiBold,
    fontSize:   FontSizes.font16,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  englishName: {
    fontFamily: FontsByLanguage.en.regular,
    fontSize:   FontSizes.font12,
    color:      Colors.textSecondary,
  },

  // Radio indicator (Figma: 24×24, Radio Button node 824:2040)
  radio: {
    width:           24,
    height:          24,
    borderRadius:    12,
    borderWidth:     2,
    borderColor:     Colors.borderNeutral,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  radioSelected: {
    borderColor: Colors.primaryDark,
  },
  radioDot: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: Colors.primaryDark,
  },

  // Sticky footer
  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: GRID_H_PAD,
    paddingTop:        20,
    backgroundColor:   Colors.surface,
  },
});
