// Angular equivalent: pages/matches/matches.page.ts + matches-card.component
// Landing page for existing users after login (WEBVIEWURL page_id = 60)
// Card layout mirrors matches-card.component.html exactly.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
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
  // refreshSession,  // TODO: uncomment when autologin endpoint is ready
} from '../../service/homeService'

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

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK: MatchProfile[] = [
  {
    profileId: 'm1', name: 'Meenakshi', age: '26',
    location: 'Chennai, Tamil Nadu', height: "5'4\"",
    education: "Bachelor's Degree", occupation: 'Software Engineer',
    caste: 'Mudaliar', isPaidMember: true, isIdVerified: false,
    likedStatus: '0', isNewlyJoined: true,
  },
  {
    profileId: 'm2', name: 'Dhaarani', age: '24',
    location: 'Coimbatore, Tamil Nadu', height: "5'2\"",
    education: "Master's Degree", occupation: 'Teacher',
    caste: 'Nadar', isPaidMember: false, isIdVerified: true,
    likedStatus: '1', isNewlyJoined: false,
    likedDateText: 'You liked this profile on 16-Jan-2026',
  },
  {
    profileId: 'm3', name: 'Keerthana', age: '27',
    location: 'Madurai, Tamil Nadu', height: "5'5\"",
    education: 'B.Tech', occupation: 'Doctor',
    caste: 'Brahmin', isPaidMember: true, isIdVerified: true,
    likedStatus: '0', isNewlyJoined: false,
  },
  {
    profileId: 'm4', name: 'Kavitha', age: '25',
    location: 'Trichy, Tamil Nadu', height: "5'3\"",
    education: "Bachelor's Degree", occupation: 'Nurse',
    caste: 'Gounder', isPaidMember: false, isIdVerified: false,
    likedStatus: '0', isNewlyJoined: false,
  },
  {
    profileId: 'm5', name: 'Priya', age: '23',
    location: 'Salem, Tamil Nadu', height: "5'1\"",
    education: 'B.Sc', occupation: 'Engineer',
    caste: 'Vellalar', isPaidMember: true, isIdVerified: false,
    likedStatus: '0', isNewlyJoined: true,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Angular: bindBasicView() — builds one text string: "27 yrs, 5'5", Chennai | B.Tech, Doctor, Brahmin"
function buildBasicView(p: MatchProfile): string {
  const parts: string[] = []
  if (p.age)        parts.push(`${p.age} yrs`)
  if (p.height)     parts.push(p.height)
  if (p.location)   parts.push(p.location)
  const mid: string[] = []
  if (p.education)  mid.push(p.education)
  if (p.occupation) mid.push(p.occupation)
  if (p.income)     mid.push(p.income)
  if (p.caste)      mid.push(p.caste)
  if (mid.length)   parts.push(mid.join(', '))
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
      {/* Angular: bindBasicView() — one paragraph: "27 yrs, 5'5" | Chennai | B.Tech, Doctor, Brahmin" */}
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

// ─── MatchesScreen ────────────────────────────────────────────────────────────

export default function MatchesScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets()

  // ── State ───────────────────────────────────────────────────────────────────
  const [profiles,   setProfiles]   = useState<MatchProfile[]>(MOCK)
  const [totalCount, setTotalCount] = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [notifCount, setNotifCount] = useState(0)

  // ── Angular sequence: ionViewDidEnter → API calls ───────────────────────────
  // 1. refreshSession()   → login/autologin/v1        (upgrades OTP token to Level-2)
  // 2. fetchMatches()     → listing/matches/v1        (main matches list)
  // 3. fetchNotifCount()  → communication/notificationcount/v1  (badge count)
  // (fetchDailyRec → listing/dailyrecommendations/v1  — add after matches works)
  // (extendedmatches count                            — add after daily rec works)
  useEffect(() => {
    let cancelled = false

    async function loadMatches() {
      try {
        // Step 1 — Angular: autoLogin upgrades Level-1 OTP token to Level-2 listing token
        // TODO: uncomment when autologin endpoint is ready
        // await refreshSession()
        // if (cancelled) return

        // Step 2 — Angular: callMatchesApi() → listing/matches/v1
        const result = await fetchMatches()
        if (cancelled) return

        setProfiles(result.items.map(toMatchProfile))
        setTotalCount(result.totalCount)

        // Step 3 — Angular: notificationService.notificationStatus()
        const count = await fetchNotifCount()
        if (!cancelled) setNotifCount(count)

      } catch (e) {
        if (__DEV__) console.error('[Matches] load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMatches()
    return () => { cancelled = true }
  }, [])

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
      onLike={() => {}}
      onDontShow={() => {}}
      onViewLater={() => {}}
      onCall={() => {}}
      onWhatsApp={() => {}}
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
  screen:    { flex: 1, backgroundColor: Colors.white },
  loaderBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  // Both are blue — wraps naturally so Edit preferences goes to the next line on mobile
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
    backgroundColor:  '#FFEAF7',   // gradient approximation
    paddingHorizontal: 8,
    paddingVertical:   4,
    gap:              4,
  },
  likedIcon: { width: 20, height: 20, flexShrink: 0 },
  likedText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#96286E', flex: 1 },

  // Angular: d-flex align-center-item mt-12 pl-16 pr-16
  // name (heading2-semibold-18 txt-truncate mr-16) + phone-icon (1.5rem) + matches-whatsapp (1.8rem)
  nameRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        12,
    paddingHorizontal: 16,
    gap:              12,
  },
  name:       { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#333333' },
  iconBtn:    { flexShrink: 0 },
  nameRowIcon:  { width: 24, height: 24 },   // phone-icon: 1.5rem
  nameRowIconWa:{ width: 28, height: 28 },   // matches-whatsapp: 1.8rem

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

  // Angular: CTA row — "Don't Show" (tertiary, 46%) | "View Later" (secondary, ~51%) | "Like" (primary, full)
  ctaRow: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        8,
    marginBottom:     16,
    paddingHorizontal: 16,
    gap:              8,
  },

  // Angular: tertiaryBtn — no fill, bordered
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

  // Angular: secondaryBtn — no fill, bordered
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

  // Angular: primaryBtn — filled brand color + heart icon
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
