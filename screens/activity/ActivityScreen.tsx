import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import { paymentTrack } from '../../service/paymentService'
import MatchesCard from '../../components/matches-card/MatchesCard'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { callActivityApi } from '../../service/activityService'
import { getItem } from '../../service/storageService'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route?: any }

type TabType = 'likedyou' | 'likesent'

interface RawProfile {
  MATRIID:         string
  NAME?:           string
  AGE?:            string
  HEIGHTCATEGORY?: string
  EDUCATION?:      string
  OCCUPATION?:     string
  CASTE?:          string
  CITY?:           string
  STATE?:          string
  INCOME?:         string
  THUMBIMG?:       string
  PHOTO?:          { IMAGE: string }[]
  PHOTOSTATUS?:    string | number
  PHOTOPRIVACY?:   string | number
  LIKED?:          string
  PHONEVIEWED?:    string
  STATUS?:         string | number
  COMTEXTDATE?:    string
}

interface TabData {
  profiles:    RawProfile[]
  total:       number
  hasMore:     boolean
  loadingMore: boolean
  start:       number
  loaded:      boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 20
const AVATAR_MALE   = CDN_SVG + 'avatar-male.svg'
const AVATAR_FEMALE = CDN_SVG + 'avatar-female.svg'

const INITIAL_TAB_DATA: TabData = {
  profiles: [], total: 0, hasMore: true, loadingMore: false, start: 0, loaded: false,
}

// ─── ActivityScreen ───────────────────────────────────────────────────────────

export default function ActivityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  const [activeTab,     setActiveTab]     = useState<TabType>('likesent')
  const [initialLoad,   setInitialLoad]   = useState(true)

  const [tabData, setTabData] = useState<Record<TabType, TabData>>({
    likedyou: { ...INITIAL_TAB_DATA },
    likesent: { ...INITIAL_TAB_DATA },
  })

  const userIdRef    = useRef('')
  const avatarRef    = useRef(AVATAR_FEMALE)  // opposite gender avatar

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function withFallback(raw: RawProfile[]): RawProfile[] {
    const avatar = avatarRef.current
    return raw.map(r => ({
      ...r,
      THUMBIMG: r.THUMBIMG || avatar,
      PHOTO:    r.PHOTO?.length ? r.PHOTO : [{ IMAGE: r.THUMBIMG || avatar }],
    }))
  }

