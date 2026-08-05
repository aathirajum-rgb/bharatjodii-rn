// Desktop/laptop layout for the Home screen — full rewrite from Figma "Jodii
// Desktop - Registration" (node 1034:802, "Jodii Homepage"), replacing the
// previous ad hoc desktop layout (generic SwiperCardDesktop cards with no
// pagination/scrim/shadow treatment) with the real per-section designs:
// top nav + left sidebar + 12 main-content sections, each built from the
// shared pieces in components/desktop-home/. Purely presentational —
// HomeScreen.tsx owns all data/state/handler logic (same split
// MatchesDesktopLayout.tsx/ViewProfileDesktopLayout.tsx already use) and
// passes it down as props; userId/photoUrl/videoModalUrl are the exception,
// kept as local desktop-only UI state (same precedent the previous version
// of this file already used for userId/photoUrl).
import { useEffect, useState } from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import HomeSidebar from '../../components/home-sidebar/HomeSidebar'
import AssistBanner, { type AssistBannerContent } from './AssistBanner'
import WelcomeOfferBar from '../../components/desktop-home/WelcomeOfferBar'
import AllMatchesSection from '../../components/desktop-home/AllMatchesSection'
import WhoViewedMeSection from '../../components/desktop-home/WhoViewedMeSection'
import CompleteYourProfileSection from '../../components/desktop-home/CompleteYourProfileSection'
import TodaysMatchesSection from '../../components/desktop-home/TodaysMatchesSection'
import NewlyJoinedSection from '../../components/desktop-home/NewlyJoinedSection'
import ProfilesViewedSection from '../../components/desktop-home/ProfilesViewedSection'
import LikedProfilesSection from '../../components/desktop-home/LikedProfilesSection'
import DiscoverMatchesSection from '../../components/desktop-home/DiscoverMatchesSection'
import SuccessStoriesSection from '../../components/desktop-home/SuccessStoriesSection'
import SelfHelpVideosSection from '../../components/desktop-home/SelfHelpVideosSection'
import DesktopHelpSection from '../../components/desktop-home/DesktopHelpSection'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import ForceUpdateCard from './ForceUpdateCard'
import { SelfHelpVideoPlayer } from './HomeScreen'
import type { SwiperItem } from '../../components/swiper-card/SwiperCard'
import type { ExploreCategory, CompleteProfileCard, HelpVideo } from '../../service/homeService'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import type { LikedTab, HeroBannerVariant } from './homeGating'
import type { HeroBannerContent } from './HeroBanner'
import { Colors } from '../../constants/colors'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'

