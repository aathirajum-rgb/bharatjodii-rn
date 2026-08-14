import { useCallback, useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import ProfilePhoto from '../profile-photo/ProfilePhoto'
import Badge from '../badge/Badge'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { showLikeCTA, showAfterLikeCTA } from '../matches/matchesCard.shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoItem {
  IMAGE: string
}

// Mirrors Angular likedStatus string — drives CTA layout
// '0' = not yet liked  '1' = liked (waiting)  '2' = mutual  '3' = shortlisted
export type LikedStatus = '0' | '1' | '2' | '3'

export interface MatchesCardProps {
  // ── Profile info ──────────────────────────────────────────────────────────
  name?:       string | undefined
  age?:        string | undefined
  height?:     string | undefined
  education?:  string | undefined
  occupation?: string | undefined
  caste?:      string | undefined
  city?:       string | undefined
  state?:      string | undefined
  income?:     string | undefined  // shown only to female users (pass undefined for male)

  // ── Photos ───────────────────────────────────────────────────────────────
  profileImageArr?: PhotoItem[] | undefined   // ≥2 items → swiper; 1 item → single photo
  defaultImg?:      string | undefined
  photoHeight?:     number | undefined        // default: derived from screen width

  // ── Photo states (forwarded to ProfilePhoto) ──────────────────────────────
  isPhotoAvailable?:    boolean | undefined
  isPhotoProtect?:      boolean | undefined
  isAddPhotoRequest?:   boolean | undefined
  isViewPhotoRequest?:  boolean | undefined
  showReqPhotoElement?: boolean | undefined
  isNewlyJoined?:       boolean | undefined

  // ── Like / contact status ─────────────────────────────────────────────────
  likedStatus?: LikedStatus | undefined
  phoneViewed?: string | undefined  // '1'/'3' → phone already viewed

  // ── Badges ────────────────────────────────────────────────────────────────
  isPaidMember?:          boolean | undefined
  isIdVerifiedMember?:    boolean | undefined
  isProfileHighlighter?:  boolean | undefined  // "Featured Profile" label above photo

  // ── Activity / label row (shortlist, viewed, liked sections) ──────────────
  isActivityLabel?: boolean | undefined
  LabelText?:       string | undefined
  showLikedLbl?:    boolean | undefined   // "You liked this profile on…" row

  // ── Photo overlays ────────────────────────────────────────────────────────
  isShortlisted?:   boolean | undefined
  showDontShowCta?: boolean | undefined
  dontShowContent?: string | undefined
  showThreeDots?:   boolean | undefined

  // ── Variant ───────────────────────────────────────────────────────────────
  // 'matches' | 'dailyRecommendation' | 'activity' | 'viewedyou' | 'likedyou' | etc.
  variant?: string | undefined

