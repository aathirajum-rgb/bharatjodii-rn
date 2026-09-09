import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dimensions, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import Badge from '../badge/Badge'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { getOwnGenderAvatarUrl } from '../../utils/avatar'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import { handleBack } from '../../utils/navigationRef'
import LanguagePill from '../language-pill/LanguagePill'

// Angular: header.component.scss's header1 sizes are all vmin (this app is
// portrait-locked — app.json's orientation:'portrait' — so 1vmin ≈ 1% of
// device width, same reasoning as HomeScreen.tsx's own SW-based proportional
// sizes, e.g. HAND_SIZE = SW * 0.35).
const SW = Dimensions.get('window').width
// `.home-header-icon` wraps `.width-height-32` (9vmin) with its own 4px
// padding on every side — the icon itself is the button size minus that.
const H1_ICON_BTN_SIZE = SW * 0.09
const H1_ICON_SIZE = H1_ICON_BTN_SIZE - 8
// `.avatar { width/height: 13.5vmin }`.
const H1_AVATAR_SIZE = SW * 0.135

// Angular's header back-button and language-pill dropdown both use Ionic's
// bundled "chevron-back-outline" / "chevron-down-outline" icons (ion-icon
// name=...), not a CDN-hosted image — the CDN_REACT + 'arrowleft.svg' /
// 'chevronleft.svg' paths this file used before don't exist on the CDN at all
// (404 on both). Inlined verbatim as SVG XML, same convention as HeightScreen.
// tsx's CHEVRON_FORWARD_XML, mirrored/rotated for the back and down directions.
const CHEVRON_BACK_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M328 112L184 256l144 144"/></svg>`
const CHEVRON_DOWN_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M112 184l144 144 144-144"/></svg>`

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
  // Defaults to the centralized handleBack() (utils/navigationRef.ts) — the
  // same function the Android hardware back button calls — so every screen
  // using AppHeader gets identical back behavior for free. A screen only
  // needs to pass its own onBackPress when it must do something BEFORE
  // backing out (e.g. OnboardingRouter's static-map fallback below).
  onBackPress = handleBack,
  onLanguagePress,
  style,
}: AppHeaderProps) {
  const { t, i18n } = useTranslation()
  const langFonts = useLanguageFonts()

  // Resolve language label for the registration/signIn pill only — header1
  // (home/dashboard) now renders <LanguagePill>, which computes its own
  // native-script label internally.
  const resolvedLangLabel = languageLabel ?? t('REGISTRATION.SELECTED_LANGUAGE')

  // Angular: header.component.ts's common.getAvatarImg() (called with no args,
  // i.e. isOppositeProfile=false) — the logged-in user's OWN avatar placeholder
  // uses their OWN gender, unlike a profile card's opposite-gender placeholder.
  //
  // Seeded empty, NOT with FEMALE_AVATAR_URL: login gender comes from async
  // storage, so a hardcoded seed showed every male user a female silhouette for
  // the first frames of every Home load. An empty avatar slot for one tick
  // beats rendering the wrong gender. Same guard MenuScreen/HomeSidebar use.
  const [ownAvatarFallback, setOwnAvatarFallback] = useState('')
  // A cached PHOTO_URL can outlive the photo itself (deleted server-side, CDN
  // miss). Without this the header rendered a blank box instead of falling
  // back, which looks identical to "no avatar at all".
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getOwnGenderAvatarUrl().then(url => { if (!cancelled) setOwnAvatarFallback(url) })
    return () => { cancelled = true }
  }, [])

  // Reset the failure latch when a new photo actually arrives, so a re-upload
  // isn't permanently stuck on the placeholder for the life of the mount.
  useEffect(() => { setPhotoFailed(false) }, [userImg])

  const avatarUri = (userImg && !photoFailed) ? userImg : ownAvatarFallback

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
      <SafeAreaView edges={['top']} style={[styles.h1Bg, hasPaidBatch ? styles.h1BgPaid : null, style]}>

        {/* ── Row 1: App bar ── */}
        <View style={styles.h1AppBar}>
          {/* Hamburger / menu — Angular: reDirectPage('/menu'), its own
              dedicated column, not part of the homeToolBar loop below. */}
          <Pressable
            style={styles.h1IconBtn}
            onPress={() => onToolbarItemPress?.('menu')}
          >
            <CdnSvg uri={ICONS.menuHome} width={H1_ICON_SIZE} height={H1_ICON_SIZE} />
          </Pressable>

          <View style={styles.flex1} />

          {/* Language selector pill — always visible, auto-detects language.
              Angular: every header pill that reaches LanguageChangeService
              (Home included) opens the SAME 2-language "mothertongue" bottom
              sheet — confirmed via exhaustive source trace, no exception.
              LanguagePill owns that sheet internally, so this no longer needs
              onLanguagePress wired from the caller. */}
          <LanguagePill langCode={i18n.language} />

          {/* Angular: home.config.ts's homeToolBar — discover-matches (search)
              then notification, in that order; each icon rendered from its own
              toolImg URL (no local vector-icon special-casing). */}
          {homeToolBar?.filter(t => t.toolType !== 'menu').map(item => (
            <Pressable
              key={item.toolType}
              style={styles.h1IconBtn}
              onPress={() => onToolbarItemPress?.(item.toolType)}
            >
              <CdnSvg uri={item.toolImg} width={H1_ICON_SIZE} height={H1_ICON_SIZE} />
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
          <Pressable style={[styles.h1AvatarWrap, { width: H1_AVATAR_SIZE, height: H1_AVATAR_SIZE, borderRadius: H1_AVATAR_SIZE / 2 }]} onPress={onAvatarPress}>
            {!!avatarUri && (
              <CdnImage
                uri={avatarUri}
                width={H1_AVATAR_SIZE}
                height={H1_AVATAR_SIZE}
                style={[styles.h1AvatarRadius, { borderRadius: H1_AVATAR_SIZE / 2 }]}
                // cover, not CdnImage's 'contain' default — a portrait photo
                // letterboxed inside the 48px circle instead of filling it.
                // Only affects the raster path; an SVG placeholder routes to
                // CdnSvg, which sizes itself.
                resizeMode="cover"
                onError={() => setPhotoFailed(true)}
              />
            )}
          </Pressable>

          <Pressable style={styles.h1NameBlock} onPress={onEditProfilePress}>
            <Text style={styles.h1UserName} numberOfLines={1}>{userName ?? ''}</Text>
            {/* Angular: componentData.LINKCTACOLOR — always 'linkColor'
                (--ion-color-link-color: #29339B) for Home's header1 in every
                state this app reaches, not the brand red this used. */}
            <View style={styles.h1EditRow}>
              {/* Angular: `EDITPROFILE.EDIT_PROFILE` — was a hardcoded
                  literal, not the real translation key (only ever matched
                  English by coincidence). */}
              <Text style={styles.h1EditLabel}>{t('EDITPROFILE.EDIT_PROFILE')}</Text>
              {/* Angular: iconSize={eButtonSize.small} = 16px (button-revamp's
                  `.small` icon mixin), not 12. */}
              <CdnSvg uri={ICONS.fwdLink} width={16} height={16} />
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
            {/* Angular: bare `<ion-icon name="chevron-down-outline">`, no size
                class at all here — Ionic's own default (1.5rem ≈ 24px), not 16. */}
            <SvgXml xml={CHEVRON_DOWN_XML} width={24} height={24} />
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
  // Angular: `[ngClass]="hasPaidBatch ? 'pb-16' : 'pb-12'"` on the outer grid.
  h1BgPaid: {
    paddingBottom: 16,
  },

  // Row 1: hamburger | language | icons
  // Angular: this row's own `pb-16` — the gap to row 2 lives here, not on
  // row 2's own marginTop (h1UserBar no longer sets one, to avoid double-
  // counting the same gap on both sides of it).
  h1AppBar: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingTop:     16,
    paddingBottom:  16,
    gap:            8,
  },

  // Row 2: avatar | name + edit
  h1UserBar: {
    flexDirection: 'row',
    alignItems:    'center',
  },

  // Avatar — Angular: .avatar { width/height: 13.5vmin } — no border/ring
  // exists in the real CSS at all (the completion-% overlay that DOES have
  // a red border is separately confirmed dead/commented-out). Size/radius
  // are computed inline from H1_AVATAR_SIZE (device-width-scaled); this
  // supplies everything else.
  h1AvatarWrap: {
    // Clip here, not just on the inner image: the fallback placeholder
    // avatar is an SVG (CdnSvg/SvgCssUri), which ignores borderRadius on
    // its own style, so relying on the child alone left the placeholder
    // square on Android. Clipping this wrapper View works for both the SVG
    // placeholder and a real photo, on every platform.
    overflow:       'hidden',
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  h1AvatarRadius: {
    borderRadius: 24,
    // Android's Image doesn't reliably clip its bitmap to borderRadius on
    // its own (works fine on iOS/web) — needs an explicit overflow:'hidden'
    // on the same style to actually crop the corners.
    overflow:     'hidden',
  },
  // Name + edit profile block
  h1NameBlock: {
    flex:       1,
    marginLeft: 12,
  },
  // Angular: `heading4-medium-16 color-333333` — font-size var(--font16)
  // (1rem, dynamic — see FontSize's header comment). Color: componentData's
  // TEXTCOLOR is only ever assigned once a hero banner/scroll state kicks in
  // (out of scope here, same simplification as the header's background —
  // see the header1 branch's own comment); in the common default case it's
  // unset, so the inline [attr.style] is invalid CSS and gets ignored,
  // leaving `.color-333333`'s `!important` as the real winner — not
  // textPrimary (#111). No line-height class on this span — none set here
  // either, letting it fall back to the font's natural metric.
  h1UserName: {
    fontFamily: Fonts.poppinsMedium,
    fontSize:   FontSize.font16,
    color:      '#333333',
  },
  h1EditRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     1,
  },
  // Angular: componentData.LINKCTACOLOR resolves to 'linkColor'
  // (--ion-color-link-color: #29339B), not the brand red. buttonSize
  // 'linkSmall' sets font-size var(--font12) (0.75rem, dynamic — see
  // FontSize's header comment), weight 400 — family already matched.
  h1EditLabel: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font12,
    color:      Colors.link,
  },
  h1PaidBadge: {
    marginTop: 6,
  },

  // Icon buttons — Angular: .home-header-icon (8px radius, transparent fill,
  // solid black 1px border, 4px padding) wraps .width-height-32 (9vmin,
  // device-width-scaled — see H1_ICON_BTN_SIZE above), not a flat 37 (which
  // only happened to be close on one specific screen width).
  h1IconBtn: {
    width:           H1_ICON_BTN_SIZE,
    height:          H1_ICON_BTN_SIZE,
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
  // Angular: `.border-bottom-search { border-bottom: 1px solid #f1f5f9 }` —
  // a different, more specific gray than the generic Colors.divider token
  // (#f0f0f0) other screens use for plain list/card dividers.
  wrapper2: {
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  // Angular: `heading4-medium-16 color-333333` — font-size var(--font16)
  // (1rem, dynamic — see FontSize's header comment); color already matched
  // (Colors.textDark = #333333).
  titleText: {
    fontFamily: SemanticFontsEnglish.headingEnglishMedium,
    flex:       1,
    fontSize:   FontSize.font16,
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
  // Angular: `textcta-medium-12 black-color` — font-size var(--font12)
  // (0.75rem, dynamic — see FontSize's header comment), Poppins-Medium
  // (family already matched); color pure black (#000), not textPrimary (#111).
  langText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   FontSize.font12,
    color:      Colors.black,
  },
})