  function updateTab(tab: TabType, patch: Partial<TabData>) {
    setTabData(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }))
  }

  // ── API ──────────────────────────────────────────────────────────────────────

  async function loadTab(tab: TabType, start: number, isFirst: boolean) {
    if (isFirst) updateTab(tab, { loaded: false })
    else         updateTab(tab, { loadingMore: true })

    try {
      const res = await callActivityApi(tab, userIdRef.current, start, LIMIT)

      if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        const raw: RawProfile[] = res.RESPONSE ?? []
        const total = isFirst ? parseInt(res.TOTAL ?? '0', 10) : undefined

        const filled = withFallback(raw)
        const hasMore = raw.length >= LIMIT

        setTabData(prev => {
          const existing = prev[tab]
          return {
            ...prev,
            [tab]: {
              profiles:    isFirst ? filled : [...existing.profiles, ...filled],
              total:       total ?? existing.total,
              hasMore,
              loadingMore: false,
              start:       start + LIMIT,
              loaded:      true,
            },
          }
        })
      } else if (res?.ERRCODE == 1) {
        updateTab(tab, { hasMore: false, loaded: true, loadingMore: false })
      } else {
        updateTab(tab, { loaded: true, loadingMore: false })
      }
    } catch {
      updateTab(tab, { loaded: true, loadingMore: false })
    }
  }

  // ── Init — load both tabs in parallel ────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.LOGIN_GENDER),
      getItem(StorageKeys.User.GENDER),
    ]).then(async ([id, loginG, regG]) => {
      userIdRef.current = id ?? ''
      const female = loginG === 'F' || regG === '2'
      avatarRef.current = female ? AVATAR_MALE : AVATAR_FEMALE

      const defaultTab: TabType = female ? 'likedyou' : 'likesent'
      setActiveTab(defaultTab)

      // Load both tabs concurrently; default tab shown first
      await Promise.all([
        loadTab('likedyou', 0, true),
        loadTab('likesent', 0, true),
      ])
      setInitialLoad(false)
    })
  }, [])

  // ── Tab switch ───────────────────────────────────────────────────────────────

  function switchTab(tab: TabType) {
    if (tab === activeTab) return
    setActiveTab(tab)
    // Reload if never loaded (shouldn't happen since we preload both)
    if (!tabData[tab].loaded) loadTab(tab, 0, true)
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  const handleEndReached = useCallback(() => {
    const d = tabData[activeTab]
    if (!d.loadingMore && d.hasMore && d.loaded) {
      loadTab(activeTab, d.start, false)
    }
  }, [tabData, activeTab])

  // ── Computed ──────────────────────────────────────────────────────────────────

  const current = tabData[activeTab]
  const avatar  = avatarRef.current

  // Tab chip labels with count
  function tabLabel(tab: TabType): string {
    const count = tabData[tab].total
    const base  = tab === 'likedyou' ? 'Profiles who liked you' : 'Profiles you liked'
    return count > 0 ? `${base} (${count})` : base
  }

  // Upsell banner text per tab
  function bannerTitle(): string {
    const n = current.total
    if (activeTab === 'likedyou') {
      return n === 1 ? '1 match has liked you!' : `${n} matches have liked you!`
    }
    return n === 1 ? 'You have liked 1 match!' : `You have liked ${n} matches!`
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function renderItem({ item }: { item: RawProfile }) {
    const isDeleted = item.STATUS == 1 || item.STATUS === '1'

    const card = (
      <MatchesCard
        profileId={item.MATRIID}
        name={item.NAME}
        age={item.AGE}
        height={item.HEIGHTCATEGORY}
        education={item.EDUCATION}
        occupation={item.OCCUPATION}
        caste={item.CASTE}
        city={item.CITY}
        state={item.STATE}
        profileImageArr={isDeleted ? undefined : item.PHOTO}
        defaultImg={item.THUMBIMG || avatar}
        isPhotoAvailable={!isDeleted && (item.PHOTOSTATUS == 1 || item.PHOTOSTATUS === '1')}
        isPhotoProtect={!isDeleted && (item.PHOTOPRIVACY == 1 || item.PHOTOPRIVACY === '1')}
        showReqPhotoElement={!isDeleted}
        isActivityLabel={isDeleted}
        LabelText={isDeleted ? 'This profile has been deleted' : undefined}
        likedStatus={(item.LIKED ?? '0') as '0' | '1' | '2' | '3'}
        phoneViewed={item.PHONEVIEWED}
        showLikedLbl={!isDeleted}
        variant={activeTab}
        onViewProfile={isDeleted ? undefined : () => {}}
      />
    )

    if (isDeleted) {
      return (
        <View pointerEvents="none" style={styles.deletedWrap}>
          {card}
        </View>
      )
    }

    return card
  }

  function renderListHeader() {
    if (current.total === 0) return null
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{bannerTitle()}</Text>
        <Text style={styles.bannerSub}>Become a paid member to contact them directly</Text>
        <Pressable
          style={styles.bannerBtn}
          onPress={() => navigation.navigate('recharge')}
        >
          <Text style={styles.bannerBtnLabel}>Get paid membership</Text>
        </Pressable>
      </View>
    )
  }

  function renderFooter() {
    if (!current.loadingMore) return null
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    )
  }

  function renderEmpty() {
    if (!current.loaded) return null
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>💌</Text>
        <Text style={styles.emptyTitle}>No profiles yet</Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'likedyou'
            ? 'Profiles that like you will appear here'
            : 'Profiles you like will appear here'}
        </Text>
      </View>
    )
  }

  // ── Footer nav ────────────────────────────────────────────────────────────────

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      // Angular: footer.component.ts — paymentTrack(31) fires right before
      // routing a free member to the payment intermediate page.
      case 3: paymentTrack('31'); navigation.navigate('recharge'); break
      case 4: navigation.navigate('Search');   break
      // case 2 is this screen — do nothing
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Liked profiles</Text>
      </View>

      {/* ── Tab chips ── */}
      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {(['likedyou', 'likesent'] as TabType[]).map(tab => {
            const isActive = activeTab === tab
            return (
              <Pressable
                key={tab}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => switchTab(tab)}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {tabLabel(tab)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* ── Content ── */}
      <View style={styles.flex1}>
        {initialLoad ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={current.profiles}
            keyExtractor={item => item.MATRIID}
            renderItem={renderItem}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* ── Footer — always visible, same as Home/Matches ── */}
      <AppFooter activeTab={2} onTabPress={handleTabPress} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  flex1: {
    flex: 1,
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   Colors.surface,
  },
  headerTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      Colors.textDark,   // #333333
  },

  // ── Tab bar ────────────────────────────────────────────────────────────────────
  // Angular: activity-top-tabs (fixed z-index) → plain sticky in RN via list header
  tabBarWrap: {
    backgroundColor:   Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  tabScroll: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               8,
  },

  // Angular: activity-slider-bg = #f1f5f9 (inactive), selected + brand pink (active)
  chip: {
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
    backgroundColor:   '#f1f5f9',
    borderWidth:       1,
    borderColor:       'transparent',
  },
  chipActive: {
    backgroundColor: Colors.primarySurface,           // #fff0f0
    borderColor:     Colors.chipBorderActive,          // rgba(181,0,51,0.40)
  },
  chipLabel: {
    fontSize:   13,
    fontWeight: '500',
    color:      Colors.textMedium,
  },
  chipLabelActive: {
    color:      Colors.primaryDark,    // #B50033
    fontWeight: '700',
  },

  // ── Upsell banner ──────────────────────────────────────────────────────────────
  // Angular: .matches-liked-you-block { padding: 16px; background: rgba(181,0,51,0.05) }
  banner: {
    backgroundColor: 'rgba(181, 0, 51, 0.05)',
    padding:         16,
    gap:             6,
    marginBottom:    12,
  },
  bannerTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.textPrimary,
    lineHeight: 22,
  },
  bannerSub: {
    fontSize:   14,
    color:      Colors.textMedium,
    lineHeight: 20,
    marginBottom: 8,
  },
  bannerBtn: {
    alignSelf:        'flex-start',
    borderWidth:      1.5,
    borderColor:      Colors.primary,
    borderRadius:     6,
    paddingHorizontal:14,
    paddingVertical:  8,
  },
  bannerBtnLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.primary,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  listContent: {
    paddingTop: 12,
    flexGrow:   1,
  },

  // ── Deleted profile card wrapper ───────────────────────────────────────────────
  deletedWrap: {
    opacity: 0.65,
  },

  // ── States ────────────────────────────────────────────────────────────────────
  loadingWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems:      'center',
  },
  emptyState: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    paddingTop:        80,
    gap:               12,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  emptySubtitle: {
    fontSize:   14,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
})
