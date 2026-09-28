import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dimensions, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
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
// Angular: `.notification-badge-message { width: 1.5rem; height: 1rem }` —
// 1rem/1.5rem happen to be the exact same values as --font16/--font24
// (FontSize's own header comment lists both), so reuse those named entries
// instead of a separate remPx() call for the same numbers.
const BADGE_WIDTH  = FontSize.font24
const BADGE_HEIGHT = FontSize.font16

// header2's back-button column width — Ionic's 12-col grid, header row has no
// grid-level padding (`class="padd0"`). `notification.page.html`/
// `header.component.html` (menu-contacts) both use `ion-col size="1.5"`;
// `video-faq.page.html` is the one real exception at `size="2"` (passed via
// the `backColSize` prop) — this changes how far the title's left edge sits,
// not just the touch target, since the title column starts immediately after
// this one (no flex spacer between them, unlike header1's toolbar row).
const HEADER2_GRID_UNIT = SW / 12

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
  // header.component.html's own header2 block (heading4-medium-16 color-333333,
  // border-bottom-search) is real ONLY for menu-contacts.page.html (a page not
  // yet ported) — every other screen currently reusing this component for its
  // title bar (NotificationScreen, VideoFaqScreen) has its OWN, different inline
  // Angular header markup, not this shared component at all. These two escape
  // hatches let each such screen match its OWN real source instead of forcing
  // menu-contacts' specific styling onto screens that never had it.
  titleStyle?:        StyleProp<TextStyle> | undefined
  // video-faq.page.html's toolbar uses `.header-box-shadow` (a drop shadow)
  // instead of `.border-bottom-search` (a 1px hairline) — the only header2
  // caller that does.
  shadowHeader?:      boolean | undefined
  // header2's back-button ion-col size (12-col grid) — default 1.5 matches
  // both real header2 sources (notification.page.html, menu-contacts via
  // header.component.html); video-faq.page.html is the one exception at 2.
  backColSize?:       number  | undefined
  // video-faq.page.html's title row is `pt-12 pb-12` (content-hugging), not
  // header2's own flat `height:52` (an unconfirmed guess for the OTHER real
  // source, notification.page.html/menu-contacts, which has no vertical
  // padding class at all — sized purely by its back-button's own intrinsic
  // height). Lets a caller replace that guess with a real, cited value.
  titleRowStyle?:     StyleProp<ViewStyle> | undefined

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
  titleStyle,
  shadowHeader = false,
  backColSize  = 1.5,
  titleRowStyle,
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
  const insets = useSafeAreaInsets()

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
      <SafeAreaView edges={['top']} style={styles.h1SafeArea}>
      <View style={[styles.h1Bg, hasPaidBatch ? styles.h1BgPaid : null, style]}>

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
              toolImg URL (no local vector-icon special-casing). The second
              entry's own `className: "ml-12"` (12px) is a bigger gap than the
              row's own flat 8px — the ONLY pair in this row with a real,
              confirmed Angular value, so it gets an explicit extra 4px on top
              of the row's gap rather than changing that shared gap itself. */}
          {homeToolBar?.filter(t => t.toolType !== 'menu').map((item, i) => (
            <Pressable
              key={item.toolType}
              style={[styles.h1IconBtn, i > 0 && styles.h1IconBtnGap]}
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
              {/* Angular: button-revamp.component.scss sets the icon's `.small`
                  box to 16x16, but the actual `background-size: contain` rule
                  that would SCALE the image to fill that box is commented out
                  — so it renders at the raw SVG's own native pixel size (7x10,
                  confirmed from the live file: viewBox="0 0 7 10"), just
                  centered inside the unused 16x16 box. CdnSvg has no such
                  invisible box — passing 16x16 here scales the glyph up to
                  ~11x16, visibly bigger than Angular's real tiny chevron. */}
              <CdnSvg uri={ICONS.fwdLink} width={7} height={10} />
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

      </View>
      </SafeAreaView>
    )
  }

  // ── header2: title bar ────────────────────────────────────────────────────
  if (type === 'header2') {
    return (
      <SafeAreaView edges={['top']} style={[styles.h1SafeArea, shadowHeader && styles.wrapper2Shadow]}>
      <View style={[styles.wrapper2, shadowHeader && styles.wrapper2ShadowBorder, style]}>
        <View style={[styles.titleRow, titleRowStyle]}>
          {showBackIcon && (
            <Pressable style={[styles.backBtn, { width: HEADER2_GRID_UNIT * backColSize }]} onPress={onBackPress}>
              <SvgXml xml={CHEVRON_BACK_XML} width={24} height={24} />
            </Pressable>
          )}
          <Text style={[styles.titleText, titleStyle]} numberOfLines={1}>{title ?? ''}</Text>
        </View>
      </View>
      </SafeAreaView>
    )
  }

  // ── registration / signIn ──────────────────────────────────────────────────
  // Top inset from useSafeAreaInsets() rather than the native SafeAreaView:
  // inside OnboardingRouter's KeyboardAvoidingView the native view mounted
  // with 0 top padding (header under the status bar, back button hidden, page
  // shifted up) until focusing an input forced a relayout.
  return (
    <View style={[styles.h1SafeArea, { paddingTop: insets.top }]}>
    <View style={[styles.wrapperAuth, style]}>
      <View style={styles.authRow}>
        {showBackBtn && (
          <Pressable style={[styles.backBtn, type === 'registration' && styles.backBtnRegistration]} onPress={onBackPress}>
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
                class — ionicons sizes itself to 1em of the inherited 16px font,
                so 16×16 (24 rendered noticeably larger than the live app). */}
            <SvgXml xml={CHEVRON_DOWN_XML} width={16} height={16} style={styles.langChevron} />
          </Pressable>
        )}
      </View>
    </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // The notch/status-bar inset strip above every header variant — matches
  // ActivityScreen.tsx's own top SafeAreaView (styles.screen), which is the
  // only screen with its own top-level SafeAreaView instead of going through
  // this component. Kept separate from each variant's own background below
  // (h1Bg/wrapper2/wrapperAuth) so only the inset strip is gray, not the
  // header bar's real content underneath.
  h1SafeArea: {
    backgroundColor: Colors.background,
  },

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
    // Angular: button-revamp.component.scss's `ion-button.linkSmall span`
    // sets `line-height: 20px !important` explicitly.
    lineHeight: 20,
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
  // Angular: the 'notification' toolbar entry's own `className: "ml-12"` —
  // on top of h1AppBar's flat 8px row gap, for a real 12px total.
  h1IconBtnGap: {
    marginLeft: 4,
  },
  // Badge on toolbar icon — Angular: `.notification-badge-message` (Home's
  // only badged toolbar item is 'notification' — the other class,
  // `.numbers-badge-message`, is 1px-offset-different and used elsewhere,
  // not through this component).
  badgeWrap: {
    position:        'absolute',
    top:             -3,
    right:           -8,
    backgroundColor: '#DE2A68',
    borderRadius:    20,
    width:           BADGE_WIDTH,
    height:          BADGE_HEIGHT,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.white,
  },
  // Angular: `.font-8` — font-size var(--font8) (0.5rem, dynamic — see
  // FontSize's header comment), Poppins-REGULAR (not SemiBold); `white-color`
  // already matched. No line-height class on this element — none set here
  // either, letting it fall back to the font's natural metric.
  badgeText: {
    fontFamily: Fonts.poppinsRegular,
    color:      Colors.white,
    fontSize:   FontSize.font8,
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
  // Angular: video-faq.page.scss's `.header-box-shadow { background:#FFF;
  // box-shadow:0 8px 16px 0 rgba(0,0,0,.08) }` — a page-specific alternative
  // to the generic `.border-bottom-search` hairline, opted into via `shadowHeader`.
  // Applied to the outer h1SafeArea (not wrapper2 below) — see h1SafeArea's
  // header comment for why the shadow has to live on the outer container.
  wrapper2Shadow: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius:  16,
    elevation:     4,
  },
  // wrapper2's own bottom border, zeroed out on wrapper2 itself (not the
  // outer h1SafeArea) when the shadow variant above is active.
  wrapper2ShadowBorder: {
    borderBottomWidth: 0,
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
  // Registration only: nudges the back chevron in from the screen edge (it sat
  // 8px in — centered in the 40px backBtn — now 16px). signIn is unchanged.
  backBtnRegistration: {
    marginLeft: 8,
  },
  wrapperAuth: {
    backgroundColor: Colors.white,
  },
  // Angular: header.component.html's `<ion-row class="pr-24 mt-24">` — RIGHT
  // padding only (the back button/chevron sits flush against the left edge),
  // not a flat 24 on both sides.
  authRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingRight:  24,
    paddingTop:    24,
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
  // Centered on the pill's row regardless of the label's line box.
  langChevron: {
    alignSelf: 'center',
  },
  langText: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   FontSize.font12,
    color:      Colors.black,
  },
})
