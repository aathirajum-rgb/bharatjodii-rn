// Desktop/laptop layout for the Home screen (Figma "Jodii Desktop -
// Registration", node 161:10324). Purely presentational — HomeScreen.tsx owns
// all data/state/handler logic (same split MatchesDesktopLayout.tsx/
// ViewProfileDesktopLayout.tsx already use) and passes it down as props; this
// file only arranges that data into the desktop top-nav + left-sidebar +
// scrollable-main-column layout.
//
// Card rendering: sections that only render plain Image/View content
// (OfferBanner, CompleteProfileCard, ExploreCategoriesSection,
// SelfHelpVideosSection, HelpSection) are imported straight from
// HomeScreen.tsx and reused as-is. Sections that render profile CARDS
// (All matches, Profiles who viewed me, Today's matches, Newly joined,
// Profiles you viewed, Liked profiles, Success stories) use
// SwiperCardDesktop instead of mobile's SwiperCard/ProfileCard — the latter
// hardcodes its photo height and card width from
// `Dimensions.get('window').width`, which is the FULL desktop browser width
// here (not a mobile viewport), producing ~800×1120px cards with no prop to
// override it. Same problem MatchesDesktopLayout.tsx solved with a dedicated
// MatchCardDesktop; SwiperCardDesktop is that fix for Home's simpler cards.
import { useEffect, useState } from 'react'
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import HomeSidebar from '../../components/home-sidebar/HomeSidebar'
import SwiperCardDesktop from '../../components/swiper-card/SwiperCardDesktop'
import type { SwiperItem } from '../../components/swiper-card/SwiperCard'
import { Colors } from '../../constants/colors'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import type { ExploreCategory, CompleteProfileCard } from '../../service/homeService'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import type { LikedTab, HeroBannerVariant } from './homeGating'
import HeroBanner, { type HeroBannerContent } from './HeroBanner'
import AssistBanner, { type AssistBannerContent } from './AssistBanner'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import ForceUpdateCard from './ForceUpdateCard'
import {
  CompleteProfileSection, ExploreCategoriesSection,
  SelfHelpVideosSection, HelpSection, type HelpVideo,
} from './HomeScreen'

const MAIN_WIDTH   = 700
// ExploreCategoriesSection's shared catGrid style bakes in paddingHorizontal:16
// (32px total) + gap:8 — both have to come out of MAIN_WIDTH before halving,
// or two tiles overflow the row and flexWrap pushes the second down a line.
const CAT_TILE_W   = (MAIN_WIDTH - 32 - 8) / 2
const VIDEO_CARD_W = 320
const VIDEO_CARD_H = 180
const SMALL_CARD_W = 160
const SMALL_CARD_H = 160
const STORY_CARD_W = 220
const STORY_CARD_H = 220

export interface HomeDesktopLayoutProps {
  navigation:      any
  userName:        string
  completionPct:   number
  heroBannerVariant: HeroBannerVariant
  heroBannerContent: HeroBannerContent | null
  onHeroBannerPress: () => void
  onHeroBannerDismiss: () => void
  assistContent:     AssistBannerContent | null
  onAssistPress:      () => void
  onAssistDismiss:    () => void
  activeSticky:       'forceUpdate' | 'profileValidation' | null
  stickyText:         string
  stickyCtaLabel:     string
  onStickyPress:      () => void
  onStickyClose:      () => void
  allMatches:      SwiperItem[]
  allMatchesTotal: number
  viewedMe:        SwiperItem[]
  viewedMeTotal:   number
  todayMatches:    SwiperItem[]
  todayTotal:      number
  newlyJoined:     SwiperItem[]
  newlyJoinedTotal: number
  profilesViewed:  SwiperItem[]
  profilesViewedTotal: number
  completeCards:   CompleteProfileCard[]
  onCompleteProfileCardPress: (card: CompleteProfileCard) => void
  likedTab:        LikedTab
  onLikedTabChange:(tab: LikedTab) => void
  likedByMe:       SwiperItem[]
  likedByMeTotal:  number
  likedMe:         SwiperItem[]
  likedMeTotal:    number
  categories:      ExploreCategory[]
  stories:         SwiperItem[]
  videos:          HelpVideo[]
  selfHelpVisible: boolean
  customerCare:    { phone: string; whatsapp: string }
  onCardPress:     (item: SwiperItem) => void
  onTabPress:      (tab: FooterTab) => void
}

