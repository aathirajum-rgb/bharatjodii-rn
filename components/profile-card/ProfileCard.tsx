import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import ProfilePhoto, { type PhotoVariant } from '../profile-photo/ProfilePhoto'

// Angular: core/config/button.config.ts's SEE_ALL — textColor: 'linkColor'
// (--ion-color-link-color: #29339B), not the brand red.
const SEE_ALL_LINK_COLOR = '#29339B'

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
  likedStatus?: '0' | '1' | '2' | '3' | undefined
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
  dailyrecommendations: SCREEN_W * 0.8067,  // Angular: 80.667vmin (wider than ht1)
  matches:              SCREEN_W * 0.5556,
  likedyou:             SCREEN_W * 0.7222,
  viewedyou:            SCREEN_W * 0.7222,
  viewedbyme:           SCREEN_W * 0.6111,
  whoviewednumber:      SCREEN_W * 0.6111,
  similarprofiles:      SCREEN_W * 0.5556,
  viewlater:            SCREEN_W * 0.4556,
  likedprofile:         SCREEN_W * 0.7222,
  successstory:         SCREEN_W * 0.9111,
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
  likedprofile:         'matches',
  successstory:         'successStory',
}

// ─── InfoOverlay ──────────────────────────────────────────────────────────────
// Name + detail text pinned to the bottom of a photo with a dark gradient overlay.
// Angular: .information-block { background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,1)) }

interface InfoOverlayProps {
  name?:   string | undefined
  detail?: string | undefined
}