  // ── Callbacks ─────────────────────────────────────────────────────────────
  onViewProfile?:      (() => void) | undefined
  onLike?:             (() => void) | undefined
  onDontShow?:         (() => void) | undefined
  onViewLater?:        (() => void) | undefined
  onCall?:             (() => void) | undefined
  onWhatsApp?:         (() => void) | undefined
  onAddPhotoRequest?:  (() => void) | undefined
  onViewPhotoRequest?: (() => void) | undefined
  onShortlistPress?:   (() => void) | undefined
  onDontShowPhotoPress?: (() => void) | undefined
  onThreeDotPress?:    (() => void) | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width
const DEFAULT_PHOTO_H = Math.round(SCREEN_W * 0.85)

const CDN = CDN_SVG
const ICONS = {
  call:      CDN + 'revamp/call-revamp.svg',
  whatsapp:  CDN + 'whatsapp-revamp.svg',
  viewed:    CDN + 'viewed-icon-updated.svg',
  liked:     CDN + 'liked-new.svg',
  paidTag:   CDN + 'revamp/paid-tag-revamp.svg',
  verifiedTag: CDN + 'viewprofile/verified-tag-img.svg',
}

// ─── CTA logic (mirrors Angular FUNC helpers) ─────────────────────────────────
// showLikeCTA/showAfterLikeCTA imported from matchesCard.shared — same rule
// MatchesScreen, MatchCardDesktop, and ViewProfile already share; this component
// used to keep its own private, functionally-identical copy of both.

function getPrimaryBtnLabel(likedStatus?: LikedStatus, phoneViewed?: string): string {
  if (likedStatus === '0') return 'Like Her'
  if (likedStatus === '3') return 'Call Now'
  if (phoneViewed === '1' || phoneViewed === '3') return 'Call Now'
  return 'View Contact'
}

// ─── Photo swiper with dots ────────────────────────────────────────────────────

interface PhotoSwiperProps {
  images:    PhotoItem[]
  height:    number
  photoProps: Omit<React.ComponentProps<typeof ProfilePhoto>, 'profileImage' | 'height'>
  onPress?:  (() => void) | undefined
}

function PhotoSwiper({ images, height, photoProps, onPress }: PhotoSwiperProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0] != null) {
      setActiveIndex(viewableItems[0].index ?? 0)
    }
  }, [])

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

  const cardW = SCREEN_W - 32  // 16px padding on each side

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={images}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length: cardW, offset: cardW * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width: cardW, height }}>
            <ProfilePhoto
              {...photoProps}
              profileImage={item.IMAGE}
              height={height}
              onPress={onPress}
            />
          </View>
        )}
        style={{ marginHorizontal: 16 }}
      />

      {/* Dot pagination — Angular: swiper pagination dynamicBullets */}
      {images.length > 1 && (
        <View style={styles.dotsRow}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

// ─── MatchesCard ──────────────────────────────────────────────────────────────
// Equivalent of Angular's app-matches-card.
// Stateless regarding like status — parent owns and updates likedStatus.

export default function MatchesCard({
  name,
  age,
  height:     profileHeight,
  education,
  occupation,
  caste,
  city,
  state,
  income,
  profileImageArr = [],
  defaultImg,
  photoHeight = DEFAULT_PHOTO_H,
  isPhotoAvailable    = true,
  isPhotoProtect      = false,
  isAddPhotoRequest   = false,
  isViewPhotoRequest  = false,
  showReqPhotoElement = true,
  isNewlyJoined       = false,
  likedStatus         = '0',
  phoneViewed,
  isPaidMember        = false,
  isIdVerifiedMember  = false,
  isProfileHighlighter = false,
  isActivityLabel     = false,
  LabelText,
  showLikedLbl        = false,
  isShortlisted       = false,
  showDontShowCta     = false,
  dontShowContent,
  showThreeDots       = false,
  variant             = 'matches',
  onViewProfile,
  onLike,
  onDontShow,
  onViewLater,
  onCall,
  onWhatsApp,
  onAddPhotoRequest,
  onViewPhotoRequest,
  onShortlistPress,
  onDontShowPhotoPress,
  onThreeDotPress,
}: MatchesCardProps) {

  // ── Profile detail string (mirrors Angular bindBasicView) ──────────────────
  function basicView(): string {
    const parts: string[] = []
    if (age)        parts.push(age)
    if (profileHeight) parts.push(profileHeight)
    if (caste)      parts.push(caste)
    if (education)  parts.push(education)
    if (occupation) parts.push(occupation)
    if (income)     parts.push(income)  // caller only passes for female users

    const location = [city, state].filter(Boolean).join(', ')
    if (location)   parts.push(location)

    return parts.join('  |  ')
  }

  // ── Shared photo props ─────────────────────────────────────────────────────
  const photoProps = {
    defaultImage:       defaultImg,
    isPhotoAvailable,
    isPhotoProtect,
    isAddPhotoRequest,
    isViewPhotoRequest,
    showReqPhotoElement,
    isNewlyJoined,
    isShortlisted,
    showDontShow:    showDontShowCta,
    dontShowLabel:   dontShowContent,
    showThreeDots,
    likedStatus,
    variant:         'matches' as const,
    onAddPhotoRequest,
    onViewPhotoRequest,
    onShortlistPress,
    onDontShowPress: onDontShowPhotoPress,
    onThreeDotPress,
  }

  const hasMultiplePhotos = profileImageArr.length > 1
  const singleImage = profileImageArr[0]?.IMAGE ?? ''

  const isProfileBadge = isPaidMember || isIdVerifiedMember

  // CTA state
  const showLike    = showLikeCTA(likedStatus)
  const showContact = showAfterLikeCTA(likedStatus)

  return (
    <View style={[styles.card, isProfileHighlighter && styles.cardHighlighted]}>

      {/* ── "Featured Profile" label ── */}
      {isProfileHighlighter && (
        <Text style={styles.featuredLabel}>Featured Profile</Text>
      )}

      {/* ── Photo area ── */}
      {hasMultiplePhotos ? (
        <PhotoSwiper
          images={profileImageArr}
          height={photoHeight}
          photoProps={photoProps}
          onPress={onViewProfile}
        />
      ) : (
        <View style={styles.singlePhotoWrap}>
          <ProfilePhoto
            {...photoProps}
            profileImage={singleImage}
            height={photoHeight}
            onPress={onViewProfile}
          />
        </View>
      )}

      {/* ── Paid / Verified badges ── */}
      {isProfileBadge && (
        <Pressable style={styles.badgeRow} onPress={onViewProfile}>
          {isPaidMember && (
            <Badge
              variant="paid"
              text="Paid Member"
              imageUrl={ICONS.paidTag}
            />
          )}
          {isIdVerifiedMember && (
            <Badge
              variant="verified"
              text="ID Verified"
              imageUrl={ICONS.verifiedTag}
              style={{ marginLeft: isPaidMember ? 8 : 0 }}
            />
          )}
        </Pressable>
      )}

      {/* ── Activity label (shortlisted / viewed / liked sections) ── */}
      {isActivityLabel && !!LabelText && (
        <View style={styles.activityRow}>
          <CdnSvg uri={ICONS.viewed} width={16} height={16} style={styles.activityIcon} />
          <Text style={styles.activityText} numberOfLines={2}>{LabelText}</Text>
        </View>
      )}

      {/* ── "You liked this profile on…" label ── */}
      {showLikedLbl && !!LabelText && (
        <View style={styles.likedLblRow}>
          <CdnSvg uri={ICONS.liked} width={20} height={20} style={styles.likedLblIcon} />
          <Text style={styles.likedLblText} numberOfLines={2}>{LabelText}</Text>
        </View>
      )}

      {/* ── Name row + Call + WhatsApp ── */}
      <View style={styles.nameRow}>
        <Pressable style={styles.namePressable} onPress={onViewProfile}>
          <Text style={styles.nameText} numberOfLines={1}>{name ?? ''}</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onCall}>
          <CdnSvg uri={ICONS.call} width={24} height={24} style={styles.rowIcon} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={onWhatsApp}>
          <CdnSvg uri={ICONS.whatsapp} width={24} height={24} style={styles.rowIcon} />
        </Pressable>
      </View>

      {/* ── Basic view (age | height | caste | education | location) ── */}
      <Pressable onPress={onViewProfile} style={styles.basicViewWrap}>
        <Text style={styles.basicViewText}>{basicView()}</Text>
      </Pressable>

      {/* ── "View Profile →" link (not for dailyRecommendation) ── */}
      {variant !== 'dailyRecommendation' && (
        <Pressable onPress={onViewProfile} style={styles.linkBtnWrap}>
          <ButtonRevamp
            label="View Profile"
            variant="link"
            size="small"
            icon="forward-icon-link"
            iconPosition="end"
            onPress={onViewProfile}
          />
        </Pressable>
      )}

      {/* ── CTA section ── */}
      <View style={[styles.ctaSection, showContact && styles.ctaSectionBg]}>

        {/* After-like content message */}
        {showContact && (
          <Text style={styles.afterLikeText} numberOfLines={2}>
            {likedStatus === '2'
              ? 'It\'s a mutual match! You can now contact each other.'
              : 'You\'ve liked this profile. View their contact details below.'}
          </Text>
        )}

        <View style={styles.ctaRow}>
          {/* Don't Show + View Later (left pair) — only before like */}
          {showLike && (
            <View style={styles.ctaLeftPair}>
              <ButtonRevamp
                label="Don't Show"
                variant="ghost"
                size="medium"
                onPress={onDontShow}
                style={styles.ctaSecBtn}
              />
              <ButtonRevamp
                label="View Later"
                variant="ghost"
                size="medium"
                onPress={onViewLater}
                style={[styles.ctaSecBtn, styles.ctaSecBtnRight]}
              />
            </View>
          )}

          {/* Primary button */}
          <View style={showLike ? styles.ctaPrimaryLike : styles.ctaPrimaryFull}>
            <ButtonRevamp
              label={getPrimaryBtnLabel(likedStatus, phoneViewed)}
              variant={showLike ? 'primary' : 'primary'}
              size={showLike ? 'large' : 'standard'}
              icon={showLike ? 'like-img' : 'call-img-white'}
              iconPosition="start"
              fullWidth
              onPress={showLike ? onLike : onCall}
            />
          </View>
        </View>
      </View>

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor:  Colors.surface,
    borderRadius:     16,
    overflow:         'hidden',
    marginBottom:     24,
    paddingBottom:    16,
    shadowColor:      Colors.shadow,
    shadowOpacity:    0.10,
    shadowRadius:     12,
    shadowOffset:     { width: 0, height: 3 },
    elevation:        4,
  },
  cardHighlighted: {
    paddingTop: 32,
  },
  featuredLabel: {
    fontSize:          14,
    fontWeight:        '500',
    color:             Colors.textPrimary,
    paddingHorizontal: 16,
    paddingBottom:     8,
  },

  // ── Single photo ──────────────────────────────────────────────────────────
  singlePhotoWrap: {
    marginHorizontal: 16,
  },

  // ── Swiper dots ───────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    marginTop:      8,
    gap:            4,
  },
  dot: {
    borderRadius: 4,
    height:       6,
  },
  dotActive: {
    width:           18,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width:           6,
    backgroundColor: Colors.inputBorder,
  },

  // ── Badge row ─────────────────────────────────────────────────────────────
  badgeRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingLeft:    24,
    marginTop:      16,
    flexWrap:       'wrap',
    gap:            8,
  },

  // ── Activity label ────────────────────────────────────────────────────────
  activityRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingHorizontal: 16,
    marginTop:         16,
    gap:               8,
  },
  activityIcon: {
    width:     16,
    height:    16,
    marginTop:  2,
    flexShrink: 0,
  },
  activityText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
    lineHeight: 20,
  },

  // ── Liked label row ───────────────────────────────────────────────────────
  likedLblRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    paddingHorizontal: 16,
    marginTop:         8,
    gap:               4,
  },
  likedLblIcon: {
    width:      20,
    height:     20,
    flexShrink: 0,
  },
  likedLblText: {
    flex:       1,
    fontSize:   12,
    color:      Colors.primaryDeep,
    lineHeight: 18,
    marginTop:  2,
  },

  // ── Name row ──────────────────────────────────────────────────────────────
  nameRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    marginTop:         12,
    gap:               12,
  },
  namePressable: {
    flex: 1,
  },
  nameText: {
    fontSize:   18,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  iconBtn: {
    width:  36,
    height: 36,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  rowIcon: {
    width:  24,
    height: 24,
  },

  // ── Basic view ────────────────────────────────────────────────────────────
  basicViewWrap: {
    paddingHorizontal: 16,
    marginTop:          4,
    minHeight:         44,
    justifyContent:    'center',
  },
  basicViewText: {
    fontSize:   14,
    color:      Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Link button ───────────────────────────────────────────────────────────
  linkBtnWrap: {
    paddingHorizontal: 16,
    marginTop:          2,
    alignSelf:         'flex-start',
  },

  // ── CTA section ───────────────────────────────────────────────────────────
  ctaSection: {
    paddingHorizontal: 16,
    marginTop:         16,
  },
  ctaSectionBg: {
    backgroundColor: Colors.selectionBg,
    borderRadius:    12,
    marginHorizontal: 16,
    paddingVertical:  16,
    marginTop:        12,
  },
  afterLikeText: {
    fontSize:     14,
    fontWeight:   '500',
    color:        Colors.textPrimary,
    textAlign:    'center',
    marginBottom: 12,
    lineHeight:   20,
  },
  ctaRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
  },
  ctaLeftPair: {
    flex:           1,
    flexDirection:  'row',
    gap:            8,
  },
  ctaSecBtn: {
    flex: 1,
  },
  ctaSecBtnRight: {
    marginLeft: 0,
  },
  ctaPrimaryLike: {
    width: '35%',
  },
  ctaPrimaryFull: {
    flex: 1,
  },
})
