// Desktop top nav bar (Figma "Jodii Desktop - Registration", node 1034:6716,
// "Top Nav") — replaces the mobile bottom AppFooter tab bar for wide browser
// windows. Reuses the exact same FooterTab navigation targets as AppFooter so
// MatchesScreen's existing handleTabPress works unchanged for both layouts.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CDN_REACT } from '../../constants/cdn'
import { TAB_LABEL_KEYS, type FooterTab } from '../app-footer/AppFooter'
import { LANG_LABELS } from './MatchesHeader'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// Tab 4 = "Contacted profiles" (MessagerListScreen) — see AppFooter.tsx's
// FooterTab comment. This matches Figma's top nav: Home / Matches / Liked
// profiles / Contacted profiles (no Search link).
const NAV_TABS: FooterTab[] = [0, 1, 2, 4]

// Figma: each nav item gets its own dedicated icon (not the mobile bottom-nav
// [inactive, active] pair set) — a single glyph whose color follows the
// active/inactive text color instead of swapping images. Previously bundled
// locally (assets/desktop-home/) — moved to the CDN (same assets/images/react/
// folder every other app-authored icon already lives in) to keep them out of
// the app bundle.
const NAV_ICONS: Record<FooterTab, string> = {
  0: CDN_REACT + '/nav-home-icon.svg',
  1: CDN_REACT + '/nav-matches-icon.svg',
  2: CDN_REACT + '/nav-liked-profiles-icon.svg',
  4: CDN_REACT + '/nav-contacted-profiles-call-icon.svg',
  3: CDN_REACT + '/nav-upgrade-crown-icon.svg',
}

const LOGO_WORDMARK = CDN_REACT + '/jodii-logo-wordmark.svg'
const LOGO_SPARK_1  = CDN_REACT + '/jodii-logo-spark-1.svg'
const LOGO_SPARK_2  = CDN_REACT + '/jodii-logo-spark-2.svg'
const GLOBE_ICON     = CDN_REACT + '/nav-language-globe-icon.svg'
const CHEVRON_DOWN   = CDN_REACT + '/chevron-down-icon.svg'

type Props = {
  activeTab:        FooterTab
  langCode:         string
  upgradeTag?:      string
  onTabPress:       (tab: FooterTab) => void
  onLanguagePress?: (() => void) | undefined
}

export default function MatchesDesktopNav({
  activeTab, langCode, upgradeTag = '₹200 OFF', onTabPress, onLanguagePress,
}: Props) {
  const langLabel = LANG_LABELS[langCode] ?? 'English'
  const { t } = useTranslation()

  return (
    <View style={s.bar}>
      <View style={s.logoWrap}>
        <CdnSvg uri={LOGO_WORDMARK} width={77} height={40} />
        <View style={s.logoSpark1}><CdnSvg uri={LOGO_SPARK_1} width={13} height={12} /></View>
        <View style={s.logoSpark2}><CdnSvg uri={LOGO_SPARK_2} width={9} height={7} /></View>
      </View>

      <View style={s.links}>
        {NAV_TABS.map(tab => {
          const isActive = activeTab === tab
          return (
            <Pressable key={tab} style={s.link} onPress={() => onTabPress(tab)}>
              <CdnSvg uri={NAV_ICONS[tab]} width={24} height={24} />
              <Text style={[s.linkText, isActive && s.linkTextActive]}>{t(TAB_LABEL_KEYS[tab])}</Text>
            </Pressable>
          )
        })}

        <Pressable style={s.link} onPress={() => onTabPress(3)}>
          <CdnSvg uri={NAV_ICONS[3]} width={16} height={12} />
          <Text style={s.linkText}>Upgrade</Text>
          <View style={s.upgradeBadge}>
            <Text style={s.upgradeBadgeText}>{upgradeTag}</Text>
          </View>
        </Pressable>
      </View>

      <Pressable style={s.langBtn} onPress={onLanguagePress}>
        <CdnSvg uri={GLOBE_ICON} width={16} height={16} />
        <Text style={s.langText}>{langLabel}</Text>
        <CdnSvg uri={CHEVRON_DOWN} width={16} height={16} />
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 124,
    paddingVertical:   16,
    backgroundColor:   Colors.white,
    shadowColor:       '#000000',
    shadowOpacity:     0.08,
    shadowRadius:      8,
    shadowOffset:      { width: 0, height: 3 },
    elevation:         3,
  },
  logoWrap: {
    width:  77,
    height: 40,
  },
  logoSpark1: { position: 'absolute', top: -4, right: -4 },
  logoSpark2: { position: 'absolute', bottom: 2, right: -6 },

  links: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           28,
  },
  link: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  linkText: {
    // This desktop top nav replaces the mobile bottom AppFooter tab bar (see
    // file header comment) — bottomnav is the matching semantic role even
    // though it renders at the top here.
    fontFamily: SemanticFontsEnglish.bottomnavEnglishRegular,
    fontSize:   12,
    lineHeight: 12,
    color:      '#545454',
  },
  linkTextActive: {
    fontFamily: Fonts.poppinsMedium,
    color:      Colors.primaryDark,
  },

  upgradeBadge: {
    borderRadius:      1,
    paddingHorizontal: 4,
    height:            10,
    justifyContent:    'center',
    // Figma: linear-gradient left→right #33258c → #751246 — RN's plain View
    // has no gradient prop, so approximate with the gradient's midpoint solid
    // color rather than pulling in LinearGradient for one 48×10px badge.
    backgroundColor:   '#54276e',
  },
  upgradeBadgeText: {
    // Figma specifies Roboto for this glyph, but only Poppins is loaded as a
    // font family anywhere in this app (App.tsx's useFonts call) — Poppins
    // SemiBold at this tiny size reads near-identically and avoids silently
    // falling back to the OS default system font.
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   10,
    lineHeight: 10,
    color:      Colors.white,
  },

  langBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 8,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       Colors.borderNeutral,
    borderRadius:      8,
  },
  langText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   12,
    color:      Colors.black,
  },
})