function InfoOverlay({ name, detail }: InfoOverlayProps) {
  if (!name && !detail) return null
  return (
    <View style={styles.infoOverlay}>
      {!!name   && <Text style={styles.overlayName}   numberOfLines={1}>{name}</Text>}
      {!!detail && <Text style={styles.overlayDetail} numberOfLines={1}>{detail}</Text>}
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
}: ProfileCardProps) {

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
  } as const

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
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH}>
            <InfoOverlay name={name} detail={basicDetail()} />
          </ProfilePhoto>

          {isDR && (
            <View style={styles.cardBottom}>
              <Pressable style={styles.primaryBtn} onPress={onPress}>
                {/* Angular: CTATXT.VIEWDETAILS translation key actually reads
                    "View profile" in English, not "View Details". */}
                <Text style={styles.primaryBtnText}>View profile</Text>
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
          <ProfilePhoto {...photoProps} height={photoH}>
            <InfoOverlay
              name={name}
              detail={[age, education].filter(Boolean).join(', ')}
            />
          </ProfilePhoto>

          <View style={[styles.cardBottom, isLikedYou && styles.cardBottomPadded]}>
            {isLikedYou && !!labelText() && (
              <Text style={styles.likedLabel} numberOfLines={2}>{labelText()}</Text>
            )}
            <Pressable
              style={styles.primaryBtn}
              onPress={canCall ? onPress : onLikePress}
            >
              <Text style={styles.primaryBtnText}>
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
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH} variant="viewedyou">
            <View style={[styles.viewedOverlay, isNew && styles.viewedOverlayNew]}>
              <CdnSvg
                uri={isNew ? IMG_CDN + 'revamp/eye-pink.svg' : IMG_CDN + 'viewed-icon-white.svg'}
                width={14}
                height={14}
                style={styles.viewedIcon}
              />
              <Text style={[styles.viewedText, isNew && styles.viewedTextNew]} numberOfLines={1}>{labelText()}</Text>
            </View>
          </ProfilePhoto>

          <View style={styles.cardInfo}>
            {!!name         && <Text style={styles.nameText}   numberOfLines={1}>{name}</Text>}
            {!!fullDetail() && <Text style={styles.detailText} numberOfLines={1}>{fullDetail()}</Text>}
            {/* Angular: ENUMS.EButtonText.viewProfiles → 'MATCHES.VIEW_PROFILE'
                → "View full profile" (locales/en.json:642), not "View Profile". */}
            <Pressable onPress={onPress} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>View full profile →</Text>
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
          <View style={styles.cardInfo}>
            {!!name     && <Text style={styles.nameText}   numberOfLines={1}>{name}</Text>}
            {!!location && <Text style={styles.detailText}>{location}</Text>}
            {!!date     && <Text style={styles.dateText}>{date}</Text>}
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
      const avatars = viewMoreList.slice(0, 3)
      return (
        <Pressable style={({ pressed }) => [styles.card, styles.seeAllCardOuter, pressed && { opacity: 0.85 }]} onPress={onViewMorePress}>
          <LinearGradient colors={['#FFF1FF', '#FFFFFF']} style={styles.seeAllCard}>
            <View style={styles.avatarRow}>
              {avatars.map((item, i) => (
                <View key={i} style={[styles.avatarWrap, i === 1 && styles.avatarWrapAbsolute]}>
                  <Image
                    source={{ uri: item.THUMBIMG }}
                    style={styles.avatarImg}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </View>
            <Pressable onPress={onViewMorePress} style={[styles.linkBtn, styles.linkBtnCenter, styles.linkBtnRow]}>
              <Text style={styles.linkBtnText}>{viewMoreContent}</Text>
              <CdnSvg uri={`${IMG_CDN}revamp/forward-icon-link.svg`} width={12} height={12} />
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
            {!!name          && <Text style={styles.nameText}   numberOfLines={1}>{name}</Text>}
            {!!basicDetail() && <Text style={styles.detailText}>{basicDetail()}</Text>}
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
            {!!name         && <Text style={styles.nameText}   numberOfLines={1}>{name}</Text>}
            {!!fullDetail() && <Text style={styles.detailText} numberOfLines={1}>{fullDetail()}</Text>}
          </View>
        </Pressable>
      )
    }

    // ── 8 · Liked Profile (profiles I liked) ─────────────────────────────────
    // Photo with optional eye-badge → name + details → "You liked her on…" footer.
    case 8: {
      return (
        <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
          <ProfilePhoto {...photoProps} height={photoH}>
            {isNewLabel && !!labelContent && (
              <View style={styles.eyeBadge}>
                <CdnSvg
                  uri={IMG_CDN + 'revamp/eye-pink.svg'}
                  width={14}
                  height={14}
                  style={styles.eyeIcon}
                />
                <Text style={styles.eyeBadgeText} numberOfLines={1}>{labelContent}</Text>
              </View>
            )}
          </ProfilePhoto>

          <View style={[styles.cardInfo, styles.cardInfoIndented]}>
            {!!name         && <Text style={styles.nameText}   numberOfLines={1}>{name}</Text>}
            {!!fullDetail() && <Text style={styles.detailText} numberOfLines={1}>{fullDetail()}</Text>}
          </View>

          {!!likedViewedDateText && (
            <View style={styles.likedFooter}>
              <Text style={styles.likedFooterText}>{likedViewedDateText}</Text>
            </View>
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

  // Card shell — matches Angular box-shadow: 0 2px 12px 0 rgba(0,0,0,0.34)
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // ── Info overlay (types 1 & 2) ─────────────────────────────────────────────
  // Angular: linear-gradient(rgba(0,0,0,0) → rgba(0,0,0,1))
  // Achieved here with a two-layer approach: transparent spacer + solid footer.
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 40,          // extra top pad lets gradient feel tall
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    borderBottomLeftRadius:  12,
    borderBottomRightRadius: 12,
  },
  overlayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  overlayDetail: {
    fontSize: 13,
    color: Colors.white,
    opacity: 0.88,
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
  cardInfoIndented: {
    paddingLeft: 20,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 6,
  },

  // ── Primary action button ──────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Link / text button ─────────────────────────────────────────────────────
  linkBtn: {
    marginTop: 8,
  },
  linkBtnCenter: {
    alignSelf: 'center',
  },
  linkBtnRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  linkBtnText: {
    fontSize: 13,
    color: SEE_ALL_LINK_COLOR,
    fontWeight: '600',
  },

  // ── Liked label (type 2) ───────────────────────────────────────────────────
  likedLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },

  // ── Viewed overlay (type 3) — bottom of photo ─────────────────────────────
  viewedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  viewedIcon: {
    width: 14,
    height: 14,
    flexShrink: 0,
  },
  viewedText: {
    flex: 1,
    fontSize: 11,
    color: Colors.white,
  },
  // Angular: profile-card.component.scss's .newly-viewed — solid light-pink
  // background (#FCEAF0), not the default dark gradient overlay.
  viewedOverlayNew: {
    backgroundColor: '#FCEAF0',
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
    marginHorizontal: -8,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // RN's `position: absolute` (unlike web CSS) anchors to the parent's
  // origin rather than the element's own static flow position, so the
  // horizontal centering has to be done explicitly.
  avatarWrapAbsolute: {
    position: 'absolute',
    left: '50%',
    marginLeft: -28,   // half of avatarWrap's width, to center it
    zIndex: 1,
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
  eyeBadgeText: {
    fontSize: 11,
    color: Colors.inputError,
    fontWeight: '600',
  },

  // ── Liked footer (type 8) ──────────────────────────────────────────────────
  likedFooter: {
    marginHorizontal: 10,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.primarySurface,
    borderRadius: 8,
  },
  likedFooterText: {
    fontSize: 12,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },
})
