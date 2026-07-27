import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Colors } from '../../constants/colors'
import ProfileCard, { PHOTO_HEIGHT, type CardSection, type CardVariant } from '../profile-card/ProfileCard'

// ─── Types ────────────────────────────────────────────────────────────────────

// One item in the swiper — maps to a ProfileCard
export interface SwiperItem {
  profileId?:  string | undefined
  name?:       string | undefined
  age?:        string | undefined
  height?:     string | undefined
  education?:  string | undefined
  location?:   string | undefined
  profileImg?: string | undefined
  avatarImg?:  string | undefined
  photos?:     string[] | undefined   // full PHOTO array (Matches carousel) — profileImg is photos[0]

  // Photo states
  isPhotoAvailable?:    boolean | undefined
  isPhotoProtect?:      boolean | undefined
  isAddPhotoRequest?:   boolean | undefined
  isViewPhotoRequest?:  boolean | undefined
  showReqPhotoElement?: boolean | undefined
  isNewlyJoined?:       boolean | undefined

  // Like state
  likedStatus?: '0' | '1' | '2' | '3' | undefined
  phoneViewed?: string | undefined   // raw '0'|'1'|'2'|'3' — drives after-like CTA label

  // Angular: FUNC.disableDontShow()/disableViewLater() — '1'/'3' = action already taken
  dontShowStatus?:  string | undefined   // raw STATUS
  viewLaterStatus?: string | undefined   // raw VIEWLATER

  // Profile badge fields (used by MatchesScreen, ViewProfile, etc.)
  isPaidMember?: boolean | undefined    // Angular: FUNC.IsPaidMember(profile)
  isIdVerified?: boolean | undefined    // Angular: FUNC.IsIDVerifiedMember(profile)
  occupation?:   string | undefined
  income?:       string | undefined
  caste?:        string | undefined

  // Labels / dates
  isNewLabel?:          boolean | undefined
  labelContent?:        string | undefined
  likedViewedDateText?: string | undefined
  date?:                string | undefined   // success story posted date (variant 4)

  // See-all card (variant 5)
  viewMoreList?:    { THUMBIMG: string }[] | undefined
  viewMoreContent?: string | undefined
}

export interface SwiperCardProps {
  // ── Section header ─────────────────────────────────────────────────────────
  swiperHeader?:   string | undefined    // section title
  newCount?:       number | undefined    // red count badge on the header
  showSeeAll?:     boolean | undefined   // show "See All →" link at the end

  // ── Card config ────────────────────────────────────────────────────────────
  // Maps to Angular profileCardType (1–8) and swipper-type (CardSection)
  cardVariant?:  CardVariant  | undefined
  cardSection?:  CardSection  | undefined

  // ── Data ──────────────────────────────────────────────────────────────────
  items: SwiperItem[]

  // ── Layout ────────────────────────────────────────────────────────────────
  // Explicit width override — normally omit this and let the card size itself
  // from cardSection instead (see PHOTO_HEIGHT import below); Angular's cards
  // are square per section (card-htN CSS classes pair identical min-width/
  // min-height), so a flat one-size-fits-all default here would misshape
  // every section except the one it happens to match by coincidence.
  cardWidth?: number | undefined

