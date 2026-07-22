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
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import HomeSidebar from '../../components/home-sidebar/HomeSidebar'
import SwiperCardDesktop from '../../components/swiper-card/SwiperCardDesktop'
import type { SwiperItem } from '../../components/swiper-card/SwiperCard'
import { Colors } from '../../constants/colors'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import type { ExploreCategory } from '../../service/homeService'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import {
  OfferBanner, CompleteProfileCard, ExploreCategoriesSection,
  SelfHelpVideosSection, HelpSection, type HelpVideo,
} from './HomeScreen'

const MAIN_WIDTH   = 700
// ExploreCategoriesSection's shared catGrid style bakes in paddingHorizontal:16
// (32px total) + gap:8 — both have to come out of MAIN_WIDTH before halving,
// or two tiles overflow the row and flexWrap pushes the second down a line.
const CAT_TILE_W   = (MAIN_WIDTH - 32 - 8) / 2
const CAT_TILE_H   = CAT_TILE_W * 0.6
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
  banner:          { bannerText: string; saveAmount: string; timeRemaining: string }
  onPlayNow:       () => void
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
  showHoroscope:   boolean
  showStarRaasi:   boolean
  likedTab:        'me' | 'them'
  onLikedTabChange:(tab: 'me' | 'them') => void
  likedByMe:       SwiperItem[]
  likedByMeTotal:  number
  likedMe:         SwiperItem[]
  likedMeTotal:    number
  categories:      ExploreCategory[]
  stories:         SwiperItem[]
  videos:          HelpVideo[]
  customerCare:    { phone: string; whatsapp: string }
  onCardPress:     (item: SwiperItem) => void
  onTabPress:      (tab: FooterTab) => void
}

export default function HomeDesktopLayout({
  navigation, userName, onPlayNow, banner,
  allMatches, allMatchesTotal, viewedMe, viewedMeTotal,
  todayMatches, todayTotal, newlyJoined, newlyJoinedTotal,
  profilesViewed, profilesViewedTotal, showHoroscope, showStarRaasi,
  likedTab, onLikedTabChange, likedByMe, likedByMeTotal, likedMe, likedMeTotal,
  categories, stories, videos, customerCare, onCardPress, onTabPress,
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

  const likedItems = likedTab === 'me' ? likedByMe : likedMe

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
          <View style={s.card}>
            <OfferBanner
              onPlayNow={onPlayNow}
              bannerText={banner.bannerText}
              saveAmount={banner.saveAmount}
              timeRemaining={banner.timeRemaining}
            />
          </View>

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

          <View style={s.section}>
            <SwiperCardDesktop
              swiperHeader={`Profiles who viewed me (${viewedMeTotal})`}
              items={viewedMe}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => {}}
            />
          </View>

          {(showHoroscope || showStarRaasi) && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Complete your profile</Text>
              <CompleteProfileCard
                onAddHoroscope={() => navigation.navigate('onboarding', { pageNo: '16' })}
                onAddStarRaasi={() => navigation.navigate('onboarding', { pageNo: '27' })}
                showHoroscope={showHoroscope}
                showStarRaasi={showStarRaasi}
              />
            </View>
          )}

          <View style={s.section}>
            <SwiperCardDesktop
              swiperHeader={`Today's matches for you (${todayTotal})`}
              items={todayMatches}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => navigation.navigate('Matches')}
            />
          </View>

          <View style={s.section}>
            <SwiperCardDesktop
              swiperHeader={`Newly joined (${newlyJoinedTotal})`}
              items={newlyJoined}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              onCardPress={onCardPress}
              onSeeAllPress={() => {}}
            />
          </View>

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

          <View style={s.section}>
            <Text style={s.sectionTitle}>{`Liked profiles (${likedByMeTotal + likedMeTotal})`}</Text>
            <View style={s.tabRow}>
              <Pressable style={[s.tabPill, likedTab === 'me'   && s.tabPillActive]} onPress={() => onLikedTabChange('me')}>
                <Text style={[s.tabPillText, likedTab === 'me'   && s.tabPillTextActive]}>{`Liked by you (${likedByMeTotal})`}</Text>
              </Pressable>
              <Pressable style={[s.tabPill, likedTab === 'them' && s.tabPillActive]} onPress={() => onLikedTabChange('them')}>
                <Text style={[s.tabPillText, likedTab === 'them' && s.tabPillTextActive]}>{`Liked you (${likedMeTotal})`}</Text>
              </Pressable>
            </View>
            <SwiperCardDesktop
              items={likedItems}
              cardWidth={SMALL_CARD_W}
              cardHeight={SMALL_CARD_H}
              showSeeAll={false}
              onCardPress={onCardPress}
            />
          </View>

          <View style={s.section}>
            <ExploreCategoriesSection
              categories={categories}
              tileWidth={CAT_TILE_W}
              tileHeight={CAT_TILE_H}
              onCategoryPress={cat => navigation.navigate('Matches', { exploreType: cat.id, exploreLabel: cat.label })}
              onDiscoverPress={() => {}}
            />
          </View>

          <View style={s.section}>
            <Text style={s.storyTitle}>Made with <Text style={s.storyTitleBold}>Love in Jodii</Text></Text>
            <SwiperCardDesktop
              items={stories}
              cardWidth={STORY_CARD_W}
              cardHeight={STORY_CARD_H}
              showSeeAll={false}
              onCardPress={() => {}}
            />
          </View>

          <View style={s.section}>
            <SelfHelpVideosSection videos={videos} cardWidth={VIDEO_CARD_W} cardHeight={VIDEO_CARD_H} onVideoPress={() => {}} />
          </View>

          <View style={s.section}>
            <HelpSection onCallPress={() => {}} onWhatsAppPress={() => {}} phone={customerCare.phone} />
          </View>
        </ScrollView>
      </View>
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
})