const MAIN_WIDTH = 810

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
  heroBannerVariant, heroBannerContent, onHeroBannerPress,
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
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.PHOTO_URL),
    ]).then(([id, photo]) => {
      setUserId(id ?? '')
      setPhotoUrl(photo ?? undefined)
    })
  }, [])

  function handleCallPress() {
    if (customerCare.phone) Linking.openURL(`tel:${customerCare.phone}`)
  }
  function handleWhatsAppPress() {
    if (customerCare.whatsapp) Linking.openURL(`https://wa.me/${customerCare.whatsapp.replace(/\D/g, '')}`)
  }

  const newlyViewedCount = viewedMe.filter(i => i.isNewLabel).length

  return (
    <View style={s.screen}>
      <MatchesDesktopNav activeTab={0} langCode="en" onTabPress={onTabPress} />

      <View style={s.body}>
        <HomeSidebar navigation={navigation} userName={userName} userId={userId} photoUrl={photoUrl} />

        <ScrollView style={s.main} showsVerticalScrollIndicator={false} contentContainerStyle={s.mainContent}>
          {!!assistContent && (
            <View style={s.section}>
              <AssistBanner content={assistContent} onPress={onAssistPress} onDismiss={onAssistDismiss} />
            </View>
          )}
          {!assistContent && !!heroBannerVariant && !!heroBannerContent && (
            <View style={s.section}>
              <WelcomeOfferBar content={heroBannerContent} onPress={onHeroBannerPress} />
            </View>
          )}

          <View style={s.section}>
            <AllMatchesSection
              items={allMatches}
              total={allMatchesTotal}
              onCardPress={onCardPress}
              onSeeAllPress={() => navigation.navigate('Matches')}
            />
          </View>

          <View style={s.section}>
            <WhoViewedMeSection
              items={viewedMe}
              total={viewedMeTotal}
              newCount={newlyViewedCount}
              onCardPress={onCardPress}
              // TODO: no dedicated "who viewed me" list screen registered yet
              onSeeAllPress={() => {}}
            />
          </View>

          {completeCards.length > 0 && (
            <View style={s.section}>
              <CompleteYourProfileSection cards={completeCards} onCardPress={onCompleteProfileCardPress} />
            </View>
          )}

          <View style={s.section}>
            <TodaysMatchesSection
              items={todayMatches}
              total={todayTotal}
              onCardPress={onCardPress}
              onSeeAllPress={() => navigation.navigate('Matches')}
            />
          </View>

          <View style={s.section}>
            <NewlyJoinedSection
              items={newlyJoined}
              total={newlyJoinedTotal}
              onCardPress={onCardPress}
              // TODO: no dedicated "newly joined" list screen registered yet
              onSeeAllPress={() => {}}
            />
          </View>

          <View style={s.section}>
            <ProfilesViewedSection
              items={profilesViewed}
              total={profilesViewedTotal}
              onCardPress={onCardPress}
              // TODO: no dedicated "profiles you viewed" list screen registered yet
              onSeeAllPress={() => {}}
            />
          </View>

          <View style={s.section}>
            <LikedProfilesSection
              likedTab={likedTab}
              onTabChange={onLikedTabChange}
              likedByMe={likedByMe}
              likedByMeTotal={likedByMeTotal}
              likedMe={likedMe}
              likedMeTotal={likedMeTotal}
              onCardPress={onCardPress}
              // TODO: no dedicated "liked profiles" list screen registered yet
              onSeeAllPress={() => {}}
            />
          </View>

          <View style={s.section}>
            <DiscoverMatchesSection
              categories={categories}
              onCategoryPress={cat => navigation.navigate('Matches', { exploreType: cat.id, exploreLabel: cat.label })}
              onDiscoverAllPress={() => navigation.navigate('DiscoverMatches')}
            />
          </View>

          <View style={s.section}>
            <SuccessStoriesSection
              stories={stories}
              onStoryPress={() => navigation.navigate('SuccessStories')}
              onSeeAllPress={() => navigation.navigate('SuccessStories')}
            />
          </View>

          {selfHelpVisible && videos.length > 0 && (
            <View style={s.section}>
              <SelfHelpVideosSection
                videos={videos}
                onVideoPress={item => item.videoUrl && setVideoModalUrl(item.videoUrl)}
                // TODO: no dedicated "self-help videos" list screen registered yet
                onSeeAllPress={() => {}}
              />
            </View>
          )}

          <View style={s.section}>
            <DesktopHelpSection
              phone={customerCare.phone}
              whatsapp={customerCare.whatsapp}
              onCallPress={handleCallPress}
              onWhatsAppPress={handleWhatsAppPress}
            />
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
          <StickyBanner text={stickyText} ctaLabel={stickyCtaLabel} onPress={onStickyPress} onClose={onStickyClose} />
        </View>
      )}

      <Modal visible={!!videoModalUrl} animationType="slide" onRequestClose={() => setVideoModalUrl(null)}>
        <View style={s.videoModal}>
          <Pressable style={s.videoModalClose} onPress={() => setVideoModalUrl(null)}>
            <Text style={s.videoModalCloseText}>✕</Text>
          </Pressable>
          {!!videoModalUrl && <SelfHelpVideoPlayer uri={videoModalUrl} />}
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  body: {
    flex: 1, flexDirection: 'row', paddingHorizontal: 124, paddingVertical: 24, gap: 24,
  },
  main: { flex: 1 },
  mainContent: { alignItems: 'center', paddingBottom: 40, gap: 40 },

  // No persistent bottom footer bar on desktop (unlike mobile) — pin the
  // sticky banner to the bottom of the viewport instead.
  stickyWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  section: { width: MAIN_WIDTH },

  videoModal:      { flex: 1, backgroundColor: '#000' },
  videoModalClose: { position: 'absolute', top: 16, right: 16, zIndex: 1, padding: 8 },
  videoModalCloseText: { color: Colors.white, fontSize: 20 },
})