export default function HomeDesktopLayout({
  navigation, userName,
  heroBannerVariant, heroBannerContent, onHeroBannerPress, onHeroBannerDismiss,
  assistContent, onAssistPress, onAssistDismiss,
  activeSticky, stickyText, stickyCtaLabel, onStickyPress, onStickyClose,
  allMatches, allMatchesTotal, viewedMe, viewedMeTotal,
  todayMatches, todayTotal, newlyJoined, newlyJoinedTotal,
  profilesViewed, profilesViewedTotal, completeCards, onCompleteProfileCardPress,
  likedTab, onLikedTabChange, likedByMe, likedByMeTotal, likedMe, likedMeTotal,
  categories, stories, videos, selfHelpVisible, customerCare, onCardPress, onTabPress,
}: HomeDesktopLayoutProps) {
  const [userId, setUserId] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    Promise.all([
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.PHOTO_URL),
    ]).then(([id, photo]) => {
      setUserId(id ?? '')
      setPhotoUrl(photo ?? undefined)
    })
  }, [])

  const likedItems = likedTab === 'likedbyme' ? likedByMe : likedMe

  return (
    <View style={s.screen}>
      <MatchesDesktopNav activeTab={0} langCode="en" onTabPress={onTabPress} />

      <View style={s.body}>
        <HomeSidebar
          navigation={navigation}
          userName={userName}
          userId={userId}
          photoUrl={photoUrl}
        />

        <ScrollView style={s.main} showsVerticalScrollIndicator={false} contentContainerStyle={s.mainContent}>
          {(assistContent || (heroBannerVariant && heroBannerContent)) && (
            <View style={s.card}>
              {assistContent ? (
                <AssistBanner content={assistContent} onPress={onAssistPress} onDismiss={onAssistDismiss} />
              ) : (
                <HeroBanner
                  content={heroBannerContent!}
                  onPress={onHeroBannerPress}
                  onDismiss={heroBannerVariant === 'payment_failed' ? onHeroBannerDismiss : undefined}
                />
              )}
            </View>
          )}

          <View style={s.section}>
            <SwiperCardDesktop
              swiperHeader={`All matches (${allMatchesTotal})`}
              items={allMatches}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => navigation.navigate('Matches')}
            />
          </View>

          {/* Angular: profilesWhoviewedYouSection.blockbgColor = 'dot-img-bg' */}
          <LinearGradient colors={['#FFF1FF', '#FFFFFF']} style={s.section}>
            <Image
              source={{ uri: 'https://imgs.jodii.app/assets/images/svg/revamp/who-viewed-bg-color.svg' }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <SwiperCardDesktop
              swiperHeader={`Who viewed your profile (${viewedMeTotal})`}
              items={viewedMe}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => {}}
            />
          </LinearGradient>

          {completeCards.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Complete your profile</Text>
              <CompleteProfileSection cards={completeCards} onCardPress={onCompleteProfileCardPress} />
            </View>
          )}

          <View style={s.section}>
            <SwiperCardDesktop
              swiperHeader={`Daily recommendations (${todayTotal})`}
              items={todayMatches}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => navigation.navigate('Matches')}
            />
          </View>

          {/* Angular: newlyJoinedSection.blockbgColor = 'pink-bg-block' */}
          <LinearGradient colors={['#FCEBFF', '#FFFFFF']} style={s.section}>
            <SwiperCardDesktop
              swiperHeader={`Newly joined (${newlyJoinedTotal})`}
              items={newlyJoined}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => {}}
            />
          </LinearGradient>

          <View style={s.section}>
            <SwiperCardDesktop
              swiperHeader={`Profiles you viewed (${profilesViewedTotal})`}
              items={profilesViewed}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => {}}
            />
          </View>

          {/* Angular: enums.likedprofile.blockbgColor = 'liked-profile-bg' */}
          <ImageBackground
            source={{ uri: 'https://imgs.jodii.app/assets/images/svg/liked-profiles-bg.svg' }}
            style={s.section}
            resizeMode="cover"
          >
            <Text style={s.sectionTitle}>{`Liked profiles (${likedByMeTotal + likedMeTotal})`}</Text>
            <View style={s.tabRow}>
              <Pressable style={[s.tabPill, likedTab === 'likedyou'  && s.tabPillActive]} onPress={() => onLikedTabChange('likedyou')}>
                <Text style={[s.tabPillText, likedTab === 'likedyou'  && s.tabPillTextActive]}>{`Liked you (${likedMeTotal})`}</Text>
              </Pressable>
              <Pressable style={[s.tabPill, likedTab === 'likedbyme' && s.tabPillActive]} onPress={() => onLikedTabChange('likedbyme')}>
                <Text style={[s.tabPillText, likedTab === 'likedbyme' && s.tabPillTextActive]}>{`Liked by you (${likedByMeTotal})`}</Text>
              </Pressable>
            </View>
            <SwiperCardDesktop
              items={likedItems}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              showSeeAll={false}
              onCardPress={onCardPress}
            />
          </ImageBackground>

          <View style={s.section}>
            <ExploreCategoriesSection
              categories={categories}
              tileWidth={CAT_TILE_W}
              onCategoryPress={cat => navigation.navigate('Matches', { exploreType: cat.id, exploreLabel: cat.label })}
            />
          </View>

          <View style={s.section}>
            <Text style={s.storyTitle}>Got married <Text style={s.storyTitleBold}>through Jodii</Text></Text>
            <Text style={s.storySubtitle}>Thousands have met their life partner through Jodii</Text>
            <SwiperCardDesktop
              items={stories}
              cardWidth={STORY_CARD_W}
              cardHeight={STORY_CARD_H}
              showSeeAll={false}
              // Same as mobile — no per-story detail route exists, only the list screen.
              onCardPress={() => navigation.navigate('SuccessStories')}
            />
          </View>

          {selfHelpVisible && videos.length > 0 && (
            <View style={s.section}>
              <SelfHelpVideosSection videos={videos} cardWidth={VIDEO_CARD_W} cardHeight={VIDEO_CARD_H} onVideoPress={() => {}} />
            </View>
          )}

          <View style={s.section}>
            <HelpSection onCallPress={() => {}} phone={customerCare.phone} />
          </View>
        </ScrollView>
      </View>

      {activeSticky === 'forceUpdate' && (
        <View style={s.stickyWrap}>
          <ForceUpdateCard onPress={onStickyPress} onClose={onStickyClose} />
        </View>
      )}
      {activeSticky === 'profileValidation' && (
        <View style={s.stickyWrap}>
          <StickyBanner
            text={stickyText}
            ctaLabel={stickyCtaLabel}
            onPress={onStickyPress}
            onClose={onStickyClose}
          />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  body: {
    flex: 1, flexDirection: 'row', paddingHorizontal: 32, paddingVertical: 24, gap: 32,
  },
  main: { flex: 1 },
  mainContent: { alignItems: 'center', paddingBottom: 40, gap: 24 },

  // No persistent bottom footer bar on desktop (unlike mobile) — pin the
  // sticky banner to the bottom of the viewport instead.
  stickyWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  card: { width: MAIN_WIDTH, borderRadius: 12, overflow: 'hidden' },
  section: { width: MAIN_WIDTH },
  sectionTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textPrimary, marginBottom: 12 },

  tabRow: {
    flexDirection: 'row', marginBottom: 12, backgroundColor: Colors.surfaceInput, borderRadius: 8, padding: 3, alignSelf: 'flex-start',
  },
  tabPill: { paddingVertical: 7, paddingHorizontal: 16, alignItems: 'center', borderRadius: 6 },
  tabPillActive: { backgroundColor: Colors.white, shadowColor: Colors.shadow, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabPillText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary },
  tabPillTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: Colors.textPrimary },

  storyTitle: { fontFamily: 'Poppins-Regular', fontSize: 18, color: Colors.textPrimary, marginBottom: 12 },
  storyTitleBold: { fontFamily: 'Poppins-Bold', fontSize: 18, color: Colors.primary },
  storySubtitle:  { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textPrimary, marginTop: 6 },
})
