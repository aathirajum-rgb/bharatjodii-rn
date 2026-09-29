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
import { handleFooterTabPress } from '../utils/footerTabPress';
import { handleBack } from '../utils/navigationRef';
import { getRegistrationArrays } from '../service/registrationService';
import type { FooterTab } from '../components/app-footer/AppFooter';

type LangOption = { id: string; native: string; english: string };

// Angular (language-selection.component.ts's ngOnInit): languageArray starts
// as this SAME static list (core/config/common.config.ts's languageArray),
// then getDynamicPopulateArrayList() (the shared type=all/LANG=<lang>
// initialfetch bootstrap — same call/cache as getRegistrationArrays() here)
// overwrites it with hasArrayData?.LANGSELECTION if the API provides one —
// so the actual on-screen order is server-driven, not fixed. This fallback
// order matches that static config exactly (English, Tamil, Telugu,
// Malayalam, Kannada, Marathi, Odia, Gujarati, Bengali, Hindi, Punjabi), used
// only if LANGSELECTION is absent/empty from the API response.
const FALLBACK_LANGUAGES: LangOption[] = [
  { id: 'en', native: 'English',   english: 'English'   },
  { id: 'tm', native: 'தமிழ்',     english: 'Tamil'     },
  { id: 'tl', native: 'తెలుగు',    english: 'Telugu'    },
  { id: 'ml', native: 'മലയാളം',    english: 'Malayalam' },
  { id: 'kn', native: 'ಕನ್ನಡ',     english: 'Kannada'   },
  { id: 'mt', native: 'मराठी',      english: 'Marathi'   },
  { id: 'or', native: 'ଓଡ଼ିଆ',     english: 'Odia'      },
  { id: 'gj', native: 'ગુજરાતી',   english: 'Gujarati'  },
  { id: 'bn', native: 'বাংলা',      english: 'Bengali'   },
  { id: 'hi', native: 'हिंदी',      english: 'Hindi'     },
  { id: 'pa', native: 'ਪੰਜਾਬੀ',    english: 'Punjabi'   },
];

// Angular's own ultra-fallback (ngOnInit, when languageArray.length == 0
// even after the API call) — just English + Tamil.
const EMPTY_FALLBACK_LANGUAGES: LangOption[] = [
  { id: 'en', native: 'English', english: 'English' },
  { id: 'tm', native: 'தமிழ்',   english: 'Tamil'   },
];

type LangId = string;

type Props = { onSelect: (langId: string) => void; navigation?: any; presentedAsModal?: boolean };

