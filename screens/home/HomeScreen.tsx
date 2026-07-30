import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Constants from 'expo-constants'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useVideoPlayer, VideoView } from 'expo-video'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import AppHeader, { type ToolbarItem } from '../../components/app-header/AppHeader'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import SwiperCard, { type SwiperItem } from '../../components/swiper-card/SwiperCard'
import Loader from '../../components/loader/Loader'
import StickyBanner from '../../components/sticky-banner/StickyBanner'
import { paymentTrack, getHeroBannerDetails, getMenuPromo, redirectToIntermediatePage } from '../../service/paymentService'
import { communicationBtnOnClick } from '../../service/communicationService'
import { redirectToViewProfile } from '../../service/buttonService'
import { getItem, setItem } from '../../service/storageService'
import { getRegistrationArrays } from '../../service/registrationService'
import { logScreen } from '../../service/analyticsService'
import { socketConnection, emitNotificationDetails, onNotificationList } from '../../service/socketService'
import { StorageKeys } from '../../constants/storage.keys'
import { EnvConfig } from '../../constants/env'
import { Colors } from '../../constants/colors'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import HomeDesktopLayout from './HomeDesktopLayout'
import HeroBanner, { type HeroBannerContent } from './HeroBanner'
import AssistBanner, { type AssistBannerContent } from './AssistBanner'
import ForceUpdateCard from './ForceUpdateCard'
import {
  filterCompleteProfileCards,
  computeSelfHelpVideosVisible,
  computeDefaultLikedTab,
  computeHasPaidBadge,
  computeShowHeroBanner,
  computeHeroBannerVariant,
  computeShowAssistBanner,
  computeForceUpdateInfo,
  isPaidVerifiedNoPhotoMale,
  isNonIdVerifiedPaidMale,
  type LikedTab,
  type HeroBannerVariant,
  type ForceUpdateInfo,
} from './homeGating'
import {
  fetchExploreCategories, fetchHomeSession, fetchAndStorePPSetData, fetchMatches,
  fetchViewedYou, fetchDailyRec, fetchNewlyJoined, fetchViewedByMe,
  fetchLikedByMe, fetchLikedYou, fetchSuccessStories, fetchFaqVideos,
  fetchCustomerCare, fetchNotifCount, fetchExploreCounts, refreshSession,
  mapCompleteProfileCards, fetchProfileValidationBanner,
  type ExploreCategory, type HelpVideo, type CompleteProfileCard, type ComCountEntry,
} from '../../service/homeService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN = 'https://imgs.jodii.app/assets/images/svg/'
const { width: SW } = Dimensions.get('window')

// ─── Toolbar ──────────────────────────────────────────────────────────────────
// Angular: core/config/home.config.ts's homeToolBar — discover-matches (search
// icon) then notification, in that order. 'menu'/'messager-list' entries exist
// in that same config but are commented out (dead) there too — there is no
// chat icon on Home's header at all in the real app.

function buildToolbar(comCount: ComCountEntry[]): ToolbarItem[] {
  const notifyTotal = comCount.reduce((sum, c) => sum + Number(c.newcount ?? 0), 0)
  return [
    { toolType: 'discover-matches', toolImg: CDN + 'bottom-nav/search-deactive.svg' },
    { toolType: 'notification', toolImg: CDN + 'revamp/home-notification.svg', showNotification: notifyTotal > 0, notifyCount: String(notifyTotal) },
  ]
}

function comCountFor(comCount: ComCountEntry[], type: string): number {
  return Number(comCount.find(c => c.comtype === type)?.newcount ?? 0)
}

// ─── Mock Data (shown briefly on first paint / kept if a fetch comes back empty) ──

