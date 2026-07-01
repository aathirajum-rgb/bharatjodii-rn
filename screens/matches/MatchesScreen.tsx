// Angular equivalent: pages/matches/matches.page.ts + matches-card.component
// Landing page for existing users after login (WEBVIEWURL page_id = 60)
// Card layout mirrors matches-card.component.html exactly.

import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import { Colors } from '../../constants/colors'
import type { SwiperItem } from '../../components/swiper-card/SwiperCard'
import {
  fetchMatches,
  fetchNotifCount,
  fetchExtendedMatchesCount,
  fetchAndStorePPSetData,
  fetchDailyRecommendations,
  // refreshSession,  // TODO: uncomment when autologin endpoint is ready
} from '../../service/homeService'
import {
  communicationBtnOnClick,
} from '../../service/communicationService'

const CDN = 'https://imgs.jodii.app/assets/images/svg/'

const { width: SW } = Dimensions.get('window')
// Angular photoHeight is calculated dynamically; we approximate same ratio
const PHOTO_H = Math.round(SW * 0.85)

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchProfile {
  profileId:    string
  name:         string
  age:          string     // "27"
  location:     string     // city, state
  height?:      string
  education?:   string
  occupation?:  string
  income?:      string
  caste?:       string
  profileImg?:  string
  isPaidMember:     boolean
  isIdVerified:     boolean
  likedStatus:      '0' | '1' | '2' | '3'  // 0=none 1=liked 2=shortlisted 3=declined
  isNewlyJoined:    boolean
  likedDateText?:   string   // "You liked this profile on 16-Jan-2026"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Angular: bindBasicView() — order: age | height | caste | education | occupation | location
// (mirrors matches-card.component.ts bindBasicView exactly)
function buildBasicView(p: MatchProfile): string {
  const parts: string[] = []
  if (p.age)        parts.push(`${p.age} yrs`)
  if (p.height)     parts.push(p.height)
  if (p.caste)      parts.push(p.caste)
  if (p.education)  parts.push(p.education)
  if (p.occupation) parts.push(p.occupation)
  if (p.location)   parts.push(p.location)   // location at END (Angular)
  return parts.join(' | ')
}

// Angular: FUNC.showLikeCTA(likedStatus) — show Like/Don't Show/View Later when not yet liked/declined
function showLikeCTA(status: MatchProfile['likedStatus']): boolean {
  return status === '0'
}

// Angular: FUNC.showAfterLikeContent(likedStatus) — show Send Interest / chat CTA after like
function showAfterLikeCTA(status: MatchProfile['likedStatus']): boolean {
  return status === '1' || status === '2'
}

// ─── Match Card ───────────────────────────────────────────────────────────────
// Mirrors matches-card.component.html structure exactly.

function MatchCard({
  profile, onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp,
}: {
  profile:    MatchProfile
  onPress:    () => void
  onLike:     () => void
  onDontShow: () => void
  onViewLater:() => void
  onCall:     () => void
  onWhatsApp: () => void
}) {
  return (
    <View style={c.card}>

      {/* ── Photo section ──────────────────────────────────────────────────── */}
      {/* Angular: app-photo-new — top border radius 16px */}
      <Pressable style={[c.photoBox, { height: PHOTO_H }]} onPress={onPress}>
        {profile.profileImg ? (
          <Image source={{ uri: profile.profileImg }} style={c.photo} resizeMode="cover" />
        ) : (
          // Angular no-photo placeholder (default avatar)
          <View style={c.noPhoto}>
            <Image
              source={{ uri: CDN + 'add-photo-gallery.svg' }}
              style={c.noPhotoIcon}
              resizeMode="contain"
            />
            <Text style={c.noPhotoText}>No photos added</Text>
          </View>
        )}
      </Pressable>

      {/* ── Paid + Verified badges ─────────────────────────────────────────── */}
      {/* Angular: ion-row isProfileBadge — BELOW the photo, not overlaid */}
      {(profile.isPaidMember || profile.isIdVerified) && (
        <View style={c.badges}>
          {profile.isPaidMember && (
            <Image
              source={{ uri: CDN + 'revamp/paid-tag-revamp.svg' }}
              style={c.paidBadge}
              resizeMode="contain"
            />
          )}
          {profile.isIdVerified && (
            <Image
              source={{ uri: CDN + 'viewprofile/verified-tag-img.svg' }}
              style={c.verifiedBadge}
              resizeMode="contain"
            />
          )}
        </View>
      )}

      {/* ── Liked strip ────────────────────────────────────────────────────── */}
      {/* Angular: .liked-profile — pink gradient strip below badges */}
      {!!profile.likedDateText && profile.likedStatus === '1' && (
        <View style={c.likedStrip}>
          <Image
            source={{ uri: CDN + 'liked-new.svg' }}
            style={c.likedIcon}
            resizeMode="contain"
          />
          <Text style={c.likedText} numberOfLines={1}>{profile.likedDateText}</Text>
        </View>
      )}

      {/* ── Name + Call icon + WhatsApp icon ───────────────────────────────── */}
      {/* Angular: d-flex row: heading2-semibold-18 name + phone-icon + matches-whatsapp */}
      <View style={c.nameRow}>
        <Pressable style={{ flex: 1 }} onPress={onPress}>
          <Text style={c.name} numberOfLines={1}>{profile.name}</Text>
        </Pressable>
        <Pressable style={c.iconBtn} onPress={onCall} hitSlop={8}>
          <Image
            source={{ uri: CDN + 'revamp/call-revamp.svg' }}
            style={c.nameRowIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Pressable style={c.iconBtn} onPress={onWhatsApp} hitSlop={8}>
          <Image
            source={{ uri: CDN + 'whatsapp-revamp.svg' }}
            style={c.nameRowIconWa}
            resizeMode="contain"
          />
        </Pressable>
      </View>

      {/* ── Basic view text ────────────────────────────────────────────────── */}
      {/* Angular: bindBasicView() — "27 yrs | 5'5" | Brahmin | B.Tech | Engineer | Chennai, TN" */}
      <Pressable onPress={onPress}>
        <Text style={c.basicView} numberOfLines={4}>
          {buildBasicView(profile)}
        </Text>
      </Pressable>

      {/* ── View profile link ──────────────────────────────────────────────── */}
      {/* Angular: app-button-revamp [buttonType]="link" — "View profile →" */}
      <Pressable onPress={onPress} style={c.viewProfileBtn}>
        <Text style={c.viewProfileText}>View profile</Text>
      </Pressable>

      {/* ── CTA section ────────────────────────────────────────────────────── */}
      {/* Angular: showLikeCTA → Don't Show | View Later | Like
                  showAfterLikeCTA → Send Interest / after-like state */}
      {showLikeCTA(profile.likedStatus) && (
        <View style={c.ctaRow}>
          {/* Angular: tertiaryBtn = "Don't Show" */}
          <Pressable style={c.ctaDontShow} onPress={onDontShow}>
            <Text style={c.ctaDontShowText}>Don't Show</Text>
          </Pressable>

          {/* Angular: secondaryBtn = "View Later" */}
          <Pressable style={c.ctaViewLater} onPress={onViewLater}>
            <Text style={c.ctaViewLaterText}>View Later</Text>
          </Pressable>

          {/* Angular: primaryBtn = "Like" with heart icon */}
          <Pressable style={c.ctaLike} onPress={onLike}>
            <Image
              source={{ uri: CDN + 'like-not-selected.svg' }}
              style={c.ctaLikeIcon}
              resizeMode="contain"
            />
            <Text style={c.ctaLikeText}>Like</Text>
          </Pressable>
        </View>
      )}

      {showAfterLikeCTA(profile.likedStatus) && (
        // Angular: matches-cta-bg-color (pink gradient bg) + "Send interest" primary CTA
        <View style={c.afterLikeRow}>
          <Pressable style={c.ctaSendInterest} onPress={onPress}>
            <Text style={c.ctaSendInterestText}>Send Interest</Text>
          </Pressable>
        </View>
      )}

    </View>
  )
}

// ─── SwiperItem → MatchProfile mapper ────────────────────────────────────────

function toMatchProfile(item: SwiperItem): MatchProfile {
  // exactOptionalPropertyTypes: assign optional strings only when defined
  const p: MatchProfile = {
    profileId:    item.profileId    ?? '',
    name:         item.name         ?? '',
    age:          item.age?.replace(' Yrs', '') ?? '',   // "26 Yrs" → "26"
    location:     item.location     ?? '',
    isPaidMember: item.isPaidMember  ?? false,
    isIdVerified: item.isIdVerified  ?? false,
    likedStatus:  item.likedStatus   ?? '0',
    isNewlyJoined:item.isNewlyJoined ?? false,
  }
  if (item.height)              p.height       = item.height
  if (item.education)           p.education    = item.education
  if (item.occupation)          p.occupation   = item.occupation
  if (item.income)              p.income       = item.income
  if (item.caste)               p.caste        = item.caste
  if (item.profileImg)          p.profileImg   = item.profileImg
  if (item.likedViewedDateText) p.likedDateText = item.likedViewedDateText
  return p
}

// ─── Daily Recommendations Banner ────────────────────────────────────────────
// Angular: drService.callingDailyRecommendationAPI → if profiles → navigate to /dailyrecommendations
// In React we show a tap-to-view banner at the top of the matches list.

function DailyRecBanner({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable style={dr.card} onPress={onPress}>
      <View style={dr.left}>
        <Image
          source={{ uri: CDN + 'revamp/notification-icon.svg' }}
          style={dr.icon}
          resizeMode="contain"
        />
        <View>
          <Text style={dr.title}>Today's Picks</Text>
          <Text style={dr.sub}>{count} profiles selected for you today</Text>
        </View>
      </View>
      <Text style={dr.arrow}>›</Text>
    </Pressable>
  )
}

// ─── Extended Matches End Card ────────────────────────────────────────────────
// Angular: app-end-card [cardType]="'view-more'" — shown at bottom of list when
// extendedMatchesCount > 0. Layout: 3 avatar circles + count badge + title + desc.

const FEMALE_AVATAR = CDN + 'female_avatar_new.svg'

function ExtendedMatchesCard({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable style={e.card} onPress={onPress}>
      {/* 3 overlapping avatars + count badge */}
      <View style={e.avatarRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[e.avatarCircle, { marginLeft: i === 0 ? 0 : -12 }]}>
            <Image source={{ uri: FEMALE_AVATAR }} style={e.avatarImg} resizeMode="cover" />
          </View>
        ))}
        <View style={[e.countCircle, { marginLeft: -12 }]}>
          <Text style={e.countNum}>+{count}</Text>
          <Text style={e.countLabel}>more</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={e.title}>Continue seeing profiles</Text>

      {/* Description */}
      <Text style={e.desc}>
        You have seen all the matches based on your preferences.
        View matches as per Jodii recommendation
      </Text>

      {/* Progress bar — Angular: ion-progress-bar */}
      <View style={e.progressTrack}>
        <View style={e.progressFill} />
      </View>
    </Pressable>
  )
}

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets()

  // ── State ───────────────────────────────────────────────────────────────────
  const [profiles,     setProfiles]     = useState<MatchProfile[]>([])
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [notifCount,     setNotifCount]     = useState(0)
  const [extendedCount,  setExtendedCount]  = useState(0)
  const [dailyRecCount,  setDailyRecCount]  = useState(0)

  // apiStart tracks the cursor for pagination (how many profiles we've fetched from API)
  const apiStartRef = useRef(0)

  // ── Angular sequence: ionViewDidEnter → API calls ───────────────────────────
  // 1. refreshSession()   → login/autologin/v1        (upgrades OTP token to Level-2)
  // 2. fetchMatches()     → listing/matches/v1        (main matches list)
  // 3. fetchNotifCount()  → communication/newcount/v1 (badge count)
  useEffect(() => {
    let cancelled = false

    async function loadMatches() {
      try {
        // Step 1 — Angular: autoLogin upgrades Level-1 OTP token to Level-2 listing token
        // TODO: uncomment when autologin endpoint is ready
        // await refreshSession()
        // if (cancelled) return

        // Step 2 — Angular: callMatchesApi() → listing/matches/v1
        const result = await fetchMatches(0, 20)
        if (cancelled) return

        setProfiles(result.items.map(toMatchProfile))
        setTotalCount(result.totalCount)
        apiStartRef.current = result.items.length  // cursor for next page

        // Step 3 — Angular: parallel post-matches calls
        // newcount + extendedmatches + ppSetData + dailyRecommendations
        const [count, extCount, drProfiles] = await Promise.all([
          fetchNotifCount(),
          fetchExtendedMatchesCount(),
          fetchAndStorePPSetData().then(() => fetchDailyRecommendations()),
        ])
        if (!cancelled) {
          setNotifCount(count)
          setExtendedCount(extCount)
          setDailyRecCount(drProfiles.length)
        }

      } catch (e) {
        if (__DEV__) console.error('[Matches] load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMatches()
    return () => { cancelled = true }
  }, [])

  // ── Pagination ──────────────────────────────────────────────────────────────
  // Angular: doInfinite() → calls callMatchesApi() when scroll reaches end
  async function loadMore() {
    if (loadingMore || apiStartRef.current >= totalCount) return
    setLoadingMore(true)
    try {
      const result = await fetchMatches(apiStartRef.current, 20)
      if (result.items.length > 0) {
        setProfiles(prev => [...prev, ...result.items.map(toMatchProfile)])
        apiStartRef.current += result.items.length
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] load more error:', e)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Profile action handlers ─────────────────────────────────────────────────
  // All use communicationBtnOnClick → same params as Angular communicationBtnOnClick

  async function handleLike(profile: MatchProfile) {
    // Optimistic UI: flip card to "liked" state immediately
    setProfiles(prev => prev.map(p =>
      p.profileId === profile.profileId ? { ...p, likedStatus: '1' as const } : p
    ))
    try {
      const result = await communicationBtnOnClick('matches', 'like', { MATRIID: profile.profileId })
      if (result.type === 'error') {
        // Revert on failure
        setProfiles(prev => prev.map(p =>
          p.profileId === profile.profileId ? { ...p, likedStatus: '0' as const } : p
        ))
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] like error:', e)
    }
  }

  async function handleDontShow(profile: MatchProfile) {
    // Optimistic UI: remove card immediately (matches Angular removeProfile)
    setProfiles(prev => prev.filter(p => p.profileId !== profile.profileId))
    setTotalCount(prev => Math.max(0, prev - 1))
    apiStartRef.current = Math.max(0, apiStartRef.current - 1)
    try {
      await communicationBtnOnClick('matches', 'skip', { MATRIID: profile.profileId })
    } catch (e) {
      if (__DEV__) console.error('[Matches] dont show error:', e)
    }
  }

  async function handleViewLater(profile: MatchProfile) {
    // Optimistic UI: remove card immediately (matches Angular removeProfile)
    setProfiles(prev => prev.filter(p => p.profileId !== profile.profileId))
    setTotalCount(prev => Math.max(0, prev - 1))
    apiStartRef.current = Math.max(0, apiStartRef.current - 1)
    try {
      await communicationBtnOnClick('matches', 'viewlater', { MATRIID: profile.profileId })
    } catch (e) {
      if (__DEV__) console.error('[Matches] view later error:', e)
    }
  }

  async function handleCall(profile: MatchProfile) {
    try {
      const result = await communicationBtnOnClick('matches', 'call', { MATRIID: profile.profileId })
      if (result.type === 'show_contact' && result.contact) {
        Linking.openURL(`tel:${result.contact}`)
      } else if (result.type === 'payment_promo') {
        navigation.navigate('recharge')
      }
      // verify_id / female_free → future bottom sheet
    } catch (e) {
      if (__DEV__) console.error('[Matches] call error:', e)
    }
  }

  async function handleWhatsApp(profile: MatchProfile) {
    try {
      const result = await communicationBtnOnClick('matches', 'whatsapp', { MATRIID: profile.profileId })
      if (result.type === 'show_contact' && result.contact) {
        const num = result.contact.replace(/\D/g, '')
        if (num) Linking.openURL(`https://wa.me/${num}`)
      } else if (result.type === 'payment_promo') {
        navigation.navigate('recharge')
      }
    } catch (e) {
      if (__DEV__) console.error('[Matches] whatsapp error:', e)
    }
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 2: navigation.navigate('Activity'); break
      case 3: navigation.navigate('recharge'); break
      case 4: navigation.navigate('Search');   break
    }
  }

  const renderItem: ListRenderItem<MatchProfile> = ({ item }) => (
    <MatchCard
      profile={item}
      onPress={() => navigation.navigate('viewprofile', { id: item.profileId })}
      onLike={() => handleLike(item)}
      onDontShow={() => handleDontShow(item)}
      onViewLater={() => handleViewLater(item)}
      onCall={() => handleCall(item)}
      onWhatsApp={() => handleWhatsApp(item)}
    />
  )

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Angular: ion-header → Row1: title + language dropdown | Row2: edit preferences */}
      <View style={s.header}>

        {/* Row 1: title (left) + notification bell + language dropdown (right) */}
        {/* Angular: heading2-semibold-18 color-333333 + bell badge + app-dropdown languageChanges */}
        <View style={s.titleRow}>
          <Text style={s.title}>{loading ? 'Matches' : `${totalCount} Matches`}</Text>
          <View style={s.headerRight}>
            {/* Notification bell with count badge — Angular: notificationService badge */}
            <Pressable style={s.bellBtn} onPress={() => {}} hitSlop={8}>
              <Image
                source={{ uri: CDN + 'revamp/notification-icon.svg' }}
                style={s.bellIcon}
                resizeMode="contain"
              />
              {notifCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={s.langBtn} onPress={() => navigation.navigate('LanguageSelection')} hitSlop={8}>
              <Image
                source={{ uri: CDN + 'revamp/lang-change-img.svg' }}
                style={s.langIcon}
                resizeMode="contain"
              />
              <Text style={s.langText}>English</Text>
              <Text style={s.langChevron}>{'›'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Row 2: "X profiles based on your preferences. Edit preferences ✏️" */}
        {/* Angular: body2-regular-14 black + color-29339B inline + pencil */}
        <View style={s.prefRow}>
          <Text style={s.prefText}>{totalCount} profiles based on your preferences. </Text>
          <Pressable style={s.editPref} onPress={() => {}} hitSlop={8}>
            <Text style={s.editPrefText}>Edit preferences</Text>
            <Image
              source={{ uri: CDN + 'registration-new/edit-pencil.svg' }}
              style={s.editPrefIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </View>

      {/* ── Profile list / loader ──────────────────────────────────────────── */}
      {/* Angular: app-loader while !contentLoaded, cdk-virtual-scroll-viewport when loaded */}
      {loading ? (
        <View style={s.loaderBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.profileId}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          // Angular: doInfinite() on scroll end — load next 20 when within 50% of end
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            dailyRecCount > 0
              ? <DailyRecBanner count={dailyRecCount} onPress={() => {}} />
              : null
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator size="small" color={Colors.primary} style={s.footerLoader} />
              : extendedCount > 0
                ? <ExtendedMatchesCard count={extendedCount} onPress={() => {}} />
                : null
          }
        />
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <AppFooter
        activeTab={1}
        likesCount={37}
        upgradeTag="₹200 OFF"
        onTabPress={handleTabPress}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.white },
  loaderBox:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { marginVertical: 16 },

  // Angular: ion-header bg-white header-shadow
  header: {
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     12,
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  // Angular: ion-row header — title left, [bell + language dropdown] right
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      '#333333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  // Notification bell + badge — Angular: notificationService badge count
  bellBtn: { position: 'relative', padding: 4 },
  bellIcon: { width: 22, height: 22 },
  badge: {
    position:        'absolute',
    top:             0,
    right:           0,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: 'Poppins-SemiBold', fontSize: 9, color: Colors.white },
  // Angular: app-dropdown languageChanges — lang icon + label + chevron
  langBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  langIcon:    { width: 18, height: 18 },
  langText:    { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#333333' },
  langChevron: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#333333', transform: [{ rotate: '90deg' }] },

  // Angular: "226 profiles based on your preferences." (color-29339B) + "Edit preferences ✏️" (color-29339B)
  prefRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    alignItems:     'center',
    marginTop:      2,
  },
  prefText:    { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#29339B' },
  editPref:    { flexDirection: 'row', alignItems: 'center' },
  editPrefText:{ fontFamily: 'Poppins-Regular', fontSize: 14, color: '#29339B' },
  editPrefIcon:{ width: 14, height: 14, marginLeft: 4 },
})

// Angular card styles — matches-card.component.scss
const c = StyleSheet.create({
  // Angular: vs-item pb-24 matches-card-border (border-bottom: 8px solid #E6E6E6)
  card: {
    backgroundColor:   Colors.white,
    borderBottomWidth: 8,
    borderBottomColor: '#E6E6E6',
  },

  // Angular: img-holder pl-16 pr-16 with brdr-radius (top-left + top-right radius 16)
  photoBox: {
    marginHorizontal: 16,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    overflow:         'hidden',
    backgroundColor:  '#F0F0F0',
  },
  photo: { width: '100%', height: '100%' },

  // Angular no-photo placeholder
  noPhoto:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noPhotoIcon: { width: 56, height: 56, opacity: 0.35 },
  noPhotoText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#AAAAAA' },

  // Angular: ion-row isProfileBadge d-flex pl-24 mt-16 — BELOW the photo
  badges: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    alignItems:       'center',
    gap:              4,
    paddingHorizontal: 16,
    marginTop:        16,
  },
  paidBadge:     { width: 80, height: 24 },
  verifiedBadge: { width: 100, height: 24 },

  // Angular: .liked-profile — pink gradient strip with heart icon + date text
  likedStrip: {
    flexDirection:    'row',
    alignItems:       'center',
    marginHorizontal: 16,
    marginTop:        8,
    borderRadius:     50,
    backgroundColor:  '#FFEAF7',
    paddingHorizontal: 8,
    paddingVertical:   4,
    gap:              4,
  },
  likedIcon: { width: 20, height: 20, flexShrink: 0 },
  likedText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#96286E', flex: 1 },

  // Angular: d-flex align-center-item mt-12 pl-16 pr-16
  nameRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        12,
    paddingHorizontal: 16,
    gap:              12,
  },
  name:       { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#333333' },
  iconBtn:    { flexShrink: 0 },
  nameRowIcon:  { width: 24, height: 24 },
  nameRowIconWa:{ width: 28, height: 28 },

  // Angular: body2-regular-14 mt-2 pl-16 pr-16 bv-minht text-space
  basicView: {
    fontFamily:       'Poppins-Regular',
    fontSize:         14,
    color:            '#333333',
    lineHeight:       22,
    marginTop:        4,
    paddingHorizontal: 16,
    minHeight:        40,
  },

  // Angular: app-button-revamp [buttonSize]="link" — "View profile"
  viewProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical:   8,
  },
  viewProfileText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.primary,
  },

  // Angular: CTA row — "Don't Show" (tertiary) | "View Later" (secondary) | "Like" (primary)
  ctaRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        8,
    marginBottom:     16,
    paddingHorizontal: 16,
    gap:              8,
  },

  ctaDontShow: {
    flex:            1,
    borderWidth:     1,
    borderColor:     '#CCCCCC',
    borderRadius:    8,
    paddingVertical: 12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaDontShowText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#333333' },

  ctaViewLater: {
    flex:            1,
    borderWidth:     1,
    borderColor:     '#CCCCCC',
    borderRadius:    8,
    paddingVertical: 12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaViewLaterText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: '#333333' },

  ctaLike: {
    flex:            1.2,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.primary,
    borderRadius:    8,
    paddingVertical: 12,
    gap:             6,
  },
  ctaLikeIcon: { width: 20, height: 20 },
  ctaLikeText: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.white },

  // Angular: matches-cta-bg-color (pink gradient) + "Send Interest" primary CTA
  afterLikeRow: {
    paddingHorizontal: 16,
    paddingVertical:   16,
    backgroundColor:  '#FCEAF0',
    borderTopWidth:   1,
    borderTopColor:   '#F5BDD0',
  },
  ctaSendInterest: {
    backgroundColor: Colors.primary,
    borderRadius:    8,
    paddingVertical: 12,
    alignItems:      'center',
  },
  ctaSendInterestText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.white },
})

