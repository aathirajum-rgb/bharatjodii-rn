// "Liked profiles (N)" tabbed section (Figma node 1034:4787) — the only
// desktop Home section with real sub-navigation: a 2-tab segmented control
// ("Liked by you" / "Liked you") swapping which list the carousel below shows.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CarouselSection, PhotoOverlayCard, useOppGenderAvatarUrl } from './DesktopHomeShared'
import { ProfileBadge } from '../matches/matchesCard.shared'
import type { LikedTab } from '../../screens/home/homeGating'
import type { SwiperItem } from '../swiper-card/SwiperCard'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CARD_W = 276
const PHOTO_SIZE = 260

type Props = {
  likedTab: LikedTab
  onTabChange: (tab: LikedTab) => void
  likedByMe: SwiperItem[]
  likedByMeTotal: number
  likedMe: SwiperItem[]
  likedMeTotal: number
  // Angular: FUNC.getLogInGender() == 'F' gates the Verified-ID badge to female
  // viewers only (matches-card.component.html); oppGender is the shown profile's
  // gender, so oppGender === 'M' means the viewer is female — same convention
  // as MatchCard (MatchesScreen.tsx) / MatchCardDesktop.tsx.
  oppGender: 'M' | 'F'
  onCardPress: (item: SwiperItem) => void
  onSeeAllPress?: (() => void) | undefined
}

export default function LikedProfilesSection({
  likedTab, onTabChange, likedByMe, likedByMeTotal, likedMe, likedMeTotal, oppGender, onCardPress, onSeeAllPress,
}: Props) {
  const { t } = useTranslation()
  const avatarFallback = useOppGenderAvatarUrl()

  // Angular: app-swiper.component.ts's hasLikedYouData()/hasLikedByMeData() +
  // showLikedProfileTabs — the tab switcher only makes sense when BOTH sides
  // have data; otherwise it's a dead "(0)" pill with nothing to switch to.
  // NOT ORing in `.length > 0` here (unlike Angular) — this port's likedMe/
  // likedByMe arrays can keep showing leftover mock placeholder data when the
  // real fetch legitimately returns zero items (HomeScreen's loadHome() only
  // calls setLikedMe/setLikedByMe when the result is non-empty), which
  // previously kept a "(0)" tab visible. likedByMeTotal/likedMeTotal are
  // already the trustworthy comTotalFor(comCount, ...) values by the time
  // they reach this component — no mock fallback on those.
  const hasLikedByMe = likedByMeTotal > 0
  const hasLikedMe   = likedMeTotal > 0
  const showTabs = hasLikedByMe && hasLikedMe

  const items = showTabs
    ? (likedTab === 'likedbyme' ? likedByMe : likedMe)
    : hasLikedByMe ? likedByMe : likedMe
  const total = showTabs
    ? (likedTab === 'likedbyme' ? likedByMeTotal : likedMeTotal)
    : hasLikedByMe ? likedByMeTotal : likedMeTotal

  if (likedByMeTotal === 0 && likedMeTotal === 0) return null

  return (
    <View style={{ gap: 24 }}>
      {showTabs && (
        <View style={s.tabs}>
          <Pressable
            style={[s.tabPill, likedTab === 'likedbyme' && s.tabPillActive]}
            onPress={() => onTabChange('likedbyme')}
          >
            <Text style={[s.tabText, likedTab === 'likedbyme' && s.tabTextActive]}>
              {`Liked by you (${likedByMeTotal})`}
            </Text>
          </Pressable>
          <Pressable
            style={[s.tabPill, likedTab === 'likedyou' && s.tabPillActive]}
            onPress={() => onTabChange('likedyou')}
          >
            <Text style={[s.tabText, likedTab === 'likedyou' && s.tabTextActive]}>
              {`Liked you (${likedMeTotal})`}
            </Text>
          </Pressable>
        </View>
      )}

      <CarouselSection
        title={`Liked profiles (${total})`}
        data={items}
        cardWidth={CARD_W}
        gap={20}
        keyExtractor={(item, i) => item.profileId ?? String(i)}
        onSeeAllPress={onSeeAllPress}
        renderCard={item => (
          <Pressable style={s.card} onPress={() => onCardPress(item)}>
            <View style={s.photoInset}>
              <PhotoOverlayCard
                width={PHOTO_SIZE}
                height={PHOTO_SIZE}
                borderRadius={20}
                photoUri={item.profileImg}
                fallback={<CdnSvg uri={avatarFallback} width={PHOTO_SIZE * 0.4} height={PHOTO_SIZE * 0.4} />}
              />
            </View>
            <View style={s.body}>
              {/* Figma "Jodii Desktop" node 629:11046 ("Liked profiles") — same
                  paid/verified badge treatment MatchCardDesktop.tsx already
                  implements for that exact node; this card was missing it
                  entirely even though isPaidMember/isIdVerified were already
                  present on every item. */}
              {(item.isPaidMember || (item.isIdVerified && oppGender === 'M')) && (
                <View style={s.badges}>
                  {item.isPaidMember && (
                    <ProfileBadge variant="paid" text={t('MENU.PAID_BADGE')} />
                  )}
                  {item.isIdVerified && oppGender === 'M' && (
                    <ProfileBadge variant="verified" text={t('MATCHES.VERIFIED_ID')} />
                  )}
                </View>
              )}
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              <Text style={s.meta} numberOfLines={1}>
                {[item.age, item.height, item.education].filter(Boolean).join(', ')}
              </Text>
              {!!item.likedViewedDateText && (
                <LinearGradient
                  colors={['#ffebd3', '#ffffff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.datePill}
                >
                  <Text style={s.dateText} numberOfLines={1}>{item.likedViewedDateText}</Text>
                </LinearGradient>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  tabs: {
    flexDirection:     'row',
    backgroundColor:   '#e5b582',
    borderRadius:      12,
    padding:           4,
    marginHorizontal:  12,
    gap:               0,
  },
  tabPill: {
    flex:              1,
    height:            46,
    borderRadius:      8,
    alignItems:        'center',
    justifyContent:    'center',
  },
  tabPillActive: { backgroundColor: '#ffffff' },
  tabText:       { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: '#000000' },
  tabTextActive: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, color: '#8b4800' },

  card: {
    width:           CARD_W,
    backgroundColor: '#ffffff',
    borderRadius:    24,
    overflow:        'hidden',
    shadowColor:     '#000000',
    shadowOpacity:   0.24,
    shadowRadius:    40,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       6,
  },
  photoInset: { padding: 8 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, lineHeight: 20, color: '#000000' },
  meta: { fontFamily: SemanticFontsEnglish.subheadingEnglishRegular, fontSize: 14, lineHeight: 20, color: '#000000' },
  datePill: {
    alignSelf:                'flex-start',
    borderTopLeftRadius:      24,
    borderBottomLeftRadius:   24,
    borderTopRightRadius:     4,
    borderBottomRightRadius:  4,
    height:                   24,
    paddingHorizontal:        10,
    justifyContent:           'center',
  },
  dateText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, lineHeight: 20, color: '#000000' },
})
