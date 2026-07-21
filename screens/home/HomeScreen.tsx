import { useEffect, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import HomeHeader, { type ToolbarItem } from '../../components/home-header/HomeHeader'
import SwiperCard, { type SwiperItem } from '../../components/swiper-card/SwiperCard'
import { paymentTrack } from '../../service/paymentService'
import { Colors } from '../../constants/colors'
// The rest of this screen's data is still mock (see MOCK_* below) — this section
// is the one exception, now that the Matches screen it hands off to can actually
// consume a real FILTERTYPE via fetchExplore().
import { fetchExploreCategories, type ExploreCategory } from '../../service/homeService'
// API imports commented out — will wire up after matches landing page is built
// import {
//   fetchHomeSession,
//   fetchMatches,
//   refreshSession,
//   type HomeSession,
//   type ListingResult,
//   EMPTY_LISTING,
// } from '../../service/homeService'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN = 'https://imgs.jodii.app/assets/images/svg/'
const { width: SW } = Dimensions.get('window')

const BIG_CARD_W = SW - 32   // full-width card for Today's matches
const CAT_W      = (SW - 48 - 8) / 2
const CAT_H      = CAT_W * 0.72

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const TOOLBAR: ToolbarItem[] = [
  { toolType: 'notification', toolImg: CDN + 'revamp/notification.svg', showNotification: false },
  { toolType: 'chat',         toolImg: CDN + 'revamp/chat.svg' },
  { toolType: 'menu',         toolImg: CDN + 'revamp/menu-alt.svg' },
]

// ─── Mock Data ────────────────────────────────────────────────────────────────

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

// ExploreCategory type imported from homeService — same shape, real fetch backs it now.
const MOCK_CATEGORIES: ExploreCategory[] = [
  { id: 'c1', label: 'Diploma and below',    count: 33,  imageUrl: '' },
  { id: 'c2', label: 'Graduate and above',   count: 55,  imageUrl: '' },
  { id: 'c3', label: 'Same community',       count: 99,  imageUrl: '' },
  { id: 'c4', label: 'Own business',         count: 40,  imageUrl: '' },
]

interface HelpVideo { id: string; title: string; thumbUrl: string }
const MOCK_VIDEOS: HelpVideo[] = [
  { id: 'v1', title: 'How to search matches as per your preferences', thumbUrl: '' },
  { id: 'v2', title: 'Tips to get more profile views',                 thumbUrl: '' },
]

// ─── Offer Banner ─────────────────────────────────────────────────────────────

function OfferBanner({ onPlayNow }: { onPlayNow?: () => void }) {
  return (
    <View style={ob.wrap}>
      <View style={ob.left}>
        <Text style={ob.label}>Special Offer!</Text>
        <Text style={ob.saveLine}>{'Save upto '}<Text style={ob.amount}>₹150</Text></Text>
        <View style={ob.countdown}>
          <Text style={ob.cdText}>{'Offer ends in '}<Text style={ob.cdBold}>29h : 48m : 14s</Text></Text>
        </View>
        <Pressable style={ob.btn} onPress={onPlayNow}>
          <Text style={ob.btnText}>Play Now</Text>
        </Pressable>
      </View>
      <View style={ob.right}>
        <CdnSvg uri={CDN + 'revamp/gift-box.svg'} width={90} height={90} />
      </View>
    </View>
  )
}
const ob = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#EBF0FF' },
  left:      { flex: 1, gap: 4 },
  label:     { fontFamily: 'Poppins-Medium',    fontSize: 13, color: Colors.textPrimary },
  saveLine:  { fontFamily: 'Poppins-Regular',   fontSize: 13, color: Colors.textPrimary },
  amount:    { fontFamily: 'Poppins-Bold',      fontSize: 22, color: '#29339B' },
  countdown: { borderLeftWidth: 2, borderLeftColor: '#29339B', backgroundColor: 'rgba(41,51,155,0.06)', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start', marginTop: 2 },
  cdText:    { fontFamily: 'Poppins-Regular',   fontSize: 11, color: Colors.textSecondary },
  cdBold:    { fontFamily: 'Poppins-Bold',      color: Colors.textPrimary },
  btn:       { backgroundColor: '#29339B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 24, alignSelf: 'flex-start', marginTop: 8 },
  btnText:   { fontFamily: 'Poppins-SemiBold',  fontSize: 13, color: Colors.white },
  right:     { width: 110, height: 90, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  gift:      { width: 90, height: 90 },
})

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: { navigation: any }) {
  const [likedTab, setLikedTab] = useState<'me' | 'them'>('me')
  const [categories, setCategories] = useState<ExploreCategory[]>(MOCK_CATEGORIES)

  useEffect(() => {
    let cancelled = false
    fetchExploreCategories().then(result => {
      if (!cancelled && result.length > 0) setCategories(result)
    })
    return () => { cancelled = true }
  }, [])

  const userName      = 'Deepak Venkatara...'
  const completionPct = 70
  const likesCount    = 37
  const upgradeTag    = '₹200 OFF'

  const likedProfiles = likedTab === 'me' ? MOCK_LIKED_BY_ME : MOCK_LIKED_ME

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 4: navigation.navigate('Search');   break
      // Angular: footer.component.ts — paymentTrack(31) fires right before
      // routing a free member to the payment intermediate page.
      case 3: paymentTrack('31'); navigation.navigate('recharge'); break
    }
  }

  function handleToolbarPress(toolType: string) {
    if (toolType === 'notification') navigation.navigate('notification')
    if (toolType === 'chat')         navigation.navigate('Messages')
    if (toolType === 'menu')         navigation.navigate('Menu')
  }

  function goToProfile(item: SwiperItem) {
    if (item.profileId) navigation.navigate('viewprofile', { id: item.profileId })
  }

  return (
    <View style={s.screen}>

      {/* ── Header — separate component, SafeAreaView edges={['top']} inside ── */}
      <HomeHeader
        userName={userName}
        completionPct={completionPct}
        homeToolBar={TOOLBAR}
        languageLabel="English"
        onAvatarPress={() => navigation.navigate('viewprofile', { self: true })}
        onEditProfilePress={() => navigation.navigate('onboarding', { pageNo: '2' })}
        onToolbarItemPress={handleToolbarPress}
        onLanguagePress={() => {}}
      />

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} bounces overScrollMode="never">

        {/* Offer Banner */}
        <OfferBanner onPlayNow={() => navigation.navigate('recharge')} />

        {/* ════════════ ALL MATCHES ════════════ */}
        <View style={s.section}>
          <SwiperCard
            swiperHeader="All matches (226)"
            cardVariant={1}
            cardSection="newmatches"
            items={MOCK_ALL_MATCHES}
            showSeeAll
            onCardPress={(item) => goToProfile(item)}
            onSeeAllPress={() => navigation.navigate('Matches')}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ PROFILES WHO VIEWED ME ════════════ */}
        <View style={s.section}>
          <SwiperCard
            swiperHeader="Profiles who viewed me (26)"
            newCount={16}
            cardVariant={3}
            cardSection="viewedyou"
            items={MOCK_VIEWED_ME}
            showSeeAll
            onCardPress={(item) => goToProfile(item)}
            onSeeAllPress={() => {}}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ COMPLETE YOUR PROFILE ════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Complete your profile</Text>
          <View style={s.cpCard}>
            <Pressable style={s.cpRow} onPress={() => navigation.navigate('onboarding', { pageNo: '16' })}>
              <View style={s.cpIcon}>
                <CdnSvg uri={CDN + 'revamp/horoscope-icon.svg'} width={24} height={24} />
              </View>
              <Text style={s.cpText}>Add horoscope details</Text>
              <Text style={s.cpAdd}>Add {'>'}</Text>
            </Pressable>
            <View style={s.cpDivider} />
            <Pressable style={s.cpRow} onPress={() => navigation.navigate('onboarding', { pageNo: '27' })}>
              <View style={s.cpIcon}>
                <CdnSvg uri={CDN + 'revamp/star-icon.svg'} width={24} height={24} />
              </View>
              <Text style={s.cpText}>Add star/raasi details</Text>
              <Text style={s.cpAdd}>Add {'>'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.divider} />

        {/* ════════════ TODAY'S MATCHES ════════════ */}
        <View style={s.section}>
          <SwiperCard
            swiperHeader="Today's matches for you (26)"
            cardVariant={1}
            cardSection="dailyrecommendations"
            items={MOCK_TODAY_MATCHES}
            cardWidth={BIG_CARD_W}
            showSeeAll
            onCardPress={(item) => goToProfile(item)}
            onSeeAllPress={() => navigation.navigate('Matches')}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ NEWLY JOINED ════════════ */}
        <View style={s.section}>
          <SwiperCard
            swiperHeader="Newly joined (26)"
            cardVariant={1}
            cardSection="newmatches"
            items={MOCK_NEWLY_JOINED}
            showSeeAll
            onCardPress={(item) => goToProfile(item)}
            onSeeAllPress={() => {}}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ PROFILES YOU VIEWED ════════════ */}
        <View style={s.section}>
          <SwiperCard
            swiperHeader="Profiles you viewed (97)"
            cardVariant={3}
            cardSection="viewedbyme"
            items={MOCK_PROFILES_VIEWED}
            showSeeAll
            onCardPress={(item) => goToProfile(item)}
            onSeeAllPress={() => {}}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ LIKED PROFILES ════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Liked profiles (37)</Text>
          {/* Tab toggle */}
          <View style={s.tabRow}>
            <Pressable style={[s.tabPill, likedTab === 'me'   && s.tabPillActive]} onPress={() => setLikedTab('me')}>
              <Text style={[s.tabPillText, likedTab === 'me'   && s.tabPillTextActive]}>Liked by you (26)</Text>
            </Pressable>
            <Pressable style={[s.tabPill, likedTab === 'them' && s.tabPillActive]} onPress={() => setLikedTab('them')}>
              <Text style={[s.tabPillText, likedTab === 'them' && s.tabPillTextActive]}>Liked you (37)</Text>
            </Pressable>
          </View>
          <SwiperCard
            cardVariant={8}
            cardSection="likedprofile"
            items={likedProfiles}
            showSeeAll={false}
            onCardPress={(item) => goToProfile(item)}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ EXPLORE CATEGORIES ════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Explore matches based on</Text>
          <View style={s.catGrid}>
            {categories.map((cat, idx) => (
              <Pressable
                key={cat.id}
                style={s.catTile}
                onPress={() => navigation.navigate('Matches', { exploreType: cat.id, exploreLabel: cat.label })}
              >
                <View style={s.catImgBox}>
                  {cat.imageUrl
                    ? <Image source={{ uri: cat.imageUrl }} style={s.catImg} resizeMode="cover" />
                    : <View style={[s.catImg, { backgroundColor: ['#EDE7F6','#E3F2FD','#FCE4EC','#E8F5E9'][idx % 4] }]} />
                  }
                </View>
                <View style={s.catInfo}>
                  <Text style={s.catLabel} numberOfLines={2}>{cat.label}</Text>
                  <Text style={s.catCount}>{cat.count}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable style={s.discoverBtn} onPress={() => {}}>
            <Text style={s.discoverText}>Discover all categories {'>'}</Text>
          </Pressable>
        </View>

        <View style={s.divider} />

        {/* ════════════ SUCCESS STORIES ════════════ */}
        <View style={s.section}>
          <View style={s.storyHeader}>
            <Text style={s.storyTitle}>Made with</Text>
            <Text style={s.storyTitleBold}>Love in Jodii</Text>
          </View>
          <SwiperCard
            cardVariant={4}
            cardSection="successstory"
            items={MOCK_STORIES}
            showSeeAll={false}
            cardWidth={Math.round(SW * 0.68)}
            onCardPress={() => {}}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ SELF-HELP VIDEOS ════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Self-help videos</Text>
          <FlatList
            data={MOCK_VIDEOS}
            keyExtractor={i => i.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.hList}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            renderItem={({ item, index }) => (
              <Pressable style={s.videoCard} onPress={() => {}}>
                <View style={s.videoThumb}>
                  {item.thumbUrl
                    ? <Image source={{ uri: item.thumbUrl }} style={s.videoThumbImg} resizeMode="cover" />
                    : <View style={[s.videoThumbImg, { backgroundColor: ['#D6E8F6','#F6D6E0'][index % 2] }]} />
                  }
                  <View style={s.playBtn}>
                    <View style={s.playIcon} />
                  </View>
                </View>
                <Text style={s.videoTitle} numberOfLines={2}>{item.title}</Text>
              </Pressable>
            )}
          />
        </View>

        <View style={s.divider} />

        {/* ════════════ HELP SECTION ════════════ */}
        <View style={s.section}>
          <Text style={s.helpTitle}>Do you need help?</Text>
          <Text style={s.helpSub}>Feel free to connect with us everyday{'\n'}from 8 AM to 9 PM</Text>
          <View style={s.helpActions}>
            <Pressable style={s.callBtn} onPress={() => {}}>
              <CdnSvg uri={CDN + 'revamp/call-icon.svg'} width={22} height={22} />
              <Text style={s.callBtnText}>Call us +91 9876543210</Text>
            </Pressable>
            <Pressable style={s.waBtn} onPress={() => {}}>
              <CdnSvg uri={CDN + 'revamp/whatsapp-icon.svg'} width={22} height={22} />
              <Text style={s.waBtnText}>WhatsApp</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <AppFooter
        activeTab={0}
        likesCount={likesCount}
        upgradeTag={upgradeTag}
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
  catGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  catTile:      { width: CAT_W, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.divider },
  catImgBox:    { width: CAT_W, height: CAT_H },
  catImg:       { width: '100%', height: '100%' },
  catInfo:      { paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catLabel:     { fontFamily: 'Poppins-Medium', fontSize: 11, color: Colors.textPrimary, flex: 1 },
  catCount:     { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary },
  discoverBtn:  { marginHorizontal: 16, marginTop: 12, backgroundColor: Colors.primary, borderRadius: 8, height: 44, alignItems: 'center', justifyContent: 'center' },
  discoverText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.white },

  // Success stories header
  storyHeader:    { paddingHorizontal: 16, marginBottom: 12 },
  storyTitle:     { fontFamily: 'Poppins-Regular', fontSize: 18, color: Colors.textPrimary },
  storyTitleBold: { fontFamily: 'Poppins-Bold',    fontSize: 22, color: Colors.primary },

  // Self-help videos
  videoCard:     { width: SW * 0.58, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.white, shadowColor: Colors.shadow, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  videoThumb:    { width: '100%', height: SW * 0.33, position: 'relative' },
  videoThumbImg: { width: '100%', height: '100%' },
  playBtn:       { position: 'absolute', top: '50%', left: '50%', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', transform: [{ translateX: -20 }, { translateY: -20 }], alignItems: 'center', justifyContent: 'center' },
  playIcon:      { width: 0, height: 0, borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 16, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: Colors.white, marginLeft: 3 },
  videoTitle:    { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textPrimary, padding: 10 },

  // Help section
  helpTitle:   { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.textPrimary, paddingHorizontal: 16, marginBottom: 6 },
  helpSub:     { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, paddingHorizontal: 16, marginBottom: 16, lineHeight: 20 },
  helpActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, flexWrap: 'wrap' },
  callBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.divider, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  callBtnText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textPrimary },
  waBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  waBtnText:   { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },
  helpIconImg: { width: 22, height: 22 },
})