// Angular: drService banner — "Today's Picks" tap-to-open strip
const dr = StyleSheet.create({
  card: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    marginHorizontal: 16,
    marginTop:        12,
    marginBottom:     4,
    borderRadius:     12,
    backgroundColor:  '#FFF0F5',
    borderWidth:      1,
    borderColor:      '#FFD6E7',
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  left:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  icon:  { width: 28, height: 28, flexShrink: 0 },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#B30033' },
  sub:   { fontFamily: 'Poppins-Regular',  fontSize: 12, color: '#666666', marginTop: 1 },
  arrow: { fontFamily: 'Poppins-Regular',  fontSize: 22, color: '#B30033', lineHeight: 28 },
})

// Angular: app-end-card [cardType]="'view-more'" styles
const e = StyleSheet.create({
  card: {
    backgroundColor:  Colors.white,
    marginHorizontal: 16,
    marginVertical:   24,
    borderRadius:     16,
    padding:          24,
    alignItems:       'center',
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.08,
    shadowRadius:     8,
    elevation:        3,
  },
  // 3 overlapping avatar circles + 1 count badge
  avatarRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  16,
  },
  avatarCircle: {
    width:        52,
    height:       52,
    borderRadius: 26,
    overflow:     'hidden',
    borderWidth:  2,
    borderColor:  Colors.white,
    backgroundColor: '#F0F0F0',
  },
  avatarImg: { width: '100%', height: '100%' },
  countCircle: {
    width:           52,
    height:          52,
    borderRadius:    26,
    borderWidth:     2,
    borderColor:     Colors.white,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  countNum:   { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: Colors.white, lineHeight: 16 },
  countLabel: { fontFamily: 'Poppins-Regular',  fontSize: 10, color: Colors.white, lineHeight: 13 },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    color:      '#4C4C4C',
    textAlign:  'center',
    marginBottom: 8,
  },
  desc: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      '#666666',
    textAlign:  'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  progressTrack: {
    width:           '100%',
    height:          4,
    borderRadius:    2,
    backgroundColor: '#E6E6E6',
    overflow:        'hidden',
  },
  progressFill: {
    width:           '60%',
    height:          '100%',
    borderRadius:    2,
    backgroundColor: Colors.primary,
  },
})