  // ── Callbacks ─────────────────────────────────────────────────────────────
  onCardPress?:     ((item: SwiperItem, index: number) => void) | undefined
  onLikePress?:     ((item: SwiperItem, index: number) => void) | undefined
  onViewMorePress?: (() => void) | undefined
  onSeeAllPress?:   (() => void) | undefined
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_GAP   = 12
const CARD_PAD   = 16   // horizontal padding on the FlatList

// ─── SwiperCard ───────────────────────────────────────────────────────────────
// Horizontal scrollable section of ProfileCards.
// Equivalent of Angular's app-swiper-card / app-swiper — used on the Home page
// (Who Liked You, Who Viewed You, New Matches, Similar Profiles sections).

export default function SwiperCard({
  swiperHeader,
  newCount,
  showSeeAll = true,
  cardVariant = 1,
  cardSection = 'matches',
  items,
  cardWidth,
  onCardPress,
  onLikePress,
  onViewMorePress,
  onSeeAllPress,
}: SwiperCardProps) {
  // Angular: card-htN classes set min-width === min-height per section — reuse
  // ProfileCard's own per-section ratio table as the default card width unless
  // a caller has a genuine reason to override it.
  const resolvedCardWidth = cardWidth ?? PHOTO_HEIGHT[cardSection]

  if (!items || items.length === 0) return null

  return (
    <View style={styles.container}>
      {/* ── Section header ── */}
      {(!!swiperHeader || newCount !== undefined) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {!!swiperHeader && (
              <Text style={styles.headerTitle} numberOfLines={1}>{swiperHeader}</Text>
            )}
            {typeof newCount === 'number' && newCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{newCount > 99 ? '99+' : newCount}</Text>
              </View>
            )}
          </View>

          {showSeeAll && !!onSeeAllPress && (
            <Pressable onPress={onSeeAllPress} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See All →</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Horizontal card list ── */}
      <FlatList
        data={items}
        keyExtractor={(item, i) => item.profileId ?? String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { gap: CARD_GAP }]}
        // Snap to each card for a clean swipe feel
        snapToInterval={resolvedCardWidth + CARD_GAP}
        decelerationRate="fast"
        renderItem={({ item, index }) => (
          <View style={{ width: resolvedCardWidth }}>
            <ProfileCard
              variant={cardVariant}
              section={cardSection}
              profileId={item.profileId}
              name={item.name}
              age={item.age}
              height={item.height}
              education={item.education}
              location={item.location}
              profileImg={item.profileImg}
              avatarImg={item.avatarImg}
              isPhotoAvailable={item.isPhotoAvailable}
              isPhotoProtect={item.isPhotoProtect}
              isAddPhotoRequest={item.isAddPhotoRequest}
              isViewPhotoRequest={item.isViewPhotoRequest}
              showReqPhotoElement={item.showReqPhotoElement}
              isNewlyJoined={item.isNewlyJoined}
              likedStatus={item.likedStatus}
              isNewLabel={item.isNewLabel}
              labelContent={item.labelContent}
              likedViewedDateText={item.likedViewedDateText}
              date={item.date}
              viewMoreList={item.viewMoreList}
              viewMoreContent={item.viewMoreContent}
              onPress={() => onCardPress?.(item, index)}
              onLikePress={() => onLikePress?.(item, index)}
              onViewMorePress={onViewMorePress}
            />
          </View>
        )}
        ListFooterComponent={
          showSeeAll && onSeeAllPress ? (
            // "See All" ghost card at the end of the list
            <Pressable
              style={[styles.seeAllCard, { width: resolvedCardWidth * 0.7, height: resolvedCardWidth * 1.3 }]}
              onPress={onSeeAllPress}
            >
              <Text style={styles.seeAllCardText}>See All</Text>
              <Text style={styles.seeAllArrow}>→</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: CARD_PAD,
    marginBottom:      12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
  },
  headerTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.textPrimary,
    flexShrink: 1,
  },
  countBadge: {
    backgroundColor:   Colors.primary,
    borderRadius:      10,
    minWidth:          22,
    height:            22,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 5,
  },
  countText: {
    color:      Colors.white,
    fontSize:   11,
    fontWeight: '700',
    lineHeight: 14,
  },
  seeAllBtn: {
    paddingLeft: 12,
  },
  seeAllText: {
    fontSize:   13,
    color:      Colors.primary,
    fontWeight: '600',
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: CARD_PAD,
  },

  // ── "See All" ghost card at list end ──────────────────────────────────────
  seeAllCard: {
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       Colors.border,
    borderStyle:       'dashed',
    backgroundColor:   Colors.surfaceAlt,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    // height set inline at the call site (proportional to resolvedCardWidth)
  },
  seeAllCardText: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.primary,
  },
  seeAllArrow: {
    fontSize:   22,
    color:      Colors.primary,
    fontWeight: '700',
  },
})