export default function LanguageSelectionScreen({ onSelect, navigation, presentedAsModal = false }: Props) {
  const [selected, setSelected]   = useState<LangId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isDesktop = useIsDesktopWeb();
  const [userName, setUserName] = useState('');
  const [scriptFontsReady, setScriptFontsReady] = useState(false);
  const [languages, setLanguages] = useState<LangOption[]>(FALLBACK_LANGUAGES);

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''));
  }, []);

  // Angular (ngOnInit):
  //   this.language = this.data?.language ? this.data.language : localStorage.getItem('LANG');
  //   if (this.language) { this.selectLang(this.language); }
  // i.e. the screen opens with the member's CURRENT language already checked.
  // This port left `selected` as null, so no radio was ever checked on entry
  // and the Select CTA started disabled — the user had to re-pick the language
  // they were already using.
  //
  // Functional update rather than a plain set: storage is async, and a tap that
  // lands before it resolves must not be clobbered by the stored value.
  useEffect(() => {
    getCurrentLanguage().then(lang => {
      if (lang) setSelected(prev => prev ?? lang);
    });
  }, []);

  // Angular: languageArray starts as the static config list, then
  // getDynamicPopulateArrayList() overwrites it with LANGSELECTION from the
  // shared type=all bootstrap response if present — mirrored here the same
  // way. getRegistrationArrays() has no auth/user-ID dependency (just LANG +
  // country code), so it's safe to call from this pre-login, first-run screen.
  useEffect(() => {
    getRegistrationArrays()
      .then(data => {
        const raw = data?.LANGSELECTION;
        if (!Array.isArray(raw) || raw.length === 0) return;
        const mapped: LangOption[] = raw
          .map((item: any) => ({
            id:      String(item.ID ?? item.id ?? ''),
            native:  String(item.TITLE ?? item.title ?? ''),
            english: String(item.TEXT ?? item.text ?? ''),
          }))
          .filter(l => l.id && l.native && l.english);
        setLanguages(mapped.length ? mapped : EMPTY_FALLBACK_LANGUAGES);
      })
      .catch(() => {
        // Network/parse failure — keep the static FALLBACK_LANGUAGES already
        // set as initial state, same as Angular keeping CONFIG.languageArray
        // when the API call never resolves.
      });
  }, []);

  // This screen shows every language's native name at once (unlike the rest of
  // the app, which only ever needs the current language's font), so every
  // Noto Sans script font must be preloaded here. Re-runs if `languages`
  // changes (API response arriving after the static fallback's initial paint)
  // so a server-driven list's scripts still get preloaded.
  useEffect(() => {
    Promise.all(languages.map(lang => loadFonts(lang.id))).then(() => setScriptFontsReady(true));
  }, [languages]);

  const handleNext = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    const current = await getCurrentLanguage();
    // Order matters: submitLanguage() writes SK.Auth.LANG and clears the
    // language-scoped REGISTRATIONARRAYS/DOMAINLANG caches. i18n.changeLanguage()
    // must run AFTER that, because its 'languageChanged' event is what makes
    // screens re-fetch their server-translated option lists (useLanguageReload).
    // Running both in parallel raced: a listener could re-fetch and re-cache
    // using the OLD language before the new one was persisted.
    await submitLanguage(current, selected);
    await i18n.changeLanguage(selected);
    if (navigation?.canGoBack()) {
      handleBack();
    } else {
      onSelect(selected);
    }
  };

  function handleTabPress(tab: FooterTab) {
    if (!navigation) return
    handleFooterTabPress(navigation, tab)
  }

  if (isDesktop) {
    return (
      <LanguageSelectionDesktopLayout
        navigation={navigation}
        userName={userName}
        languages={languages}
        selected={selected}
        submitting={submitting}
        onSelect={setSelected}
        onNext={handleNext}
        onTabPress={handleTabPress}
        presentedAsModal={presentedAsModal}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* First-run onboarding has nothing to go back to and no reason to show
          the (redundant) change-language header — only render it for the
          mid-app modal switch. Slides in right-to-left like a regular pushed
          screen (not a bottom sheet), so it dismisses via the standard
          back chevron/gesture, not a close icon. */}
      {presentedAsModal && (
        <AppHeader
          type="registration"
          // No back arrow while switching the app language — the member
          // leaves this screen by picking a language (Next).
          showBackBtn={false}
        />
      )}

      {/* Scrollable area: title + 2-col language grid */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          // Header (when shown) already handles the top inset via its own
          // SafeAreaView — only add it here for the header-less onboarding case.
          // Angular's ion-content has no extra top margin/padding beyond the
          // safe area on this page (language-selection.component.html's title
          // row is just pl-24/pr-24, no top spacing class) — so no extra +20
          // here either, just the raw safe-area inset.
          { paddingTop: presentedAsModal ? 0 : insets.top },
          { paddingBottom: FOOTER_H + insets.bottom + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('LOGIN_PAGE.SELECT_LANG')}</Text>

        <View style={styles.grid}>
          {languages.map(lang => {
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
                  {/* Rendered invisible (rather than in the default system
                      font) until scriptFontsReady — otherwise this briefly
                      paints in the wrong font, then visibly swaps to the
                      correct Noto Sans script font a moment after mount. */}
                  <Text
                    style={[
                      styles.nativeName,
                      scriptFontsReady
                        ? { fontFamily: FontsByLanguage[lang.id]?.semiBold }
                        : styles.nativeNameHidden,
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
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Angular: language-selection.component.html's button uses
            REGISTRATION.SELECT ("Select"), not a "Next" label. */}
        <ButtonRevamp
          label={t('REGISTRATION.SELECT', 'Select')}
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
    paddingTop: 50,
  },

  // 2-column grid using flexWrap (avoids FlatList numColumns quirks)
  grid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           GRID_GAP,
  },

  // Language card — Angular: ion-col size="6" (a true 50%-of-row column, so
  // its cards always fill the full row width on any viewport). A fixed
  // CARD_W here left visible empty space on the right on anything wider than
  // exactly 360px; '48%' + the row's 16px gap fills the row responsively
  // the same way, instead of pinning to one fixed pixel width from Figma.
  card: {
    width:           '47%',
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
  // Angular: no explicit gap between the native-name <h2> and English <p> —
  // just tight default text-block spacing. gap:8 read as noticeably looser;
  // 4 matches the tight native/English pairing used elsewhere in this app.
  cardText: {
    flex: 1,
    //gap:  4,
  },
  nativeName: {
    fontFamily: FontsByLanguage.en.semiBold,
    fontSize:   FontSizes.font18,

    color:      Colors.textPrimary,
  },
  // Keeps the card's layout/height stable while the native-script text is
  // hidden pre-scriptFontsReady (see the `nativeName` Text above) instead of
  // conditionally omitting the text node, which would shift the English name
  // and radio button during the brief loading window.
  nativeNameHidden: {
    opacity: 0,
  },
  englishName: {
    fontFamily: FontsByLanguage.en.regular,
    fontSize:   FontSizes.font12,
    color:      Colors.textPrimary,
    
  },

  // Radio indicator (Figma: 24×24, Radio Button node 824:2040)
  radio: {
    width:           16,
    height:          16,
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
    width:           8,
    height:          8,
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
