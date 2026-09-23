import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg, { CdnImage } from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { FontSize, Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import ProfilePhoto, { type PhotoVariant, isPhotoRequestActive } from '../profile-photo/ProfilePhoto'
import { getOppGenderAvatarUrl, FEMALE_AVATAR_URL } from '../../utils/avatar'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Angular: core/config/button.config.ts's SEE_ALL — textColor: 'linkColor'
// (--ion-color-link-color: #29339B), not the brand red.
const SEE_ALL_LINK_COLOR = '#29339B'
// Angular: both this card's "View full profile" (type=3) and "See all" ghost
// card (type=5) <app-button-revamp> calls override SEE_ALL's own iconType to
// `EButtonIcons.forwardAnimation` — button-revamp.component.ts's
// IsShowAnimation() then renders a plain <img> (not a static icon) at this
// literal path, 24×20px — same asset SwiperCard.tsx's "See all" link uses.
const FWD_ANIM_ICON = `${CDN_SVG}revamp/animation/right-arrow-animation.gif`

// ─── Types ────────────────────────────────────────────────────────────────────

// Each numeric variant maps to a distinct visual layout (matches Angular type='1'–'8').
export type CardVariant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

// Section identifies which list/context the card lives in — drives photo height & layout tweaks.
export type CardSection =
  | 'newmatches'
  | 'dailyrecommendations'
  | 'matches'
  | 'likedyou'
  | 'viewedyou'
  | 'viewedbyme'
  | 'whoviewednumber'
  | 'similarprofiles'
  | 'viewlater'
  | 'likedprofile'
  | 'successstory'

export interface ProfileCardProps {
  variant:    CardVariant
  section:    CardSection

  // ── Identity ────────────────────────────────────────────────────────────────
  profileId?: string | undefined   // MATRIID — used for navigation & API calls

  // ── Profile info ────────────────────────────────────────────────────────────
  name?:      string | undefined
  age?:       string | undefined
  height?:    string | undefined   // e.g. "5ft 4in"
  education?: string | undefined
  location?:  string | undefined
  date?:      string | undefined

  // ── Photo ───────────────────────────────────────────────────────────────────
  profileImg?:  string | undefined
  avatarImg?:   string | undefined

  // Photo-state props (used once app-photo-new is integrated).
  // All optional — cards without photo context simply omit them.
  isPhotoAvailable?:    boolean | undefined  // profile has uploaded photos
  isPhotoProtect?:      boolean | undefined  // photos are locked (blurred)
  isAddPhotoRequest?:   boolean | undefined  // current user sent add-photo request
  isViewPhotoRequest?:  boolean | undefined  // current user sent view-photo request
  showReqPhotoElement?: boolean | undefined  // show the photo-request CTA on card

  // ── Status flags ────────────────────────────────────────────────────────────
  isIdVerified?:   boolean | undefined  // shows ID-verified badge
  isNewlyJoined?:  boolean | undefined  // shows newly-joined badge

  // ── Like / label ────────────────────────────────────────────────────────────
  likedStatus?: '0' | '1' | '2' | '3' | '5' | undefined
  isNewLabel?:         boolean | undefined  // true → show labelContent; false → likedViewedDateText
  labelContent?:       string | undefined
  likedViewedDateText?: string | undefined

  // ── See-all card (variant 5) ─────────────────────────────────────────────────
  viewMoreList?:    { THUMBIMG: string }[] | undefined
  viewMoreContent?: string | undefined

  // ── Callbacks ────────────────────────────────────────────────────────────────
  onPress?:         (() => void) | undefined
  onLikePress?:     (() => void) | undefined
  onViewMorePress?: (() => void) | undefined
  // Photo-protected/no-photo overlay's WhatsApp CTA — see ProfilePhoto.tsx.
  onWhatsApp?:      (() => void) | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W  = Dimensions.get('window').width
const IMG_CDN   = CDN_SVG

// Derived from Angular SCSS vmin values.
// On portrait phones vmin ≈ vw = 1% of screen width.
//
// Confirmed against profile-card.component.scss's card-htN classes: every one
// pairs min-width with an IDENTICAL min-height value (e.g. card-ht2's 55.558vmin
// for both) — Angular's cards are square per section, not a fixed card width
// with a per-section photo height. SwiperCard.tsx reuses this same table as its
// default card WIDTH per section for exactly that reason — a flat default width
// was previously used for every section except where a call site manually (and
// in two cases, incorrectly) overrode it.
export const PHOTO_HEIGHT: Record<CardSection, number> = {
  newmatches:           SCREEN_W * 0.7778,
  // Angular profile-card.component.ts's photoHt map: 'dailyrecommendations':
  // '77.78vmin'. (80.667vmin — used here before — is `.dailyrecommendations.card-ht1`,
  // the photo BLOCK's min-width/height, not the photo itself.)
  dailyrecommendations: SCREEN_W * 0.7778,
  matches:              SCREEN_W * 0.5556,
  likedyou:             SCREEN_W * 0.7222,
  viewedyou:            SCREEN_W * 0.7222,
  viewedbyme:           SCREEN_W * 0.6111,
  whoviewednumber:      SCREEN_W * 0.6111,
  similarprofiles:      SCREEN_W * 0.5556,
  viewlater:            SCREEN_W * 0.4556,
  likedprofile:         SCREEN_W * 0.7222,
  // Angular: `.successStory.card-ht3 { height/width: 72.225vmin !important }`.
  // card-ht4 (91.111vmin) is NOT this — profile-card.component.ts picks it only
  // when `fromPage === 'success-story'` (the dedicated Success Story page), and
  // app-swiper's success-story slide never binds fromPage at all, so Home always
  // lands on card-ht3. 91.111vmin made the card ~26% too large here.
  successstory:         SCREEN_W * 0.72225,
}

// ─── "See all" card avatar ────────────────────────────────────────────────────
// Angular: each of the three <ion-avatar> images carries
// (error)="onImgErrorHandler($event)", which swaps a missing/broken THUMBIMG for
// the OPPOSITE-gender silhouette — that's why Angular's card shows three filled
// circles even when the preview profiles have no photos. Mirrors ProfilePhoto's
// own fallback resolution (utils/avatar's getOppGenderAvatarUrl).
function SeeAllAvatar({ uri, fallbackUri }: { uri: string; fallbackUri?: string | undefined }) {
  const [oppAvatar, setOppAvatar] = useState(FEMALE_AVATAR_URL)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getOppGenderAvatarUrl().then(url => { if (!cancelled) setOppAvatar(url) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const fallback = fallbackUri || oppAvatar
  const source   = !uri || failed ? fallback : uri

  // The silhouette fallbacks are SVGs, which RN's <Image> can't decode on
  // native — CdnImage picks the right renderer per file extension.
  return (
    <CdnImage
      uri={source}
      width="100%"
      height="100%"
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  )
}

const AVATAR_SIZE = 56

// The middle "See All" avatar overlaps the seam between the other two —
// originally centered via `left: '50%'` + a fixed negative marginLeft on an
// absolutely-positioned child. That works on iOS/web, but Yoga on Android
// resolves a percentage `left` on an absolute child of a shrink-wrapped flex
// row (avatarRow has no explicit width — it sizes to its two in-flow avatars)
// inconsistently, throwing the middle circle visibly off-center on Android
// only. Measuring the row's actual pixel width via onLayout and computing an
// explicit pixel `left` sidesteps the percentage entirely, so every platform
// places it identically.
function AvatarRow({
  avatarSlots, avatarImg,
}: { avatarSlots: string[]; avatarImg?: string | undefined }) {
  const [rowWidth, setRowWidth] = useState<number | null>(null)

  return (
    <View
      style={styles.avatarRow}
      onLayout={e => setRowWidth(e.nativeEvent.layout.width)}
    >
      {avatarSlots.map((uri, i) => (
        <View
          key={i}
          style={[
            styles.avatarWrap,
            i === 1 && rowWidth != null && [styles.avatarWrapAbsolute, { left: (rowWidth - AVATAR_SIZE) / 2 }],
            i === 1 && rowWidth == null && styles.avatarWrapHidden,
          ]}
        >
          <SeeAllAvatar uri={uri} fallbackUri={avatarImg} />
        </View>
      ))}
    </View>
  )
}

// ─── Section → PhotoVariant map ──────────────────────────────────────────────

const SECTION_VARIANT: Record<CardSection, PhotoVariant> = {
  newmatches:           'matches',
  dailyrecommendations: 'matches',
  matches:              'matches',
  likedyou:             'matches',
  viewedyou:            'viewedyou',
  viewedbyme:           'viewedyou',
  whoviewednumber:      'viewedyou',
  similarprofiles:      'matches',
  viewlater:            'default',
  likedprofile:         'likedProfile',
  successstory:         'successStory',
}

// Angular: .see-all-card is a pink gradient (#FFF1FF → #FFFFFF), but
// .likedprofile.see-all-card overrides it with a yellow one (#FFF6C1 → #FFFFFF)
// so the ghost card sits in the Liked Profiles palette instead of the pink one
// every other section uses.
const SEE_ALL_GRADIENT_DEFAULT: readonly [string, string] = ['#FFF1FF', '#FFFFFF']
const SEE_ALL_GRADIENT: Partial<Record<CardSection, readonly [string, string]>> = {
  likedprofile: ['#FFF6C1', '#FFFFFF'],
}

// ─── InfoOverlay ──────────────────────────────────────────────────────────────
// Name + detail text pinned to the bottom of a photo with a dark gradient overlay.
// Angular: .information-block { background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,1)) }

interface InfoOverlayProps {
  name?:   string | undefined
  detail?: string | undefined
}

function InfoOverlay({ name, detail }: InfoOverlayProps) {
  const langFonts = useLanguageFonts()
  if (!name && !detail) return null
  return (
    <View style={styles.infoOverlay}>
      {!!name   && <Text style={[styles.overlayName, { fontFamily: langFonts.semiBold }]}   numberOfLines={1}>{name}</Text>}
      {!!detail && <Text style={[styles.overlayDetail, { fontFamily: langFonts.regular }]} numberOfLines={1}>{detail}</Text>}
    </View>
  )
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────

export default function ProfileCard({
  variant,
  section,
  name,
  age,
  height:     profileHeight,
  education,
  location,
  date,
  profileImg,
  avatarImg,
  isPhotoAvailable    = true,
  isPhotoProtect      = false,
  isAddPhotoRequest   = false,
  isViewPhotoRequest  = false,
  showReqPhotoElement = true,
  isNewlyJoined       = false,
  likedStatus,
  isNewLabel   = false,
  labelContent,
  likedViewedDateText,
  viewMoreList    = [],
  viewMoreContent = 'See All',
  onPress,
  onLikePress,
  onViewMorePress,
  onWhatsApp,
}: ProfileCardProps) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const photoH     = PHOTO_HEIGHT[section] ?? SCREEN_W * 0.7
  const photoVar   = SECTION_VARIANT[section] ?? 'default'

  // Shared photo-state props forwarded to ProfilePhoto on every variant
  const photoProps = {
    profileImage:       profileImg,
    // No per-item override → ProfilePhoto falls back to the opposite-gender
    // avatar itself (Angular: getAvatarImage()/getOppGenderType()).
    defaultImage:       avatarImg,
    isPhotoAvailable,
    isPhotoProtect,
    isAddPhotoRequest,
    isViewPhotoRequest,
    showReqPhotoElement,
    isNewlyJoined,
    variant: photoVar,
    onPress,
    onWhatsApp,
  } as const

  // Angular: profile-card.component.html's `.information-block` (type 1/2's
  // name+basic-detail overlay) is `*ngIf="!whatsAppAddPhotoRequestFlag &&
  // !whatsAppViewHiddenPhotoRequest"` — hidden whenever the WhatsApp photo-
  // request overlay (ProfilePhoto's own showAddRequest/showViewRequest state)
  // is showing, not stacked on top of it. Type 3's own overlay has no such
  // gate, so this is only applied at the specific call sites below, not
  // inside ProfilePhoto itself.
  const hideInfoOverlay = isPhotoRequestActive(isPhotoAvailable, isPhotoProtect, showReqPhotoElement)

  // Omits education for 'matches' section (matches Angular getBasicDetail logic).
  function basicDetail(): string {
    const parts: string[] = [age].filter(Boolean) as string[]
    if (section !== 'matches' && education) parts.push(education)
    return parts.join(', ')
  }

  // age + profile height + education — used in viewed/liked/viewlater cards.
  function fullDetail(): string {
    return [age, profileHeight, education].filter(Boolean).join(', ')
  }

  // Toggle between "new" label and date text based on isNewLabel flag.
  function labelText(): string {
    return isNewLabel ? (labelContent ?? '') : (likedViewedDateText ?? '')
  }

  // For type-2 button: mutual like or paid entry → show "Call Now", else "Like Her".
  const canCall = likedStatus === '1' || likedStatus === '3'

  // ─── Variant switch ────────────────────────────────────────────────────────

  switch (variant) {

    // ── 1 · New Matches / Daily Recommendations / Profiles You Liked ─────────
    // Full-bleed photo with name+detail overlay. DR adds a "View Details" button below.
    case 1: {
      const isDR = section === 'dailyrecommendations'
      return (
        <Pressable
          style={({ pressed }) => [styles.card, isDR && styles.cardDR, pressed && { opacity: 0.85 }]}
          onPress={onPress}
        >
          {/* Angular: the DR card is `.card-type-2 .card-type-1-padding` —
              padding: 4.444vmin (16px) around BOTH the photo and the button
              below it, so the photo is inset with its own rounded corners
              rather than bleeding to the card edges like every other variant. */}
          {isDR ? (
            <View style={styles.photoInsetDR}>
              <ProfilePhoto {...photoProps} height={photoH} showGradientScrim>
                {!hideInfoOverlay && <InfoOverlay name={name} detail={basicDetail()} />}
              </ProfilePhoto>
            </View>
          ) : (
            <ProfilePhoto {...photoProps} height={photoH} showGradientScrim>
              {!hideInfoOverlay && <InfoOverlay name={name} detail={basicDetail()} />}
            </ProfilePhoto>
          )}

          {isDR && (
            // Angular: `.card-type-2-bottom.text-align-center` with an inner
            // `mt-12` — the card's own 16px padding supplies the sides/bottom.
            <View style={styles.cardBottomDR}>
              <Pressable style={styles.primaryBtn} onPress={onPress}>
                {/* Angular: CTATXT.VIEWDETAILS translation key actually reads
                    "View profile" in English, not "View Details". Was a
                    hardcoded literal here, so it never picked up a language
                    switch — every other section's CTA text goes through t(). */}
                <Text style={[styles.primaryBtnText, { fontFamily: langFonts.medium }]}>{t('CTATXT.VIEWDETAILS')}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      )
    }

    // ── 2 · Liked You ────────────────────────────────────────────────────────
    // Full-bleed photo, liked/viewed label + primary action button below.
    case 2: {
      const isLikedYou = section === 'likedyou'
      return (
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH} showGradientScrim>
            {!hideInfoOverlay && (
              <InfoOverlay
                name={name}
                detail={[age, education].filter(Boolean).join(', ')}
              />
            )}
          </ProfilePhoto>

          <View style={[styles.cardBottom, isLikedYou && styles.cardBottomPadded]}>
            {isLikedYou && !!labelText() && (
              // Angular: `[ngClass]="newTextLable != '1' ? 'black-color' : ''"` next to a
              // fixed `likedColor` ('infoRedColor', var(--ion-color-error-color) #DE2A68) —
              // black-color's `!important` wins over infoRedColor's plain declaration
              // whenever newTextLable isn't '1', so the default label is black, and only
              // the isNewLabel==='1' branch (ngClass empties out) falls through to the pink.
              <Text style={[styles.likedLabel, { fontFamily: langFonts.regular }, isNewLabel && styles.likedLabelNew]} numberOfLines={2}>{labelText()}</Text>
            )}
            <Pressable
              style={styles.primaryBtn}
              onPress={canCall ? onPress : onLikePress}
            >
              <Text style={[styles.primaryBtnText, { fontFamily: langFonts.medium }]}>
                {canCall ? 'Call Now' : 'Like Her'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      )
    }

    // ── 3 · Who Viewed / Viewed By Me ────────────────────────────────────────
    // Photo with viewed-icon + date overlay at bottom; name + details + link below.
    case 3: {
      // Angular: profile-card.component.html's type==='3' has two MUTUALLY
      // EXCLUSIVE overlay blocks (*ngIf="newTextLable!='1'" vs `==='1'`), not
      // one block with just the text swapped — a "new" view gets a distinctly
      // colored pink eye-icon + pink text, not the default white viewed-icon.
      const isNew = isNewLabel === true
      return (
        // Angular: .card-type-3 (outer, own border-radius+shadow) wraps
        // .viewedbyme/.viewedyou/.whoviewednumber.card-ht3 (photo, its OWN
        // independent border-radius+overflow:hidden) — redundant unless the
        // photo is genuinely inset with a gap, which Figma confirms (252px
        // card, 220px photo, 16px inset on every side) — not full-bleed like
        // variant 1/2's cards.
        <Pressable style={({ pressed }) => [styles.card, styles.cardInset3, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH} variant="viewedyou">
            {/* Angular: `.information-block-card-3` (default) is a real
                transparent→black gradient overlay with 8/0/12/8 padding and a
                60px min-height — not a flat rgba(0,0,0,0.5) box with even
                10/8 padding. `.newly-viewed` (isNew) is a flat #FCEAF0 fill
                with different 12/6 padding and its own bottom corner
                radius (matching the card's own, since it sits flush at the
                photo's bottom edge). */}
            {isNew ? (
              <View style={[styles.viewedOverlay, styles.viewedOverlayNew]}>
                <CdnSvg
                  uri={IMG_CDN + 'revamp/eye-pink.svg'}
                  // Angular: eye-pink.svg's own native size (no size class
                  // applied to it at all) — 13x10, not a flat 14x14.
                  width={13}
                  height={10}
                  style={styles.viewedIcon}
                />
                <Text style={[styles.viewedText, styles.viewedTextNew]} numberOfLines={1}>{labelText()}</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
                style={styles.viewedOverlay}
              >
                <CdnSvg
                  uri={IMG_CDN + 'viewed-icon-white.svg'}
                  // Angular: viewed-icon-white.svg's own native size (no size
                  // class applied to it either) — 16x16, not a flat 14x14.
                  width={16}
                  height={16}
                  style={styles.viewedIcon}
                />
                {/* Angular: `[ngClass]="(cardType === 'viewedbyme') ? 'font-10-nav'
                    : 'body3-regular-12'"` — viewedbyme gets var(--font10),
                    viewedyou/whoviewednumber get var(--font12). */}
                <Text
                  style={[styles.viewedText, section === 'viewedbyme' && styles.viewedTextSmall]}
                  numberOfLines={1}
                >{labelText()}</Text>
              </LinearGradient>
            )}
          </ProfilePhoto>

          <View style={styles.cardInfo3}>
            {!!name         && <Text style={[styles.nameText, { fontFamily: langFonts.semiBold }]}   numberOfLines={1}>{name}</Text>}
            {/* Angular: .black-color (#000000), not the shared cardInfo's
                gray detailText — confirmed distinct from variants 4/6/7/8
                which aren't reviewed yet, so scoped to this case only. */}
            {!!fullDetail() && <Text style={[styles.detailText, styles.detailText3, { fontFamily: langFonts.regular }]} numberOfLines={1}>{fullDetail()}</Text>}
            {/* Angular: ENUMS.EButtonText.viewProfiles → 'MATCHES.VIEW_PROFILE'
                → "View full profile" (locales/en.json:642), not "View Profile"
                — and a real forward-chevron icon, not an embedded arrow
                character (matches every other link-style CTA in this app). */}
            {/* Angular: type='3's own wrapper is `mt-4` (4px) — type='5's
                is `mt-6` (6px), see that call site below. Different from
                the shared linkBtn.marginTop guess, so overridden per case. */}
            <Pressable onPress={onPress} style={[styles.linkBtn, styles.linkBtnMt4, styles.linkBtnRow]}>
              {/* Angular: ENUMS.EButtonText.viewProfiles → MATCHES.VIEW_PROFILE.
                  Was a hardcoded literal here, so it never picked up a language switch. */}
              <Text style={[styles.linkBtnText, { fontFamily: langFonts.regular }]}>{t('MATCHES.VIEW_PROFILE')}</Text>
              {/* Angular's plain <img> has no object-fit (browser default
                  fill/stretch); the GIF's real native frame is a 1200x1200
                  SQUARE, and RN Image's own default (resizeMode:'cover')
                  would crop it to fill this non-square box instead of
                  stretching, visibly zooming the arrow in. */}
              <Image source={{ uri: FWD_ANIM_ICON }} style={styles.linkBtnIcon} resizeMode="stretch" />
            </Pressable>
          </View>
        </Pressable>
      )
    }

    // ── 4 · Success Story ────────────────────────────────────────────────────
    // Photo with name + location + date below.
    case 4: {
      return (
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH} variant="successStory" />
          <View style={[styles.cardInfo, styles.cardInfo4]}>
            {!!name     && <Text style={[styles.nameText, { fontFamily: langFonts.medium }]} numberOfLines={1}>{name}</Text>}
            {!!location && <Text style={[styles.detailText, styles.detailText4, { fontFamily: langFonts.regular }]}>{location}</Text>}
            {!!date     && <Text style={[styles.dateText, styles.dateText4, { fontFamily: langFonts.regular }]}>{date}</Text>}
          </View>
        </Pressable>
      )
    }

    // ── 5 · See All / View More ───────────────────────────────────────────────
    // 3 stacked avatar thumbnails + "See All" link. No profile photo.
    // Angular: profile-card.component.html — all 3 avatars are the SAME size;
    // the middle one (viewMoreList[1]) is `position: absolute` inside a
    // centered flex row, so it overlaps the seam between the other two rather
    // than being rendered larger.
    case 5: {
      // Angular: profile-card.component.html:176-186 renders THREE <ion-avatar>
      // slots unconditionally — viewMoreList[0], [1] and [2]. When an entry is
      // missing (or its THUMBIMG fails/is empty), the img's (error) handler
      // swaps in the opposite-gender avatar, so the card ALWAYS shows three
      // overlapping circles. Mapping over the array instead rendered only as
      // many circles as there were leftover profiles — one blank circle when a
      // section had a single profile behind the five on display.
      const avatarSlots = [0, 1, 2].map(i => viewMoreList[i]?.THUMBIMG || '')
      return (
        <Pressable style={({ pressed }) => [styles.card, styles.seeAllCardOuter, pressed && { opacity: 0.85 }]} onPress={onViewMorePress}>
          <LinearGradient colors={SEE_ALL_GRADIENT[section] ?? SEE_ALL_GRADIENT_DEFAULT} style={styles.seeAllCard}>
            <AvatarRow avatarSlots={avatarSlots} avatarImg={avatarImg} />
            {/* Angular: type='5's wrapper is `mt-6` (6px) — see type='3's
                call site above for the 4px case this shared linkBtn used to
                guess for both. */}
            <Pressable onPress={onViewMorePress} style={[styles.linkBtn, styles.linkBtnMt6, styles.linkBtnCenter, styles.linkBtnRow]}>
              <Text style={[styles.linkBtnText, { fontFamily: langFonts.regular }]}>{viewMoreContent}</Text>
              <Image source={{ uri: FWD_ANIM_ICON }} style={styles.linkBtnIcon} resizeMode="stretch" />
            </Pressable>
          </LinearGradient>
        </Pressable>
      )
    }

    // ── 6 · Profile With Photos (basic) ──────────────────────────────────────
    // Photo + name + basic detail below. Angular: "muruga obs" variant.
    case 6: {
      return (
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH} />
          <View style={styles.cardInfo}>
            {!!name          && <Text style={[styles.nameText, { fontFamily: langFonts.semiBold }]}   numberOfLines={1}>{name}</Text>}
            {!!basicDetail() && <Text style={[styles.detailText, { fontFamily: langFonts.regular }]}>{basicDetail()}</Text>}
          </View>
        </Pressable>
      )
    }

    // ── 7 · View Later ────────────────────────────────────────────────────────
    // Photo (no overlay) + name + full detail below.
    case 7: {
      return (
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH} variant="default" />
          <View style={styles.cardInfo}>
            {!!name         && <Text style={[styles.nameText, { fontFamily: langFonts.semiBold }]}   numberOfLines={1}>{name}</Text>}
            {!!fullDetail() && <Text style={[styles.detailText, { fontFamily: langFonts.regular }]} numberOfLines={1}>{fullDetail()}</Text>}
          </View>
        </Pressable>
      )
    }

    // ── 8 · Liked Profile (profiles I liked) ─────────────────────────────────
    // Photo with optional eye-badge → name + details → "You liked her on…"
    // footer. Angular: .card-type-8's padding:8px wraps the ENTIRE card
    // (photo, name block, footer alike) — everything sits flush with the
    // photo's own left edge, confirmed against the Figma render (no extra
    // indent beyond that shared 8px inset).
    case 8: {
      return (
        <Pressable style={({ pressed }) => [styles.card, styles.card8, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH}>
            {isNewLabel && !!labelContent && (
              <View style={styles.eyeBadge}>
                <CdnSvg
                  uri={IMG_CDN + 'revamp/eye-pink.svg'}
                  width={14}
                  height={14}
                  style={styles.eyeIcon}
                />
                <Text style={[styles.eyeBadgeText, { fontFamily: langFonts.regular }]} numberOfLines={1}>{labelContent}</Text>
              </View>
            )}
          </ProfilePhoto>

          <View style={styles.cardInfo8}>
            {!!name         && <Text style={[styles.nameText, { fontFamily: langFonts.semiBold }]}   numberOfLines={1}>{name}</Text>}
            {!!fullDetail() && <Text style={[styles.detailText, styles.detailText8, { fontFamily: langFonts.regular }]} numberOfLines={1}>{fullDetail()}</Text>}
          </View>

          {/* Angular: .liked-profile-card — peach-to-white gradient, only the
              LEFT corners rounded (24px), border on 3 sides (not right) —
              confirmed matching almost exactly between Figma and Angular's
              live CSS. */}
          {!!likedViewedDateText && (
            <LinearGradient
              colors={['#FFEBD3', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.likedFooter}
            >
              <Text style={[styles.likedFooterText, { fontFamily: langFonts.regular }]} numberOfLines={1}>{likedViewedDateText}</Text>
            </LinearGradient>
          )}
        </Pressable>
      )
    }

    default:
      return null
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // Card shell — Angular profile-card.component.scss:6 (live, not the
  // commented-out 0.2-opacity line above it): box-shadow: 0 2px 12px 0 rgba(0,0,0,0.34)
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // Daily Recommendation's card has its own visible white halo behind the
  // photo+button (unlike every other variant, where the card shell IS the
  // photo) — confirmed via get_design_context: box-shadow 0 0 7px rgba(0,0,0,0.15),
  // lighter/tighter than the shared shadow above.
  // Angular: `.card-type-2` (radius 12, white, box-shadow 0 0 7px rgba(0,0,0,.15))
  // + `.card-type-1-padding` (padding 4.444vmin = 16px).
  cardDR: {
    shadowOpacity: 0.15,
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
    padding: 16,
    // The shared `card` style sets overflow:'hidden' so a full-bleed photo gets
    // clipped to the rounded corners. On iOS that also sets clipsToBounds, which
    // suppresses the layer's shadow entirely — so this card had no shadow there.
    // It doesn't need the clipping: its photo is inset and carries its own
    // radius (photoInsetDR), so nothing reaches the card's corners.
    overflow: 'visible',
  },
  // The inset photo keeps its own corner radius (Angular: the photo carries
  // `profile-photo-revamp`; the card's own overflow:hidden no longer clips it
  // now that there's padding between the two).
  photoInsetDR: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Angular: `.card-type-2-bottom` + `mt-12`; the 16px sides/bottom come from
  // the card's own padding, so this only contributes the 12px above the button.
  cardBottomDR: {
    paddingTop: 12,
    alignItems: 'center',
  },
  // viewedyou/viewedbyme/whoviewednumber's photo is inset within the card,
  // not full-bleed — confirmed via get_design_context (16px on every side).
  cardInset3: {
    padding: 16,
  },
  // Angular: .card-type-8 { border-radius:24px; padding:8px } — bigger
  // radius than the shared 12px, and the padding wraps photo+name+footer
  // alike (not just the photo). Shadow is Figma-specific per explicit
  // direction — Angular's real CSS reuses the shared 0.34/12 shadow instead.
  // Angular: .card-type-8's box-shadow is `0px 2px 12px rgba(0,0,0,0.34)` — the
  // SAME shadow as the shared .card above, so no override belongs here. The
  // 40px radius / 6px offset this used spread the shadow far past the card and
  // read as a heavy black halo instead of Angular's tight drop shadow.
  card8: {
    borderRadius: 24,
    padding: 8,
  },

  // ── Info overlay (types 1 & 2) ─────────────────────────────────────────────
  // Just positions the text now — ProfilePhoto's full-card LinearGradient
  // scrim (Figma spec) provides the darkening behind it.
  // Angular: .information-block { padding: 16px 12px }
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  // Angular: .heading3-semibold-16 { font-size: var(--font16) !important; font-family: var(--english-semibold-poppins) }
  overlayName: {
  
    fontSize: FontSize.font16,
    color: Colors.white,
    marginBottom: 2,
  },
  // Angular: .body2-regular-14.white-color { font-size: var(--font14) !important;
  // font-family: var(--english-regular-poppins) } — plain full-opacity white,
  // no alpha reduction in the real CSS (.information-block itself has no
  // opacity rule either).
  overlayDetail: {
   
    fontSize: FontSize.font14,
    color: Colors.white,
  },

  // ── Card bottom section (types 1 & 2) ──────────────────────────────────────
  cardBottom: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  cardBottomPadded: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  // ── Card info below photo (types 3, 4, 6, 7, 8) ────────────────────────────
  cardInfo: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  // Angular: `{{cardPadding}} mt-12` — cardPadding is '' for whoviewednumber/
  // viewedbyme (no extra horizontal padding class; this case's own
  // cardInset3 already provides the horizontal inset, so cardInfo would
  // double it up), leaving just `mt-12` = 12px margin-top, not 16.
  cardInfo3: {
    paddingTop: 12,
  },
  // Angular: type='8's name/detail block sits flush with the photo's own
  // left edge (both inherit only the outer card8's 8px padding) — confirmed
  // against the Figma render, not the extra indent a literal reading of the
  // Angular template's ml-8+cardPadding classes would otherwise suggest.
  // Angular: the name/detail block is `mt-12 ml-8` — indented 8px from the
  // card's own 8px padding, not flush with the photo's left edge.
  cardInfo8: {
    paddingTop: 12,
    paddingLeft: 8,
  },
  // Angular: type='8's detail line is `body2-regular-14` + `.black-color` with
  // `mt-6` — 14px black, not the shared style's 13px gray. nameText's own
  // marginBottom:4 plus this 2 makes up that 6px gap.
  // font-size: var(--font14) !important (body2-regular-14); family/color inherited
  // from the now-fixed shared detailText below.
  detailText8: {
    fontSize: FontSize.font14,
    color: Colors.black,
    marginTop: 2,
  },
  // Angular: .heading3-semibold-16 { font-size: var(--font16) !important; font-family:
  // var(--english-semibold-poppins) }. The class sets no color, and nothing up the
  // tree does either (global.scss's `body` only sets font-family, not color) — falls
  // through to the UA/Ionic default black, not this app's textPrimary token.
  nameText: {
   
    fontSize: FontSize.font16,
    color: Colors.black,
    marginBottom: 4,
  },
  // Angular: cases 6 & 7's detail line has no font-size class of its own — its
  // wrapping div carries `body2-regular-14` (var(--font14), english-regular-poppins)
  // and the label itself only `.black-color`, so it inherits that size/family. Was
  // 13px gray (a plain system-font guess); every other case that reaches this style
  // (3/4/8, via detailText3/4/8) already overrides fontSize+color explicitly so this
  // fix only actually changes cases 6 & 7's rendering.
  detailText: {
   
    fontSize: FontSize.font14,
    color: Colors.black,
    marginBottom: 2,
  },
  // Angular: type='3's detail line is .black-color + .body2-regular-14 (var(--font14)),
  // not this shared style's gray — scoped here rather than changed on the shared
  // style since variants 4/6/7/8 haven't been reviewed yet. Angular's own row is
  // `mt-6` (6px above the detail line); nameText's shared marginBottom (4px,
  // also unverified for those other variants) only supplies 4 of that, so the
  // remaining 2px is added here rather than on the shared style.
  detailText3: {
   
    fontSize: FontSize.font14,
    color: Colors.black,
    marginTop: 2,
  },
  // Angular: case 4's date div is itself `.color-545454.body3-regular-12` (var(--font12),
  // english-regular-poppins) — this base supplies the family/size, dateText4 the color.
  dateText: {
   
    fontSize: FontSize.font12,
    color: Colors.textTertiary,
    marginTop: 6,
  },

  // ── Success story (type 4) text block ─────────────────────────────────────
  // Angular: the block is `pl-16 pr-16 pt-16 pb-16` (a flat 16, not the shared
  // 12/10), the name is `heading4-medium-16` (Poppins-MEDIUM 16, not the shared
  // semibold), the location is `body2-regular-14` + `.black-color` (14/#000, not
  // 13/gray) and the date is `body3-regular-12` + `.color-545454` + `mt-8`.
  cardInfo4:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  
  detailText4: { fontSize: FontSize.font14, color: Colors.black },
  dateText4:   { color: '#545454', marginTop: 8 },

  // ── Primary action button ──────────────────────────────────────────────────
  // Angular: button.config.ts's PRIMARY_BTN.background → EButtonBackground.primary
  // → .primaryBg → --ion-color-primary, which is #B50033 (Colors.primaryDark)
  // — NOT Colors.primary (#C62828), despite the name.
  primaryBtn: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  // Angular: app-button-revamp's text span defaults to ctaFontSize=EButtonFontSize.regular14
  // ('body2-regular-14': var(--font14), english-regular-poppins, weight 400) — neither
  // ctaFontSize nor fontFamily is overridden at any call site in profile-card.component.html.
  // But the button's own `background` class IS EButtonBackground.primary ('primaryBg'),
  // and `ion-button.primaryBg span { font-weight: 500 }` in button-revamp.component.scss
  // outranks body2-regular-14's 400 (both !important-free, but the more specific nested
  // selector wins) — so the rendered weight is 500 (Medium), not 600 (SemiBold). The
  // span also always carries a static `letter-spacing-normal` class (`!important`),
  // so no letter-spacing belongs here either.
  primaryBtnText: {
   
    color: Colors.white,
    fontSize: FontSize.font14,
  },

  // ── Link / text button ─────────────────────────────────────────────────────
  // Angular: type='3's own wrapper is `mt-4`, type='5's is `mt-6` — a flat
  // 8px here previously guessed at both. See linkBtnMt4/linkBtnMt6 below.
  linkBtn: {},
  linkBtnMt4: {
    marginTop: 4,
  },
  linkBtnMt6: {
    marginTop: 6,
  },
  linkBtnCenter: {
    alignSelf: 'center',
  },
  // justifyContent:'center' matters once the CTA label wraps to 2 lines — a
  // vernacular translation (e.g. Tamil "அனைத்தையும் காணுங்கள்") runs longer
  // than English "See All" and wraps inside this card's narrow width. Without
  // it, Yoga sizes the row to the full available width once its Text child
  // needs 2 lines rather than shrink-wrapping to content, so the outer
  // linkBtnCenter's alignSelf:'center' had nothing narrower to center — text
  // and the chevron both sat flush left instead of centered as a block.
  linkBtnRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
  },
  // Angular: both call sites (type='3' "View full profile", type='5' "See All") use
  // app-button-revamp with the default ctaFontSize (EButtonFontSize.regular14 →
  // body2-regular-14: var(--font14), english-regular-poppins, weight 400) — neither
  // background (transparent) nor buttonSize (link) has a nested span override the way
  // primaryBg does, so it stays 14px Regular, not 13px/600 bold.
  linkBtnText: {
 
    fontSize: FontSize.font14,
    color: SEE_ALL_LINK_COLOR,
    // Centers each line against the others when a longer vernacular label
    // wraps to 2 lines — RN's Text defaults to left-aligning wrapped lines.
    textAlign: 'center',
    // Lets the label actually wrap within the row's available width instead
    // of overflowing past the card edge, which is what forced it into a
    // single line — measurable width is required for React Native's
    // Text wrapping to kick in inside a flexDirection:'row' parent.
    flexShrink: 1,
  },
  // Angular: the animated <img> is styled inline `width: 24px; height: 20px`
  // — not square, same asset/size as SwiperCard.tsx's own "See all" link.
  linkBtnIcon: { width: 24, height: 20 },

  // ── Liked label (type 2) ───────────────────────────────────────────────────
  // Angular: `body3-regular-12` (var(--font12), english-regular-poppins) + the
  // `newTextLable != '1'` branch's `.black-color` (`!important`, wins over the
  // fixed `likedColor` infoRedColor) — see likedLabelNew for the other branch.
  likedLabel: {
   
    fontSize: FontSize.font12,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  // Angular: when newTextLable === '1', the ngClass empties out (no black-color),
  // so likedColor's own `infoRedColor` (var(--ion-color-error-color): #DE2A68) applies.
  likedLabelNew: {
    color: Colors.inputError,
  },

  // ── Viewed overlay (type 3) — bottom of photo ─────────────────────────────
  // Angular: `.information-block-card-3 { padding: 8px 0px 12px 8px;
  // min-height: 60px }` — asymmetric padding (no right inset) and a real
  // min-height, not a flat 10/8.
  viewedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingRight: 0,
    paddingBottom: 12,
    paddingLeft: 8,
    minHeight: 60,
    gap: 6,
  },
  viewedIcon: {
    flexShrink: 0,
  },
  // Angular: default (non-"new") state — `body3-regular-12` (var(--font12),
  // english-regular-poppins) for viewedyou/whoviewednumber; viewedbyme gets
  // `font-10-nav` (var(--font10)) instead, see viewedTextSmall.
  viewedText: {
    flex: 1,
   
    fontSize: FontSize.font12,
    color: Colors.white,
  },
  // Angular: `[ngClass]="(cardType === 'viewedbyme') ? 'font-10-nav' : 'body3-regular-12'"`
  viewedTextSmall: {
    fontSize: FontSize.font10,
  },
  // Angular: profile-card.component.scss's `.newly-viewed { background:
  // #FCEAF0; padding: 6px 12px }` plus `.viewedbyme.newly-viewed`/
  // `.whoviewednumber.newly-viewed`'s own bottom-corner radius (12px,
  // matching the photo's own — this block sits flush at its bottom edge) —
  // a solid light-pink fill with its OWN padding/radius, not the default
  // dark-gradient overlay's 8/0/12/8 + no radius.
  viewedOverlayNew: {
    backgroundColor: '#FCEAF0',
    // Explicit per-edge values (not paddingVertical/paddingHorizontal) so
    // these actually override viewedOverlay's own per-edge values above —
    // Yoga resolves a specific edge over the equivalent shorthand regardless
    // of style-array merge order, so a shorthand here would have silently
    // lost to the base style's paddingTop/paddingLeft/etc.
    paddingTop: 6,
    paddingRight: 12,
    paddingBottom: 6,
    paddingLeft: 12,
    minHeight: undefined,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  viewedTextNew: {
    color: '#DE2A68',
  },

  // ── See-All card (type 5) ──────────────────────────────────────────────────
  // The wrapping View at the SwiperCard call site sets an explicit height,
  // but a plain Pressable doesn't auto-stretch to fill its parent's main-axis
  // size — without flex:1 here it just content-sizes, leaving the reserved
  // height as a dead gap below the visible card.
  seeAllCardOuter: {
    flex: 1,
  },
  // Angular: linear-gradient(to bottom, #FFF1FF, #FFFFFF) — real gradient now
  // via LinearGradient at the call site, not a flat approximation.
  seeAllCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  // Angular: .avatar-position — all 3 avatars the same size; only the middle
  // one is absolutely positioned to overlap the seam between the other two.
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: Colors.white,
    overflow: 'hidden',
    marginHorizontal: 2,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // RN's `position: absolute` (unlike web CSS) anchors to the parent's
  // origin rather than the element's own static flow position, so the
  // horizontal centering has to be done explicitly. `left` is computed to an
  // exact pixel value from the measured row width in AvatarRow above instead
  // of a percentage — see the comment on AvatarRow for why.
  avatarWrapAbsolute: {
    position: 'absolute',
    zIndex: 1,
  },
  // Middle avatar stays invisible for the one frame before avatarRow's width
  // is measured, instead of flashing at an unpositioned (left: 0) spot.
  avatarWrapHidden: {
    opacity: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },

  // ── Eye badge (type 8 — newly viewed) ─────────────────────────────────────
  eyeBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    maxWidth: '70%',
  },
  eyeIcon: {
    width: 14,
    height: 14,
    flexShrink: 0,
  },
  // Angular: `.color-de2a68.body3-regular-12` — var(--font12), english-regular-poppins,
  // weight 400 (regular, not the 600 previously guessed here).
  eyeBadgeText: {
   
    fontSize: FontSize.font12,
    color: Colors.inputError,
  },

  // ── Liked footer (type 8) — Angular: .liked-profile-card — a "ticket
  // stub" pill: peach-to-white gradient (rendered via LinearGradient at the
  // call site), only the left corners rounded, border on 3 sides (not
  // right), width:fit-content (not full-width) — confirmed matching almost
  // exactly between Figma and Angular's live CSS. ──────────────────────────
  likedFooter: {
    alignSelf: 'flex-start',
    marginTop: 6,   // detailText's own marginBottom:2 + this 6 = Angular's mt-8
    // Angular: the pill carries `ml-8 mr-8 mb-4` alongside its mt-8 — it sits
    // inset from the card's own 8px padding, not flush against it.
    marginLeft: 8,
    marginRight: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: Colors.white,
  },
  // Angular: `.body3-regular-12.black-color` — var(--font12), english-regular-poppins.
  likedFooterText: {
   
    fontSize: FontSize.font12,
    color: Colors.black,
  },
})