const MOCK_ALL_MATCHES: SwiperItem[] = [
  { profileId: 'am1', name: 'Meenakshi',  age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'am2', name: 'Dhaarani',   age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'am3', name: 'Keerthana',  age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'am4', name: 'Kavitha',    age: '27 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
]

const MOCK_VIEWED_ME: SwiperItem[] = [
  { profileId: 'vm1', name: 'Kamatchi',        age: '26 Yrs', education: "Bachelor's Degree", isNewLabel: true, labelContent: 'NEW', likedViewedDateText: 'Viewed you on 11-May-2025', likedStatus: '0' },
  { profileId: 'vm2', name: 'Saraswathi',      age: '22 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'Viewed you on 4-May-2025',  likedStatus: '0' },
  { profileId: 'vm3', name: 'Deepa',           age: '30 Yrs', education: "Master's Degree",   likedViewedDateText: 'Viewed you on 4-May-2025',  likedStatus: '0' },
]

const MOCK_TODAY_MATCHES: SwiperItem[] = [
  { profileId: 'tm1', name: 'Priyadharshini',  age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
  { profileId: 'tm2', name: 'Divyadharshini',  age: '22 Yrs', education: "Bachelor's Degree", isNewlyJoined: false, likedStatus: '0' },
  { profileId: 'tm3', name: 'Karthika',        age: '24 Yrs', education: "Master's Degree",   isNewlyJoined: false, likedStatus: '0' },
]

const MOCK_NEWLY_JOINED: SwiperItem[] = [
  { profileId: 'nj1', name: 'Dhaarani',        age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
  { profileId: 'nj2', name: 'Aabidah',         age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
  { profileId: 'nj3', name: 'Aradhya',         age: '26 Yrs', education: "Bachelor's Degree", isNewlyJoined: true,  likedStatus: '0' },
]

const MOCK_PROFILES_VIEWED: SwiperItem[] = [
  { profileId: 'pv1', name: 'Meenakshi',       age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You viewed on 11-May-2025', likedStatus: '0' },
  { profileId: 'pv2', name: 'Divya',           age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You viewed on 8-May-2025',  likedStatus: '0' },
  { profileId: 'pv3', name: 'Rajalakshmi',     age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You viewed on 3-May-2025',  likedStatus: '0' },
]

const MOCK_LIKED_BY_ME: SwiperItem[] = [
  { profileId: 'lm1', name: 'Ramya Muralitharan',      age: '26 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You liked her on 14 Jan 2026', likedStatus: '1' },
  { profileId: 'lm2', name: 'Priyanka Sathiyamoorthy', age: '25 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'You liked her on 02 Jan 2026', likedStatus: '1' },
]

const MOCK_LIKED_ME: SwiperItem[] = [
  { profileId: 'lme1', name: 'Kavitha',        age: '27 Yrs', education: "Bachelor's Degree", likedViewedDateText: 'Liked you on 05 Jan 2026', likedStatus: '0' },
  { profileId: 'lme2', name: 'Deepika',        age: '24 Yrs', education: "Master's Degree",   likedViewedDateText: 'Liked you on 03 Jan 2026', likedStatus: '0' },
]

const MOCK_STORIES: SwiperItem[] = [
  { profileId: 's1', name: 'Shankar & Aradhya', location: 'Chennai',    date: 'Posted on 20th Nov 2025' },
  { profileId: 's2', name: 'Vinoth & Priyanka', location: 'Coimbatore', date: 'Posted on 20th Nov 2025' },
  { profileId: 's3', name: 'Srikanth & Ramya',  location: 'Chennai',    date: 'Posted on 28th Oct 2025' },
]

const MOCK_CATEGORIES: ExploreCategory[] = [
  { id: 'c1', label: 'Diploma and below',    count: 33,  imageUrl: '' },
  { id: 'c2', label: 'Graduate and above',   count: 55,  imageUrl: '' },
  { id: 'c3', label: 'Same community',       count: 99,  imageUrl: '' },
  { id: 'c4', label: 'Own business',         count: 40,  imageUrl: '' },
]

export type { HelpVideo }
const MOCK_VIDEOS: HelpVideo[] = [
  { id: 'v1', title: 'How to search matches as per your preferences', thumbUrl: '', videoUrl: '' },
  { id: 'v2', title: 'Tips to get more profile views',                 thumbUrl: '', videoUrl: '' },
]

// ─── Complete Your Profile ────────────────────────────────────────────────────
// Generic renderer over homeGating's filterCompleteProfileCards() output — one
// row per PPSET-derived card type, replacing the old hardcoded horoscope+star-
// only widget. Extracted so HomeDesktopLayout.tsx can render the exact same list.

export interface CompleteProfileSectionProps {
  cards:       CompleteProfileCard[]
  onCardPress: (card: CompleteProfileCard) => void
}

export function CompleteProfileSection({ cards, onCardPress }: CompleteProfileSectionProps) {
  if (cards.length === 0) return null
  return (
    <View style={s.cpCard}>
      {cards.map((card, idx) => (
        <View key={card.type}>
          <Pressable style={s.cpRow} onPress={() => onCardPress(card)}>
            {/* Angular: card?.THUMBIMG — a per-card image URL from the server,
                not a client-guessed icon; plain Image (not CdnSvg) since the
                format isn't guaranteed to be SVG. */}
            <View style={s.cpIcon}>
              {!!card.imageUrl && <Image source={{ uri: card.imageUrl }} style={s.cpIconImg} resizeMode="contain" />}
            </View>
            <Text style={s.cpText}>{card.label}</Text>
            <Text style={s.cpAdd}>{card.ctaLabel} {'>'}</Text>
          </Pressable>
          {idx < cards.length - 1 && <View style={s.cpDivider} />}
        </View>
      ))}
    </View>
  )
}

// ─── Liked Profiles (tab toggle + card list) ──────────────────────────────────

export interface LikedProfilesSectionProps {
  likedTab:     LikedTab
  onTabChange:  (tab: LikedTab) => void
  likedByMe:    SwiperItem[]
  likedMe:      SwiperItem[]
  likedByCount: number
  likedMeCount: number
  onCardPress:  (item: SwiperItem) => void
  onLikePress:  (item: SwiperItem) => void
}

export function LikedProfilesSection({
  likedTab, onTabChange, likedByMe, likedMe, likedByCount, likedMeCount, onCardPress, onLikePress,
}: LikedProfilesSectionProps) {
  const items = likedTab === 'likedbyme' ? likedByMe : likedMe
  return (
    <>
      <Text style={s.sectionTitle}>{'Liked profiles (' + (likedByCount + likedMeCount) + ')'}</Text>
      <View style={s.tabRow}>
        <Pressable style={[s.tabPill, likedTab === 'likedyou'  && s.tabPillActive]} onPress={() => onTabChange('likedyou')}>
          <Text style={[s.tabPillText, likedTab === 'likedyou'  && s.tabPillTextActive]}>{'Liked you (' + likedMeCount + ')'}</Text>
        </Pressable>
        <Pressable style={[s.tabPill, likedTab === 'likedbyme' && s.tabPillActive]} onPress={() => onTabChange('likedbyme')}>
          <Text style={[s.tabPillText, likedTab === 'likedbyme' && s.tabPillTextActive]}>{'Liked by you (' + likedByCount + ')'}</Text>
        </Pressable>
      </View>
      <SwiperCard
        cardVariant={8}
        cardSection="likedprofile"
        items={items}
        showSeeAll={false}
        onCardPress={onCardPress}
        onLikePress={onLikePress}
      />
    </>
  )
}

// ─── Explore Categories ────────────────────────────────────────────────────────
// Angular: explore-card.component.html's ACTIVE template (the big-image-tile
// version with a separate count line and a "Discover all categories" CTA below
// the grid is entirely commented out in the real source) is a compact row —
// small icon + title (count baked into the server's TITLE string already,
// not a separate element) + inline forward chevron, on a light gradient card.
// No "see all"/"discover all" button exists in the live template at all.

export interface ExploreCategoriesSectionProps {
  categories: ExploreCategory[]
  tileWidth:  number
  onCategoryPress: (cat: ExploreCategory) => void
}

export function ExploreCategoriesSection({
  categories, tileWidth, onCategoryPress,
}: ExploreCategoriesSectionProps) {
  return (
    <>
      <Text style={s.sectionTitle}>Explore matches based on</Text>
      <View style={s.catGrid}>
        {categories.map(cat => (
          <Pressable key={cat.id} onPress={() => onCategoryPress(cat)} style={{ width: tileWidth }}>
            {/* Angular: backgroundStyle() — server's BGCOLOUR, else this exact
                default diagonal gradient. */}
            <LinearGradient
              colors={['#DCF0FF', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.catTile}
            >
              <View style={s.catIconWrap}>
                {!!cat.imageUrl && <Image source={{ uri: cat.imageUrl }} style={s.catIconImg} resizeMode="contain" />}
              </View>
              <Text style={s.catLabel} numberOfLines={2}>
                {cat.label}{'  '}
                <Text style={s.catChevron}>{'›'}</Text>
              </Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </>
  )
}

// ─── Success Stories ───────────────────────────────────────────────────────────

export function SuccessStoriesSection({
  stories, onCardPress,
}: { stories: SwiperItem[]; onCardPress: (item: SwiperItem) => void }) {
  return (
    <>
      {/* Angular: HOME.HAPPILY_MARRIED_HEAD = "Got married <br>through Jodii",
          HOME.HAPPILY_MARRIED_CONTENT = "Thousands have met their life
          partner <br>through Jodii" — not "Made with Love in Jodii", and the
          subtitle line was missing entirely. */}
      <View style={s.storyHeader}>
        <Text style={s.storyTitle}>Got married</Text>
        <Text style={s.storyTitleBold}>through Jodii</Text>
        <Text style={s.storySubtitle}>Thousands have met their life partner{'\n'}through Jodii</Text>
      </View>
      {/* No cardWidth override — Angular: card-ht4 is 91.111vmin square, not
          the previous guessed 68% width. Let SwiperCard's per-section default
          (ProfileCard's PHOTO_HEIGHT['successstory']) apply. */}
      <SwiperCard
        cardVariant={4}
        cardSection="successstory"
        items={stories}
        showSeeAll={false}
        onCardPress={onCardPress}
      />
    </>
  )
}

// ─── Self-help Videos ───────────────────────────────────────────────────────────
// Angular: complete-profile.component.html's self-video swiper slide — the
// caption (QUS) is overlaid in white text at the bottom of the background
// image itself (FAQ-banners-position, a bottom scrim), not a separate text
// row below the card; and the play button is the real CDN icon, not a
// CSS-drawn triangle.

export function SelfHelpVideosSection({
  videos, cardWidth, cardHeight, onVideoPress,
}: { videos: HelpVideo[]; cardWidth: number; cardHeight: number; onVideoPress: (item: HelpVideo) => void }) {
  return (
    <>
      <Text style={s.sectionTitle}>Self-help videos</Text>
      <FlatList
        data={videos}
        keyExtractor={i => i.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.hList}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item, index }) => (
          <Pressable style={[s.videoCard, { width: cardWidth, height: cardHeight }]} onPress={() => onVideoPress(item)}>
            {item.thumbUrl
              ? <Image source={{ uri: item.thumbUrl }} style={s.videoThumbImg} resizeMode="cover" />
              : <View style={[s.videoThumbImg, { backgroundColor: ['#D6E8F6','#F6D6E0'][index % 2] }]} />
            }
            <View style={s.playBtn}>
              <CdnSvg uri={`${CDN}play-pause-message-white.svg`} width={28} height={28} />
            </View>
            {!!item.title && (
              <View style={s.videoCaptionScrim}>
                <Text style={s.videoTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </>
  )
}

// Inline video player for the self-help video modal — same expo-video pattern
// already used by screens/help-center/FaqScreen.tsx's FaqVideoPlayer.
export function SelfHelpVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.play() })
  return <VideoView player={player} style={s.videoModalPlayer} nativeControls />
}

// ─── Help / Support ─────────────────────────────────────────────────────────────

// Angular: explore.component.ts's getHelbBannerData() → this whole section is
// actually the shared <app-home-banner> component with action='helpBanner',
// content read from the FAQ_DETAILS.BANNER translation object (a static
// title/body/CTA/image/gradient-background, not the customer-care API) —
// title+body+a single "Call us #CALL#" LINK (chevron, no button styling),
// with a decorative image on the right. There is no WhatsApp button at all
// in Angular's real Home help section.
export function HelpSection({
  onCallPress, phone = '+91 9876543210',
}: { onCallPress: () => void; phone?: string }) {
  return (
    <LinearGradient
      colors={['#FFEEE7', '#F5F5F5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.helpWrap}
    >
      <View style={s.helpTextCol}>
        <Text style={s.helpTitle}>Do you need help?</Text>
        <Text style={s.helpSub}>Feel free to connect with us everyday from 8 AM to 9 PM</Text>
        <Pressable style={s.helpCta} onPress={onCallPress}>
          <Text style={s.helpCtaText}>{'Call us ' + phone}</Text>
          <Text style={s.helpCtaChevron}>{'›'}</Text>
        </Pressable>
      </View>
      <Image source={{ uri: `${CDN}call-24-7.svg` }} style={s.helpImage} resizeMode="contain" />
    </LinearGradient>
  )
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: { navigation: any }) {
  const isDesktop = useIsDesktopWeb()
  const { t, i18n } = useTranslation()
  const [contentLoaded, setContentLoaded] = useState(false)

  const [likedTab, setLikedTab] = useState<LikedTab>('likedbyme')
  const [categories, setCategories] = useState<ExploreCategory[]>(MOCK_CATEGORIES)

  // ── Session / profile-completion / gating inputs ──────────────────────────
  const [userName, setUserName]           = useState('')
  const [userImg, setUserImg]             = useState<string | undefined>(undefined)
  const [completionPct, setCompletionPct] = useState(0)
  const [entryType, setEntryType]         = useState('')
  const [gender, setGender]               = useState<'M' | 'F'>('F')
  const [ekycStatus, setEkycStatus]       = useState('')
  const [payRenewalFlag, setPayRenewalFlag] = useState('0')
  const [lang, setLang]                   = useState('en')
  const [ppSetData, setPpSetData]         = useState<Record<string, any>>({})
  const [comCount, setComCount]           = useState<ComCountEntry[]>([])
  const [completeCards, setCompleteCards] = useState<CompleteProfileCard[]>([])
  const [upgradeTag, setUpgradeTag] = useState('')
  const [showMembershipDot, setShowMembershipDot] = useState(false)

  // ── Hero banner / assist banner (mutually exclusive top slot) ─────────────
  const [heroBannerVariant, setHeroBannerVariant]   = useState<HeroBannerVariant>(null)
  const [heroBannerContent, setHeroBannerContent]   = useState<HeroBannerContent | null>(null)
  const [assistContent, setAssistContent]           = useState<AssistBannerContent | null>(null)
  const [assistDismissed, setAssistDismissed]       = useState(false)
  const [paymentFailedDismissed, setPaymentFailedDismissed] = useState(false)

  // ── Sticky banner (pinned above footer) — Angular's Home screen renders this
  // as a THIRD, separate slot from the hero banner above (§16 in the source
  // analysis: the generic sticky explicitly excludes PAYMENTFAILED_STICKY, which
  // stays in the hero-banner slot handled above). Covers force-update (highest
  // priority, same as MatchesScreen.tsx's judgment call) and the profile-
  // validation-rejected banner (PISTATUS in [5,13]).
  const [forceUpdateInfo, setForceUpdateInfo]           = useState<ForceUpdateInfo | null>(null)
  const [profileValidationBanner, setProfileValidationBanner] = useState<{ show: boolean; message: string; ctaLabel: string } | null>(null)
  const [stickyDismissed, setStickyDismissed]           = useState(false)
  // Angular: logScrollEnd() hides the sticky banner once the user has scrolled
  // past the header while actively scrolling down (shows again scrolling up or
  // near the top) — RN has no overlaid/translucent header to recolor the way
  // Angular's does, so only the sticky-banner-hide half of that behavior applies.
  const [hideStickyOnScroll, setHideStickyOnScroll] = useState(false)
  const scrollYRef = useRef(0)

  // Self-help video playback — Angular has no modal for this either (its
  // FAQ videos use a dedicated VideoFaqPopupComponent); mirrors the inline
  // expo-video player pattern already used by screens/help-center/FaqScreen.tsx.
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null)

  // ── Per-section skeleton-loader flags (Angular: mContLoaded/nmContLoaded —
  // the only two Home sections that show a dashboard-skeleton while loading) ──
  const [allMatchesLoaded, setAllMatchesLoaded]   = useState(false)
  const [newlyJoinedLoaded, setNewlyJoinedLoaded] = useState(false)

  // ── Listing sections ───────────────────────────────────────────────────────
  const [allMatches, setAllMatches]           = useState(MOCK_ALL_MATCHES)
  const [allMatchesTotal, setAllMatchesTotal] = useState(MOCK_ALL_MATCHES.length)
  const [viewedMe, setViewedMe]               = useState(MOCK_VIEWED_ME)
  const [viewedMeTotal, setViewedMeTotal]     = useState(MOCK_VIEWED_ME.length)
  const [todayMatches, setTodayMatches]       = useState(MOCK_TODAY_MATCHES)
  const [todayTotal, setTodayTotal]           = useState(MOCK_TODAY_MATCHES.length)
  const [newlyJoined, setNewlyJoined]         = useState(MOCK_NEWLY_JOINED)
  const [newlyJoinedTotal, setNewlyJoinedTotal] = useState(MOCK_NEWLY_JOINED.length)
  const [profilesViewed, setProfilesViewed]   = useState(MOCK_PROFILES_VIEWED)
  const [profilesViewedTotal, setProfilesViewedTotal] = useState(MOCK_PROFILES_VIEWED.length)
  const [likedByMe, setLikedByMe]             = useState(MOCK_LIKED_BY_ME)
  const [likedByMeTotal, setLikedByMeTotal]   = useState(MOCK_LIKED_BY_ME.length)
  const [likedMe, setLikedMe]                 = useState(MOCK_LIKED_ME)
  const [likedMeTotal, setLikedMeTotal]       = useState(MOCK_LIKED_ME.length)
  const [stories, setStories]                 = useState<SwiperItem[]>(MOCK_STORIES)
  const [videos, setVideos]                   = useState<HelpVideo[]>(MOCK_VIDEOS)
  const [customerCare, setCustomerCare]       = useState({ phone: '+91 9876543210', whatsapp: '' })

  // Angular: ngOnInit()/ionViewDidEnter() — loadHome() is the RN equivalent of
  // BOTH combined. Called on every focus (useFocusEffect below); `includePopups`
  // gates the truly one-time-per-mount bits (screen-view analytics, the
  // once-per-install first-land ping) so they don't refire every time the user
  // tabs back to Home.
  const loadHome = useCallback(async (ctrl: { cancelled: boolean }, includePopups: boolean) => {
    // Angular's RN port convention (MatchesScreen.tsx's loadMatches() step 1):
    // every screen that fires listing API calls must refreshSession() first to
    // guarantee a valid/upgraded ATN — this was missing here, and its absence
    // is why every single Home listing call was failing with ERRCODE 23
    // ("Token expired") uniformly, all at once, regardless of endpoint.
    await refreshSession()
    if (ctrl.cancelled) return

    if (includePopups) {
      logScreen('Home')
      // Angular: calltrackApi() — paymentTrack('115') fires once per install,
      // guarded by FIRSTLAND_HOME in storage (no existing precedent for a
      // "forever" one-time flag elsewhere in this repo — modeled on the
      // SURVEYPOPUP/PN_LAST_SHOWN_DATE consume-once shapes in MatchesScreen.tsx).
      getItem('FIRSTLAND_HOME').then(fired => {
        if (ctrl.cancelled || fired === '1') return
        setItem('FIRSTLAND_HOME', '1')
        paymentTrack('115')
      })
    }

    getItem(StorageKeys.User.PHOTO_URL).then(photo => { if (!ctrl.cancelled && photo) setUserImg(photo) })

    fetchExploreCategories().then(result => {
      if (!ctrl.cancelled && result.length > 0) setCategories(result)
    })

    Promise.all([fetchHomeSession(), fetchAndStorePPSetData()]).then(async ([session, data]) => {
      if (ctrl.cancelled) return
      if (session.userName) setUserName(session.userName)
      setEntryType(session.membershipType)
      setLang(session.lang)
      setPpSetData(data)
      const completeness = Number(data?.['PROFILECOMPLETENESS'])
      if (!Number.isNaN(completeness)) setCompletionPct(completeness)

      const [g, ekyc, paid, renewal, discoverCounts] = await Promise.all([
        getItem(StorageKeys.User.LOGIN_GENDER),
        getItem('EKYCSTATUS'),
        getItem(StorageKeys.Payment.PAY_P_FLAG),
        getItem(StorageKeys.Payment.PAY_RENEWAL_FLAG),
        fetchExploreCounts(data?.['DISCOVERKEY']),
      ])
      if (ctrl.cancelled) return
      const resolvedGender: 'M' | 'F' = g === 'M' ? 'M' : 'F'
      setGender(resolvedGender)
      setEkycStatus(ekyc ?? '')
      setPayRenewalFlag(renewal ?? '0')

      // Complete-Your-Profile cards — server list of incomplete cards, minus
      // whatever's already done locally (horoscope/photo — see homeGating.ts).
      const photoStatus = data?.['PI_PHOTOSTATUS'] ?? 'N'
      const photoApproved = photoStatus === 'Y'
      const rawCards = mapCompleteProfileCards(data)
      setCompleteCards(filterCompleteProfileCards(rawCards, session.horoAvailable, photoApproved))

      // Merge live counts into the Explore/Discover grid (best-effort — see
      // fetchExploreCounts' NEEDS LIVE VERIFICATION note).
      if (Object.keys(discoverCounts).length > 0) {
        setCategories(prev => prev.map(cat => (
          discoverCounts[cat.id] !== undefined ? { ...cat, count: discoverCounts[cat.id] } : cat
        )))
      }

      // ── Hero banner precedence chain (Angular: explore.component.ts's
      // getPPSETData() chain, same order MatchesScreen.tsx's applyHeroBanner
      // if/else-if already uses for its own 3-way subset) ──────────────────
      const entryTypeVal = session.membershipType
      const isPvnpMale = isPaidVerifiedNoPhotoMale(entryTypeVal, ekyc ?? '', resolvedGender, photoStatus)
      const isNivpMale = isNonIdVerifiedPaidMale(entryTypeVal, resolvedGender, ekyc ?? '', paid ?? '')
      const showHero = computeShowHeroBanner({
        entryType: entryTypeVal, payRenewalFlag: renewal ?? '0', gender: resolvedGender,
        isNonIdVerifiedPaidMale: isNivpMale, isPaidVerifiedNoPhotoMale: isPvnpMale,
      })
      const flagOk = String(data?.['PROFILEPUBLISHEDFLAG']) === '0'
      const typeOk = ['1', '2'].includes(String(data?.['PROFILEPUBLISHEDTYPE']))
      const isFreeFemalePhotoPromo = flagOk && typeOk && entryTypeVal === 'F'

      // Angular: PAYMENTFAILTYPE=='1' gates the payment-failed variant; content
      // comes from getHeroBannerDetails(true, 1) — same call MatchesScreen.tsx's
      // own payment-failed sticky uses (bannerType 1 = payment-failed content).
      let paymentFailedContent: HeroBannerContent | null = null
      if (!paymentFailedDismissed && (await getItem('PAYMENTFAILTYPE')) === '1') {
        const failedBanner = await getHeroBannerDetails(true, 1)
        const text = failedBanner?.['PAYMENTFAILEDCONTENT']
        const cta  = failedBanner?.['PAYMENTFAILEDCTA']
        if (text && cta) {
          const startMs = Date.parse(failedBanner?.['OFFSTTIME'] ?? '')
          const endMs   = Date.parse(failedBanner?.['OFFEDTIME'] ?? '')
          const deadlineMs = !Number.isNaN(startMs) && !Number.isNaN(endMs)
            ? Date.now() + Math.max(0, endMs - startMs)
            : Date.now() + 10 * 60 * 1000
          paymentFailedContent = { title: '', body: String(text), ctaLabel: String(cta), countdownDeadlineMs: deadlineMs }
        }
      }

      const variant = computeHeroBannerVariant({
        paymentFailedActive:       !!paymentFailedContent,
        showHeroBanner:            showHero,
        isFreeFemalePhotoPromo,
        isNonIdVerifiedPaidMale:   isNivpMale,
        isPaidVerifiedNoPhotoMale: isPvnpMale,
      })
      if (ctrl.cancelled) return
      setHeroBannerVariant(variant)

      if (variant === 'payment_failed' && paymentFailedContent) {
        setHeroBannerContent(paymentFailedContent)
      } else if (variant === 'photo_promo_free_female' || variant === 'non_id_verify_male' || variant === 'paid_verified_no_photo') {
        const reg = await getRegistrationArrays()
        if (ctrl.cancelled) return
        const bannerKey = variant === 'photo_promo_free_female' ? 'PHOTOPUBLISHED'
                         : variant === 'non_id_verify_male'      ? 'PROFILEVERIFYPAID'
                         : 'PHOTOPUBLISHPAID'
        const raw = reg?.[bannerKey]?.['Banner'] ?? {}
        setHeroBannerContent({
          title:      raw['TITLE'] || 'Profile not active yet!',
          body:       raw['BODY']  || 'Upload your photo to activate profile and let matches see you',
          ctaLabel:   raw['CTA']   || 'Add photo now',
          ctaBgColor: raw['CTABGCOLOR']?.startsWith?.('#') ? raw['CTABGCOLOR'] : undefined,
          ctaColor:   raw['CTACOLOR']?.startsWith?.('#')   ? raw['CTACOLOR']   : undefined,
        })
      } else if (variant === 'default') {
        const details = await getHeroBannerDetails(false)
        if (ctrl.cancelled) return
        setHeroBannerContent({
          title:    details?.['TITLE'] || 'Upgrade your membership',
          body:     details?.['BODY']  || '',
          ctaLabel: details?.['CTA']   || 'Upgrade now',
        })
      } else {
        setHeroBannerContent(null)
      }

      // Angular: footer.component.ts's paymentService.getMenuPromo(0) — fetched
      // once, feeds both the assist banner (ASSISTEDPROMO) and the footer's
      // membership upgrade tag (MENUDISCOUNT) below. Cached by getMenuPromo
      // itself, so this doesn't duplicate the assist-banner-specific fetch.
      const menuPromo = await getMenuPromo('MENU')
      if (ctrl.cancelled) return

      // ── Assist ("breather") banner — Angular: takes precedence over the hero
      // banner slot entirely when ASSISTEDFLAG is set and not locally dismissed.
      if (computeShowAssistBanner(data?.['ASSISTEDFLAG'], assistDismissed)) {
        const assisted = menuPromo?.['ASSISTEDPROMO']
        if (assisted) {
          setAssistContent({
            title:    assisted['TITLE'] ?? '',
            body:     assisted['BODY']  ?? '',
            ctaLabel: assisted['CTA']   ?? 'Know more',
          })
        }
      }

      // ── Footer membership upgrade tag — Angular: footer.component.ts —
      // membershipExpiry = ppSetData.NUMBEROFPAYMENTS > 0; upgradeTag =
      // MENUDISCOUNT, cleared to '' for zero-value tags or paid members.
      const membershipExpiry = Number(data?.['NUMBEROFPAYMENTS'] ?? 0) > 0
      let tag = String(menuPromo?.['MENUDISCOUNT'] ?? '')
      if (['0', '0 OFF', '₹0 OFF'].includes(tag) || entryTypeVal === 'P') tag = ''
      setUpgradeTag(tag)
      // Angular's exact showRedDot trigger lives outside footer.component.ts
      // (a separate common.ts flag set elsewhere) and isn't traced here —
      // approximated as "would show the tag at all" rather than guessed further.
      setShowMembershipDot(membershipExpiry && entryTypeVal === 'F' && !!tag)

      // ── Sticky banner — force-update (Angular/MatchesScreen.tsx line 1115's
      // exact comparison, copied verbatim for parity) takes priority; else the
      // profile-validation-rejected banner when PISTATUS is 5 (rejected) or 13
      // (under review).
      const psUpdateFlag = await getItem('PLAYSTOREUPDATE')
      const appVersion = Constants.expoConfig?.version ?? '1.0.0'
      const forceUpdate = computeForceUpdateInfo(data?.['APPFORCEUPDATE'], psUpdateFlag, appVersion)
      if (ctrl.cancelled) return
      setForceUpdateInfo(forceUpdate)

      if (!forceUpdate && ['5', '13'].includes(String(data?.['PISTATUS']))) {
        const validationBanner = await fetchProfileValidationBanner()
        if (!ctrl.cancelled && validationBanner?.show) setProfileValidationBanner(validationBanner)
      }
    })

    fetchMatches(0, 10).then(result => {
      if (ctrl.cancelled) return
      if (result.items.length > 0) {
        setAllMatches(result.items)
        setAllMatchesTotal(result.totalCount)
      }
      setAllMatchesLoaded(true)
    })
    fetchViewedYou().then(result => {
      if (!ctrl.cancelled && result.items.length > 0) {
        setViewedMe(result.items)
        setViewedMeTotal(result.totalCount)
      }
    })
    fetchDailyRec().then(result => {
      if (!ctrl.cancelled && result.items.length > 0) {
        setTodayMatches(result.items.slice(0, 4))
        setTodayTotal(result.totalCount)
      }
    })
    fetchNewlyJoined().then(result => {
      if (ctrl.cancelled) return
      if (result.items.length > 0) {
        setNewlyJoined(result.items.slice(0, 4))
        setNewlyJoinedTotal(result.totalCount)
      }
      setNewlyJoinedLoaded(true)
    })
    fetchViewedByMe().then(result => {
      if (!ctrl.cancelled && result.items.length > 0) {
        setProfilesViewed(result.items.slice(0, 5))
        setProfilesViewedTotal(result.totalCount)
      }
    })
    // Fetched together (rather than two independent .then()s) so the default-tab
    // decision (Angular's "singlelikedlist" behavior) sees both real totals at
    // once — computing it off either promise alone would race against whichever
    // of the two resolves first.
    Promise.all([fetchLikedByMe(), fetchLikedYou(), getItem(StorageKeys.User.LOGIN_GENDER)]).then(
      ([likedByMeResult, likedYouResult, g]) => {
        if (ctrl.cancelled) return
        if (likedByMeResult.items.length > 0) {
          setLikedByMe(likedByMeResult.items)
          setLikedByMeTotal(likedByMeResult.totalCount)
        }
        if (likedYouResult.items.length > 0) {
          setLikedMe(likedYouResult.items)
          setLikedMeTotal(likedYouResult.totalCount)
        }
        setLikedTab(computeDefaultLikedTab(g === 'M' ? 'M' : 'F', likedYouResult.totalCount, likedByMeResult.totalCount))
      }
    )
    fetchSuccessStories().then(result => {
      if (!ctrl.cancelled && result.length > 1) setStories(result.slice(0, 5))
    })
    fetchFaqVideos().then(result => {
      if (!ctrl.cancelled && result.length > 0) setVideos(result)
    })
    fetchCustomerCare().then(result => {
      if (!ctrl.cancelled && (result.phone || result.whatsapp)) setCustomerCare(result)
    })
    fetchNotifCount().then(result => {
      if (!ctrl.cancelled) setComCount(result.comCount)
    })

    // Header/footer-critical data is ready once session+PPSET has resolved —
    // Angular: contentLoaded gates the ENTIRE page (no header/footer) until
    // this point; individual list sections keep their own mock-then-real /
    // skeleton-loader treatment after that.
    Promise.all([fetchHomeSession(), fetchAndStorePPSetData()]).finally(() => {
      if (!ctrl.cancelled) setContentLoaded(true)
    })
  }, [assistDismissed, paymentFailedDismissed])

  // Angular: ionViewDidEnter() — re-runs every time Home regains focus (tab
  // switch, back-navigation), not just on first mount. `isFirstFocusRef` mirrors
  // ngOnInit-vs-ionViewDidEnter: the first focus gets includePopups=true (fires
  // once-per-mount analytics/tracking), every later focus gets false.
  const isFirstFocusRef = useRef(true)
  useFocusEffect(
    useCallback(() => {
      const ctrl = { cancelled: false }
      const includePopups = isFirstFocusRef.current
      isFirstFocusRef.current = false
      loadHome(ctrl, includePopups)
      return () => { ctrl.cancelled = true }
    }, [loadHome])
  )

  // Angular: changeLanguage() (explore.component.ts) — switching language tears
  // down and rebuilds the whole page so every server-rendered string re-fetches
  // in the new language. Same mountedLangRef pattern as MatchesScreen.tsx:1282-1294
  // — skips the initial mount (already covered by the focus effect above) and
  // only reloads on a REAL change.
  const mountedLangRef = useRef(i18n.language)
  useEffect(() => {
    if (i18n.language === mountedLangRef.current) return
    mountedLangRef.current = i18n.language
    const ctrl = { cancelled: false }
    loadHome(ctrl, false)
    return () => { ctrl.cancelled = true }
  }, [i18n.language, loadHome])

  // ── Live notification counts via socket (Angular: socketService.getNotificationLogin()
  // subscription in ngAfterViewInit) — connects once, requests counts, and updates
  // comCount live rather than only on load/focus. Nothing else in this app has
  // wired this socket up yet, so this is the first real consumer.
  useEffect(() => {
    let cancelled = false
    socketConnection(EnvConfig.notify).then(() => {
      if (cancelled) return
      emitNotificationDetails()
    })
    const unsubscribe = onNotificationList((data: any) => {
      if (cancelled || !data) return
      const list = data?.['COMCOUNT'] ?? data?.['RESPONSE']?.['COMCOUNT']
      if (Array.isArray(list)) setComCount(list)
    })
    return () => { cancelled = true; unsubscribe() }
  }, [])

  const hasPaidBadge = computeHasPaidBadge(
    entryType, payRenewalFlag,
    isPaidVerifiedNoPhotoMale(entryType, ekycStatus, gender, ppSetData?.['PI_PHOTOSTATUS'] ?? 'N'),
  )

  const toolbar = buildToolbar(comCount)
  const selfHelpVisible = computeSelfHelpVideosVisible(lang)

  // ── Navigation / action handlers ───────────────────────────────────────────

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 4: navigation.navigate('Search');   break
      // Angular: footer.component.ts — paymentTrack(31) fires right before
      // routing a free member to the payment intermediate page.
      case 3: paymentTrack('31'); navigation.navigate('recharge', { fromTab: true }); break
    }
  }

  function handleToolbarPress(toolType: string) {
    // Angular: header.component.ts's reDirectPage() — discover-matches icon
    // goes to /search; notification icon goes to /notification (no dedicated
    // notification route exists in this app yet — Activity is the closest
    // existing equivalent, same underlying activity counts).
    if (toolType === 'discover-matches') navigation.navigate('Search')
    if (toolType === 'notification')     navigation.navigate('Activity')
    if (toolType === 'menu')             navigation.navigate('Menu')
  }

  // Angular: onclickPayNowCTA(type) — dispatches per the variant currently shown.
  function handleHeroBannerPress() {
    switch (heroBannerVariant) {
      case 'payment_failed':
        navigation.navigate('recharge', { fromTab: false })
        break
      case 'photo_promo_free_female':
      case 'paid_verified_no_photo':
        navigation.navigate('Gallery')
        break
      case 'non_id_verify_male':
        /* TODO: no verify-id screen registered yet */
        break
      default:
        paymentTrack('98')
        redirectToIntermediatePage('home')
    }
  }

  // Angular: onHomeBannerClose('paymentFailedPromotion') — session-scoped dismiss,
  // only meaningful for the payment-failed variant (the other variants aren't
  // closable in Angular either).
  function handleHeroBannerDismiss() {
    if (heroBannerVariant === 'payment_failed') {
      setPaymentFailedDismissed(true)
      setHeroBannerVariant(null)
      setHeroBannerContent(null)
    }
  }

  // Angular: assist-banner CTA — paymentTrack('105') + dismiss + payment intermediate page.
  function handleAssistPress() {
    paymentTrack('105')
    setAssistDismissed(true)
    setAssistContent(null)
    redirectToIntermediatePage('home')
  }

  function handleAssistDismiss() {
    setAssistDismissed(true)
    setAssistContent(null)
    setItem(StorageKeys.Promotions.ASSISTED_PROMO, '1')
  }

  // ── Sticky banner (force-update / profile-validation) ─────────────────────
  const activeSticky: 'forceUpdate' | 'profileValidation' | null =
    stickyDismissed ? null : forceUpdateInfo ? 'forceUpdate' : profileValidationBanner ? 'profileValidation' : null

  function handleStickyPress() {
    if (activeSticky === 'forceUpdate') {
      const url = String(Constants.expoConfig?.extra?.['playStoreUrl'] ?? 'https://play.google.com/store/apps/details?id=jodii.app')
      Linking.openURL(url)
    } else if (activeSticky === 'profileValidation') {
      // Angular: opens a PCS bottom sheet to fix the flagged profile fields —
      // closest existing equivalent screen is EditProfile.
      navigation.navigate('EditProfile')
    }
  }

  function handleStickyClose() {
    if (activeSticky === 'forceUpdate') {
      setItem('PLAYSTOREUPDATE', '2')   // Angular: "show again next login"
    }
    setStickyDismissed(true)
  }

  // Angular: logScrollEnd(ev) — hides the sticky banner while actively
  // scrolling down past a small threshold; shows it again scrolling up or near
  // the top. Simplified from Angular's header-height-relative thresholds (no
  // overlaid header here to measure against) to a flat 40px scroll delta.
  function handleScroll(e: any) {
    const y = e.nativeEvent.contentOffset.y
    const delta = y - scrollYRef.current
    if (Math.abs(delta) < 10) return
    scrollYRef.current = y
    if (y > 40 && delta > 0) setHideStickyOnScroll(true)
    else if (delta < 0 || y < 40) setHideStickyOnScroll(false)
  }

  // Angular: clickOnViewProfile() → matriIdDBset() (prev/next swipe chain) →
  // navigate to <type>/viewprofile/<id>. redirectToViewProfile is the same
  // helper MatchesScreen.tsx uses, so ViewProfileScreen's swipe-through works
  // identically regardless of which screen navigated into it.
  function goToProfile(item: SwiperItem, sectionItems: SwiperItem[], fromPage: string) {
    if (!item.profileId) return
    const ids = sectionItems.map(i => i.profileId).filter((id): id is string => !!id)
    redirectToViewProfile('', item.profileId, fromPage, ids)
  }

  // Angular: clickOnLike() → communicationBtnOnClick('home', action, oppProfile)
  // → optimistic flip of LIKED in the local array (emitLikeDislikeProfiles()).
  function makeLikeHandler(setList: (updater: (prev: SwiperItem[]) => SwiperItem[]) => void) {
    return async (item: SwiperItem) => {
      if (!item.profileId) return
      const alreadyLiked = ['1', '2', '3'].includes(item.likedStatus ?? '0')
      const action = alreadyLiked ? 'dislike' : 'like'
      const result = await communicationBtnOnClick('home', action, { MATRIID: item.profileId })
      if (result.type === 'api_success') {
        setList(prev => prev.map(p => (
          p.profileId === item.profileId ? { ...p, likedStatus: action === 'like' ? '1' : '0' } : p
        )))
      }
    }
  }

  // setX setters are referentially stable across renders, so these don't need
  // useCallback — makeLikeHandler(setX) itself is already a fresh closure per
  // render either way, wrapping it would just add indirection with no benefit.
  const likeAllMatches   = makeLikeHandler(setAllMatches)
  const likeViewedMe     = makeLikeHandler(setViewedMe)
  const likeTodayMatches = makeLikeHandler(setTodayMatches)
  const likeNewlyJoined  = makeLikeHandler(setNewlyJoined)
  const likeProfilesViewed = makeLikeHandler(setProfilesViewed)
  const likeLikedByMe    = makeLikeHandler(setLikedByMe)
  const likeLikedMe      = makeLikeHandler(setLikedMe)

  // Angular: redirectToPCS(cardDetails) — each card type navigates to its own
  // edit screen. IDVERIFY has no registered route in this app yet (no dedicated
  // screen exists) — left as a TODO no-op rather than guessing.
  // StarRaasiScreen moved from page '29' to '33' when the horoscope generation
  // flow (pages 29/30/31) was added — '29' is now GenerateHoroscopeScreen.
  function handleCompleteProfileCard(card: CompleteProfileCard) {
    switch (card.type) {
      case 'PHOTO':       navigation.navigate('Gallery'); break
      case 'STAR_RAASI':  navigation.navigate('onboarding', { pageNo: '33', standalone: true }); break
      case 'PROPERTY':
      case 'VEHICLE':     navigation.navigate('onboarding', { pageNo: '28', standalone: true }); break
      case 'FAMILY':      navigation.navigate('onboarding', { pageNo: '27', standalone: true }); break
      case 'DIET':        navigation.navigate('onboarding', { pageNo: '38', standalone: true }); break
      case 'HOMETOWN':    navigation.navigate('onboarding', { pageNo: '44', standalone: true }); break
      case 'HOROSCOPE':   navigation.navigate('onboarding', { pageNo: '29', standalone: true }); break
      case 'IDVERIFY':    /* TODO: no verify-id screen registered yet */ break
    }
  }

  // Angular: getHelbBannerData()'s CTA click → callNative('dial_pad') — dials
  // customer care directly. No WhatsApp option exists in Home's help section.
  function handleCallPress() {
    if (customerCare.phone) Linking.openURL(`tel:${customerCare.phone}`)
  }

  // ── Desktop web layout (Figma "Jodii Desktop - Registration", 161:10324) ───
  if (isDesktop) {
    return (
      <HomeDesktopLayout
        navigation={navigation}
        userName={userName}
        completionPct={completionPct}
        heroBannerVariant={heroBannerVariant}
        heroBannerContent={heroBannerContent}
        onHeroBannerPress={handleHeroBannerPress}
        onHeroBannerDismiss={handleHeroBannerDismiss}
        assistContent={assistDismissed ? null : assistContent}
        onAssistPress={handleAssistPress}
        onAssistDismiss={handleAssistDismiss}
        activeSticky={activeSticky}
        stickyText={activeSticky === 'forceUpdate' ? t('APP_UPDATE.NOTE') : profileValidationBanner?.message ?? ''}
        stickyCtaLabel={activeSticky === 'forceUpdate' ? t('APP_UPDATE.CTA') : profileValidationBanner?.ctaLabel ?? ''}
        onStickyPress={handleStickyPress}
        onStickyClose={handleStickyClose}
        allMatches={allMatches}
        allMatchesTotal={allMatchesTotal}
        viewedMe={viewedMe}
        viewedMeTotal={viewedMeTotal}
        todayMatches={todayMatches}
        todayTotal={todayTotal}
        newlyJoined={newlyJoined}
        newlyJoinedTotal={newlyJoinedTotal}
        profilesViewed={profilesViewed}
        profilesViewedTotal={profilesViewedTotal}
        completeCards={completeCards}
        onCompleteProfileCardPress={handleCompleteProfileCard}
        likedTab={likedTab}
        onLikedTabChange={setLikedTab}
        likedByMe={likedByMe}
        likedByMeTotal={likedByMeTotal}
        likedMe={likedMe}
        likedMeTotal={likedMeTotal}
        categories={categories}
        stories={stories}
        videos={videos}
        selfHelpVisible={selfHelpVisible}
        customerCare={customerCare}
        onCardPress={item => goToProfile(item, allMatches, 'home')}
        onTabPress={handleTabPress}
      />
    )
  }

  if (!contentLoaded) {
    return <Loader variant="spinner" fullPage />
  }

  return (
    <View style={s.screen}>

      <AppHeader
        type="header1"
        userImg={userImg}
        userName={userName}
        completionPct={completionPct}
        hasPaidBatch={hasPaidBadge}
        homeToolBar={toolbar}
        // Angular: avatar tap opens "my profile" (self view-profile). No
        // self-view route/flow exists anywhere in this app yet (confirmed —
        // not just here) and viewProfile requires a real matriId, so this
        // routes to EditProfile instead of passing an empty one that could
        // break ViewProfileScreen — TODO once a self-view route exists.
        onAvatarPress={() => navigation.navigate('EditProfile')}
        onEditProfilePress={() => navigation.navigate('onboarding', { pageNo: '2', standalone: true })}
        onToolbarItemPress={handleToolbarPress}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        bounces
        overScrollMode="never"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

        {/* ════════════ HERO BANNER / ASSIST BANNER (mutually exclusive) ════════════
            Angular: <app-home-banner *ngIf="heroBannerData && !assistFlag && ..."/>
            vs. <app-breather *ngIf="assistFlag && assistBannerData"/> — assist wins. */}
        {!assistDismissed && assistContent ? (
          <AssistBanner content={assistContent} onPress={handleAssistPress} onDismiss={handleAssistDismiss} />
        ) : heroBannerVariant && heroBannerContent ? (
          <HeroBanner
            content={heroBannerContent}
            onPress={handleHeroBannerPress}
            onDismiss={heroBannerVariant === 'payment_failed' ? handleHeroBannerDismiss : undefined}
          />
        ) : null}

        {/* ════════════ ALL MATCHES ════════════ */}
        <View style={s.section}>
          {!allMatchesLoaded ? (
            <Loader variant="skeleton-dashboard" />
          ) : allMatches.length > 1 ? (
            <SwiperCard
              swiperHeader={`All matches (${allMatchesTotal})`}
              cardVariant={1}
              // Angular: core/enums/home.enum.ts — allMatches maps to the
              // section string 'matches', NOT 'newmatches' (that's Newly
              // Joined's section below). ProfileCard.tsx's basicDetail()
              // specifically omits the education suffix for section==='matches'
              // — this was wired to the wrong section, so All Matches always
              // showed "age, education" instead of Angular's age-only line.
              cardSection="matches"
              items={allMatches}
              showSeeAll
              onCardPress={item => goToProfile(item, allMatches, 'home_matches')}
              onLikePress={likeAllMatches}
              onSeeAllPress={() => navigation.navigate('Matches')}
            />
          ) : null}
        </View>

        <View style={s.divider} />

        {/* ════════════ PROFILES WHO VIEWED ME ════════════
            Angular: profilesWhoviewedYouSection.blockbgColor = 'dot-img-bg' —
            a decorative background SVG plus a light pink-to-white gradient,
            not the plain white every other (non-special-cased) section uses. */}
        {viewedMeTotal > 3 && (
          <>
            <LinearGradient colors={['#FFF1FF', '#FFFFFF']} style={s.section}>
              <Image
                source={{ uri: `${CDN}revamp/who-viewed-bg-color.svg` }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <SwiperCard
                swiperHeader={`Who viewed your profile (${viewedMeTotal})`}
                newCount={comCountFor(comCount, 'viewedyou')}
                cardVariant={3}
                cardSection="viewedyou"
                items={viewedMe}
                showSeeAll
                onCardPress={item => goToProfile(item, viewedMe, 'home_viewedyou')}
                onLikePress={likeViewedMe}
                onSeeAllPress={() => navigation.navigate('Activity')}
              />
            </LinearGradient>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ COMPLETE YOUR PROFILE ════════════ */}
        {completeCards.length > 0 && (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>Complete your profile</Text>
              <CompleteProfileSection cards={completeCards} onCardPress={handleCompleteProfileCard} />
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ TODAY'S MATCHES (Daily Recommendation) ════════════
            Angular: *ngIf="swiperDRContents?.length > 0" — unlike All Matches/
            Newly Joined (>1), this section's threshold is just >0. Missing
            this gate left a stray empty section + divider gap when there's no
            daily-rec data. */}
        {todayMatches.length > 0 && (
          <>
            <View style={s.section}>
              <SwiperCard
                // Angular: DAILYRECOMMENDATIONS.DAILY_RECOMMENDATIONS — "Daily recommendations", not "Today's matches for you".
                swiperHeader={`Daily recommendations (${todayTotal})`}
                cardVariant={1}
                cardSection="dailyrecommendations"
                items={todayMatches}
                showSeeAll
                onCardPress={item => goToProfile(item, todayMatches, 'home_dailyrec')}
                onLikePress={likeTodayMatches}
                onSeeAllPress={() => navigation.navigate('Matches')}
              />
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ NEWLY JOINED ════════════
            Angular: newlyJoinedSection.blockbgColor = 'pink-bg-block' —
            linear-gradient(#FCEBFF → #FFFFFF), not the plain white every
            other section here uses. */}
        <LinearGradient colors={['#FCEBFF', '#FFFFFF']} style={s.section}>
          {!newlyJoinedLoaded ? (
            <Loader variant="skeleton-dashboard" />
          ) : newlyJoined.length > 1 ? (
            <SwiperCard
              swiperHeader={`Newly joined (${newlyJoinedTotal})`}
              cardVariant={1}
              cardSection="newmatches"
              items={newlyJoined}
              showSeeAll
              onCardPress={item => goToProfile(item, newlyJoined, 'home_newmatches')}
              onLikePress={likeNewlyJoined}
              onSeeAllPress={() => navigation.navigate('Matches')}
            />
          ) : null}
        </LinearGradient>

        <View style={s.divider} />

        {/* ════════════ PROFILES YOU VIEWED ════════════ */}
        {profilesViewed.length > 0 && (
          <>
            <View style={s.section}>
              <SwiperCard
                swiperHeader={`Profiles you viewed (${profilesViewedTotal})`}
                newCount={comCountFor(comCount, 'viewedbyme')}
                cardVariant={3}
                cardSection="viewedbyme"
                items={profilesViewed}
                showSeeAll
                onCardPress={item => goToProfile(item, profilesViewed, 'home_viewedbyme')}
                onLikePress={likeProfilesViewed}
                onSeeAllPress={() => navigation.navigate('Activity')}
              />
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ LIKED PROFILES ════════════
            Angular: enums.likedprofile.blockbgColor = 'liked-profile-bg' — a
            cover-fit background SVG, not plain white. */}
        {(likedByMeTotal > 0 || likedMeTotal > 0) && (
          <>
            <ImageBackground source={{ uri: `${CDN}liked-profiles-bg.svg` }} style={s.section} resizeMode="cover">
              <LikedProfilesSection
                likedTab={likedTab}
                onTabChange={setLikedTab}
                likedByMe={likedByMe}
                likedMe={likedMe}
                likedByCount={likedByMeTotal}
                likedMeCount={likedMeTotal}
                onCardPress={item => goToProfile(item, likedTab === 'likedbyme' ? likedByMe : likedMe, 'home_liked')}
                onLikePress={likedTab === 'likedbyme' ? likeLikedByMe : likeLikedMe}
              />
            </ImageBackground>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ EXPLORE CATEGORIES ════════════ */}
        {categories.length > 0 && (
          <>
            <View style={s.section}>
              <ExploreCategoriesSection
                categories={categories}
                tileWidth={(SW - 32 - 8) / 2}
                onCategoryPress={cat => navigation.navigate('Matches', { exploreType: cat.id, exploreLabel: cat.label })}
              />
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ SUCCESS STORIES ════════════ */}
        {stories.length > 1 && (
          <>
            <View style={s.section}>
              <SuccessStoriesSection
                stories={stories}
                // Success stories are married couples, not viewable member
                // profiles — no per-story detail route exists anywhere in this
                // app (confirmed: SuccessStoriesScreen is a flat list with its
                // own in-screen photo viewer, not a routable id). Tapping a
                // preview card on Home opens that same list screen.
                onCardPress={() => navigation.navigate('SuccessStories')}
              />
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ SELF-HELP VIDEOS (non-English UI only) ════════════ */}
        {selfHelpVisible && videos.length > 0 && (
          <>
            <View style={s.section}>
              <SelfHelpVideosSection
                videos={videos}
                cardWidth={SW * 0.58}
                cardHeight={SW * 0.33}
                onVideoPress={item => item.videoUrl && setVideoModalUrl(item.videoUrl)}
              />
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* ════════════ HELP SECTION ════════════ */}
        <View style={s.section}>
          <HelpSection onCallPress={handleCallPress} phone={customerCare.phone} />
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {activeSticky === 'forceUpdate' && !hideStickyOnScroll && (
        <ForceUpdateCard onPress={handleStickyPress} onClose={handleStickyClose} />
      )}
      {activeSticky === 'profileValidation' && !hideStickyOnScroll && (
        <StickyBanner
          text={profileValidationBanner!.message}
          ctaLabel={profileValidationBanner!.ctaLabel}
          onPress={handleStickyPress}
          onClose={handleStickyClose}
        />
      )}

      <Modal visible={!!videoModalUrl} animationType="slide" onRequestClose={() => setVideoModalUrl(null)}>
        <View style={s.videoModal}>
          <Pressable style={s.videoModalClose} onPress={() => setVideoModalUrl(null)}>
            <Text style={s.videoModalCloseText}>✕</Text>
          </Pressable>
          {!!videoModalUrl && <SelfHelpVideoPlayer uri={videoModalUrl} />}
        </View>
      </Modal>

      <AppFooter
        activeTab={0}
        likesCount={likedMeTotal}
        upgradeTag={upgradeTag || undefined}
        showMembershipDot={showMembershipDot}
        onTabPress={handleTabPress}
      />

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.white },
  scroll:  { flex: 1 },
  section: { paddingTop: 20, paddingBottom: 4 },
  divider: { height: 8, backgroundColor: '#F5F5F5' },
  hList:   { paddingHorizontal: 16 },

  sectionTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textPrimary, paddingHorizontal: 16, marginBottom: 12 },

  // Complete profile card
  cpCard:    { marginHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.divider, backgroundColor: Colors.white },
  cpRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  cpIcon:    { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cpIconImg: { width: 24, height: 24 },
  cpText:    { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textPrimary },
  cpAdd:     { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.primary },
  cpDivider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 14 },

  // Liked profiles tabs
  tabRow:             { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#F5F5F5', borderRadius: 8, padding: 3 },
  tabPill:            { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  tabPillActive:      { backgroundColor: Colors.white, shadowColor: Colors.shadow, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabPillText:        { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary },
  tabPillTextActive:  { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: Colors.textPrimary },

  // Explore categories
  // Angular: .discover-new-bg — 12px radius, 1px #E6E6E6 border, compact
  // icon+text row (not a big image tile), default background a light diagonal
  // gradient (applied via LinearGradient at the call site, not here).
  catGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  catTile:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E6E6E6', paddingVertical: 8, paddingHorizontal: 8, minHeight: 64 },
  catIconWrap:  { width: 32, height: 32, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  catIconImg:   { width: 28, height: 28 },
  catLabel:     { flex: 1, fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.textPrimary, lineHeight: 16 },
  catChevron:   { color: '#29339B', fontFamily: 'Poppins-SemiBold' },

  // Success stories header
  storyHeader:    { paddingHorizontal: 16, marginBottom: 12 },
  storyTitle:     { fontFamily: 'Poppins-Regular', fontSize: 18, color: Colors.textPrimary },
  storyTitleBold: { fontFamily: 'Poppins-Bold',    fontSize: 22, color: Colors.primary },
  storySubtitle:  { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textPrimary, marginTop: 8, lineHeight: 20 },

  // Self-help videos
  videoCard:     { borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: Colors.white },
  videoThumbImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  playBtn:       { position: 'absolute', top: '50%', left: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, alignItems: 'center', justifyContent: 'center' },
  videoCaptionScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingTop: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  videoTitle:    { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.white, lineHeight: 16 },

  // Help section
  // Angular: FAQ_DETAILS.BANNER — title/body/link-CTA on a gradient card with
  // a decorative image, not two call/whatsapp buttons.
  helpWrap:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, padding: 16, gap: 12 },
  helpTextCol:   { flex: 1 },
  helpTitle:     { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.textPrimary, marginBottom: 6 },
  helpSub:       { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, marginBottom: 10, lineHeight: 20 },
  helpCta:       { flexDirection: 'row', alignItems: 'center' },
  helpCtaText:   { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#29339B' },
  helpCtaChevron: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#29339B', marginLeft: 4 },
  helpImage:     { width: 80, height: 80 },

  // Self-help video modal
  videoModal:      { flex: 1, backgroundColor: '#000' },
  videoModalClose: { position: 'absolute', top: 48, right: 16, zIndex: 1, padding: 8 },
  videoModalCloseText: { fontSize: 22, color: Colors.white },
  videoModalPlayer: { flex: 1 },
})
