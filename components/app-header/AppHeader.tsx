import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import Badge from '../badge/Badge'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { getOwnGenderAvatarUrl, FEMALE_AVATAR_URL } from '../../utils/avatar'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Angular's header back-button and language-pill dropdown both use Ionic's
// bundled "chevron-back-outline" / "chevron-down-outline" icons (ion-icon
// name=...), not a CDN-hosted image — the CDN_REACT + 'arrowleft.svg' /
// 'chevronleft.svg' paths this file used before don't exist on the CDN at all
// (404 on both). Inlined verbatim as SVG XML, same convention as HeightScreen.
// tsx's CHEVRON_FORWARD_XML, mirrored/rotated for the back and down directions.
const CHEVRON_BACK_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M328 112L184 256l144 144"/></svg>`
const CHEVRON_DOWN_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M112 184l144 144 144-144"/></svg>`

// Angular: header.component.ts's langLableName — home page's header1 pill
// reads FUNC.getSelectedKeyValue(langArrayList, language, '2') (type '2' =
// TITLE, the full language name, e.g. "Hindi"), NOT the short
// REGISTRATION.SELECTED_LANGUAGE string ("Eng") that the registration/signIn
// header below still (correctly) uses. Same id→English-name list as
// LanguageSelectionScreen.tsx's FALLBACK_LANGUAGES.
const LANGUAGE_FULL_NAMES: Record<string, string> = {
  en: 'English',
  tm: 'Tamil',
  tl: 'Telugu',
  hi: 'Hindi',
  ml: 'Malayalam',
  kn: 'Kannada',
  bn: 'Bengali',
  mt: 'Marathi',
  or: 'Odia',
  gj: 'Gujarati',
  pa: 'Punjabi',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeaderType = 'header1' | 'header2' | 'registration' | 'signIn'

export interface ToolbarItem {
  toolType:          string
  toolImg:           string
  notifyCount?:      string | undefined
  showNotification?: boolean | undefined
}

export interface AppHeaderProps {
  type: HeaderType

  // ── header1 (home page) ──────────────────────────────────────────────────
  userImg?:           string  | undefined
  userName?:          string  | undefined
  // Accepted for backwards compatibility but not rendered — Angular's own
  // completion-percentage ring is commented out/disabled in its real template.
  completionPct?:     number  | undefined
  hasPaidBatch?:      boolean | undefined
  homeToolBar?:       ToolbarItem[] | undefined

  // ── header2 (title bar) ──────────────────────────────────────────────────
  title?:             string  | undefined
  showBackIcon?:      boolean | undefined   // default true for header2

  // ── registration / signIn ───────────────────────────────────────────────
  showBackBtn?:       boolean | undefined
  // Renders '×' instead of '‹' — for when this screen is presented as a modal
  // sheet (e.g. the mid-app language switcher) rather than pushed onto a stack.
  closeIcon?:         boolean | undefined
  languageLabel?:     string  | undefined   // auto-computed from REGISTRATION.SELECTED_LANGUAGE if omitted

  // ── Callbacks ────────────────────────────────────────────────────────────
  onMenuPress?:        (() => void) | undefined
  onAvatarPress?:      (() => void) | undefined
  onEditProfilePress?: (() => void) | undefined
  onToolbarItemPress?: ((toolType: string) => void) | undefined
  onBackPress?:        (() => void) | undefined
  onLanguagePress?:    (() => void) | undefined

  style?: StyleProp<ViewStyle> | undefined
}

// ─── CDN ─────────────────────────────────────────────────────────────────────

const CDN = CDN_SVG

const ICONS = {
  lang:     CDN + 'revamp/lang-change-img.svg',
  fwdLink:  CDN + 'revamp/forward-icon-link.svg',
  close:    CDN + 'revamp/close-icon.svg',
  // Angular: header.component.html's hamburger — assets/images/svg/revamp/menu-home.svg
  menuHome: CDN + 'revamp/menu-home.svg',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BadgeCount({ count }: { count: string }) {
  return (
    <View style={styles.badgeWrap}>
      <Text style={styles.badgeText} numberOfLines={1}>{count}</Text>
    </View>
  )
}

// ─── AppHeader ────────────────────────────────────────────────────────────────

export default function AppHeader({
  type,
  userImg,
  userName,
  hasPaidBatch = false,
  homeToolBar,
  title,
  showBackIcon = true,
  showBackBtn  = true,
  closeIcon    = false,
  languageLabel,
  onAvatarPress,
  onEditProfilePress,
  onToolbarItemPress,
  onBackPress,
  onLanguagePress,
  style,
}: AppHeaderProps) {
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()

  // Resolve language label — use explicit prop, else fall back per header
  // type: header1 (home/dashboard) shows the full name ("English"/"Hindi"/...)
  // like Angular's langLableName; registration/signIn keep the short label
  // from locales/*.json's REGISTRATION.SELECTED_LANGUAGE (e.g. "Eng").
  const resolvedLangLabel =
    languageLabel ??
    (type === 'header1'
      ? (LANGUAGE_FULL_NAMES[i18n.language] ?? LANGUAGE_FULL_NAMES.en)
      : t('REGISTRATION.SELECTED_LANGUAGE'))

  // Angular: header.component.ts's common.getAvatarImg() (called with no args,
  // i.e. isOppositeProfile=false) — the logged-in user's OWN avatar placeholder
  // uses their OWN gender, unlike a profile card's opposite-gender placeholder.
  const [ownAvatarFallback, setOwnAvatarFallback] = useState(FEMALE_AVATAR_URL)
  useEffect(() => {
    let cancelled = false
    getOwnGenderAvatarUrl().then(url => { if (!cancelled) setOwnAvatarFallback(url) })
    return () => { cancelled = true }
  }, [])

  // ── header1: home screen header (Figma node 15859:14389 top area) ───────────
  // Row 1 (app bar): hamburger | [flex] | language selector | toolbar icons
  // Row 2 (user bar): avatar + completion % | name | edit profile link
  // Background: light periwinkle blue #EBF0FF
  if (type === 'header1') {
    return (
      // Angular: explore.component.ts's logScrollEnd()/setHeaderColor() only
      // switch HEADERBG to the blue paidBgColor gradient once the user
      // scrolls back up past a hero banner, or on init when a hero banner is
      // active — for the common case (no hero banner, no scroll yet) the
      // header renders plain white, confirmed against a live screenshot.
      <SafeAreaView edges={['top']} style={[styles.h1Bg, style]}>

        {/* ── Row 1: App bar ── */}
        <View style={styles.h1AppBar}>
          {/* Hamburger / menu — Angular: reDirectPage('/menu'), its own
              dedicated column, not part of the homeToolBar loop below. */}
          <Pressable
            style={styles.h1IconBtn}
            onPress={() => onToolbarItemPress?.('menu')}
          >
            <CdnSvg uri={ICONS.menuHome} width={27} height={27} />
          </Pressable>

          <View style={styles.flex1} />

          {/* Language selector pill — always visible, auto-detects language */}
          {/* Angular: dropdown.component.html hides the up/down-arrow icon
              entirely when actionType === 'languageChanges' — the home
              header's language pill has no chevron, unlike the
              registration/signIn one below. */}
          <Pressable style={styles.h1LangBtn} onPress={onLanguagePress}>
            <CdnSvg uri={ICONS.lang} width={20} height={20} />
            <Text style={[styles.h1LangText, { fontFamily: langFonts.medium }]}>{resolvedLangLabel}</Text>
          </Pressable>

          {/* Angular: home.config.ts's homeToolBar — discover-matches (search)
              then notification, in that order; each icon rendered from its own
              toolImg URL (no local vector-icon special-casing). */}
          {homeToolBar?.filter(t => t.toolType !== 'menu').map(item => (
            <Pressable
              key={item.toolType}
              style={styles.h1IconBtn}
              onPress={() => onToolbarItemPress?.(item.toolType)}
            >
              <CdnSvg uri={item.toolImg} width={27} height={27} />
              {!!(item.showNotification && item.notifyCount && item.notifyCount !== '0') && (
                <BadgeCount count={item.notifyCount!} />
              )}
            </Pressable>
          ))}
        </View>

        {/* ── Row 2: User profile bar ── */}
        <View style={styles.h1UserBar}>
          {/* Angular: header.component.html's completion-percentage ring is
              commented-out/disabled in the real template (confirmed against a
              live screenshot — plain avatar, no badge) — not rendered here
              either, `completionPct` is kept in the prop interface only in
              case a future revamp re-enables it. */}
          {/* Angular: .avatar { width/height: 13.5vmin } with no border at
              all — the red ring here had no CSS basis, removed. Also:
              userImg is a real uploaded photo (JPG/PNG) when set, not
              guaranteed SVG like the fallback placeholder is, so this needs
              CdnImage's format detection, not a hardcoded CdnSvg. */}
          <Pressable style={styles.h1AvatarWrap} onPress={onAvatarPress}>
            <CdnImage
              uri={userImg ?? ownAvatarFallback}
              width={54}
              height={54}
              style={styles.h1AvatarRadius}
            />
          </Pressable>

          <Pressable style={styles.h1NameBlock} onPress={onEditProfilePress}>
            <Text style={styles.h1UserName} numberOfLines={1}>{userName ?? ''}</Text>
            {/* Angular: componentData.LINKCTACOLOR — always 'linkColor'
                (--ion-color-link-color: #29339B) for Home's header1 in every
                state this app reaches, not the brand red this used. */}
            <View style={styles.h1EditRow}>
              <Text style={styles.h1EditLabel}>Edit profile</Text>
              <CdnSvg uri={ICONS.fwdLink} width={12} height={12} />
            </View>
            {/* Angular: paidBatch = entryType=='P' && payRenewalFlag=='0' &&
                !check_Paid_Verified_Nophoto() — shown as a green pill under
                the name/edit-profile row. Was accepted as a prop here but
                never actually rendered. */}
            {hasPaidBatch && (
              <Badge
                variant="paid"
                text={t('MENU.PAID_BADGE')}
                imageUrl={CDN + 'revamp/paid-tag-revamp.svg'}
                style={styles.h1PaidBadge}
              />
            )}
          </Pressable>
        </View>

      </SafeAreaView>
    )
  }

  // ── header2: title bar ────────────────────────────────────────────────────
  if (type === 'header2') {
    return (
      <SafeAreaView edges={['top']} style={[styles.wrapper2, style]}>
        <View style={styles.titleRow}>
          {showBackIcon && (
            <Pressable style={styles.backBtn} onPress={onBackPress}>
              <SvgXml xml={CHEVRON_BACK_XML} width={24} height={24} />
            </Pressable>
          )}
          <Text style={styles.titleText} numberOfLines={1}>{title ?? ''}</Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── registration / signIn ──────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={[styles.wrapperAuth, style]}>
      <View style={styles.authRow}>
        {showBackBtn && (
          <Pressable style={styles.backBtn} onPress={onBackPress}>
            {closeIcon
              ? <CdnSvg uri={ICONS.close} width={24} height={24} />
              : <SvgXml xml={CHEVRON_BACK_XML} width={24} height={24} />}
          </Pressable>
        )}

        <View style={styles.flex1} />

        {onLanguagePress && (
          <Pressable style={styles.langBtn} onPress={onLanguagePress}>
            <CdnSvg uri={ICONS.lang} width={24} height={24} />
            <Text style={[styles.langText, { fontFamily: langFonts.medium }]}>{resolvedLangLabel}</Text>
            <SvgXml xml={CHEVRON_DOWN_XML} width={16} height={16} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── header1 — Figma light-blue header ──────────────────────────────────────
  // Measured off the live Angular app (#headerIonGrid computed padding):
  // 16px top, 24px horizontal, 12px bottom — not 16px/14px.
  h1Bg: {
    backgroundColor:   Colors.white,
    paddingHorizontal: 24,
    paddingBottom:     12,
  },

  // Row 1: hamburger | language | icons
  h1AppBar: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingTop:     16,
    gap:            8,
  },

  // Row 2: avatar | name + edit
  h1UserBar: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     10,
  },

  // Avatar — Angular: .avatar { width/height: 13.5vmin } — no border/ring
  // exists in the real CSS at all (the completion-% overlay that DOES have
  // a red border is separately confirmed dead/commented-out).
  h1AvatarWrap: {
    width:          48,
    height:         48,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  h1AvatarRadius: {
    borderRadius: 24,
  },
  // Name + edit profile block
  h1NameBlock: {
    flex:       1,
    marginLeft: 12,
  },
  h1UserName: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   16,
    color:      Colors.textPrimary,
    lineHeight: 22,
  },
  h1EditRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     1,
  },
  // Angular: componentData.LINKCTACOLOR resolves to 'linkColor'
  // (--ion-color-link-color: #29339B), not the brand red.
  h1EditLabel: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   12,
    color:      Colors.link,
  },
  h1PaidBadge: {
    marginTop: 6,
  },

  // Language selector pill
  // Measured off the live Angular app (.lang-selection computed style):
  // 8px radius, transparent fill, solid black 1px border, ~37px tall —
  // same visual language as the icon buttons, not a grey-bordered pill.
  h1LangBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       '#000000',
    borderRadius:      8,
    paddingVertical:   4,
    paddingHorizontal: 8,
    height:            36,
  },
  h1LangText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   11,
    color:      Colors.textPrimary,
  },
  // Icon buttons — Angular: .home-header-icon (8px radius, transparent fill,
  // solid black 1px border) wraps .width-height-32 (9vmin ≈ 32px on a
  // typical phone width) — corrected from an earlier, too-large 36×36 guess.
  h1IconBtn: {
    width:           37,
    height:          37,
    borderRadius:    8,
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     '#000000',
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },
  // Badge on toolbar icon
  badgeWrap: {
    position:          'absolute',
    top:               -4,
    right:             -4,
    backgroundColor:   Colors.primary,
    borderRadius:      10,
    minWidth:          16,
    height:            16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
    borderWidth:       1,
    borderColor:       Colors.white,
  },
  badgeText: {
    fontFamily: Fonts.poppinsSemiBold,
    color:      Colors.white,
    fontSize:   8,
    lineHeight: 12,
  },

  // ── header2 ────────────────────────────────────────────────────────────────
  wrapper2: {
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  titleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    height:            52,
  },
  backBtn: {
    width:           40,
    height:          40,
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     4,
  },
  titleText: {
    fontFamily: SemanticFontsEnglish.headingEnglishMedium,
    flex:       1,
    fontSize:   16,
    color:      Colors.textDark,
  },
  flex1: { flex: 1 },

  // ── registration / signIn ─────────────────────────────────────────────────
  wrapperAuth: {
    backgroundColor: Colors.white,
    paddingBottom:   8,
  },
  authRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingTop:        24,
  },
  langBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderWidth:       1,
    borderColor:       Colors.borderNeutral,
    borderRadius:      8,
    paddingVertical:   4,
    paddingHorizontal: 8,
    height:            36,
    marginTop:         4,
  },
  langText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   12,
    color:      Colors.textPrimary,
  },
})
