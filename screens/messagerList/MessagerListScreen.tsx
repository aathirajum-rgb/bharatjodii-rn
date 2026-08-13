// "Contacted profiles" screen — Angular: messager-list.component.ts/.html
// (route `/messager-list`). Two tabs: mobile numbers viewed by you
// (`whoseviewednumber`) and members who viewed your number
// (`whoviewednumber`). Architecture mirrors ActivityScreen.tsx (the closest
// existing analog — tab state machine, pagination, notification badges,
// viewed-tab persistence) but with a plain view-only row card instead of
// MatchCard, since Angular's own `app-list-view-card` has no swipe/like/skip
// actions — just "View full profile".
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import ContactedProfileCard from '../../components/messagerList/ContactedProfileCard'
import MessagerListDesktopLayout from './MessagerListDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { matchProfileAdapter } from '../../adapters/matches.adapter'
import { fetchActivityListingPage } from '../../service/activityService'
import { redirectToViewProfile } from '../../service/buttonService'
import { openMembershipTab, paymentTrack } from '../../service/paymentService'
import { fetchNotifCount } from '../../service/homeService'
import { getSessionValue } from '../../service/registrationService'
import { logEvent, logScreen } from '../../service/analyticsService'
import { getItem, getJson, setJson } from '../../service/storageService'
import { StorageKeys } from '../../constants/storage.keys'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import i18n from '../../i18n'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route?: any }
export type MessageTab = 'whoseviewednumber' | 'whoviewednumber'

export interface TabData {
  profiles:    MatchProfile[]
  total:       number
  hasMore:     boolean
  loadingMore: boolean
  start:       number
  loaded:      boolean
}

const LIMIT = 20
const INITIAL_TAB_DATA: TabData = { profiles: [], total: 0, hasMore: true, loadingMore: false, start: 0, loaded: false }
const CDN = CDN_SVG

// ─── MessagerListScreen ─────────────────────────────────────────────────────

export default function MessagerListScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()

  const [activeTab,   setActiveTab]   = useState<MessageTab>('whoseviewednumber')
  const [initialLoad, setInitialLoad] = useState(true)
  const [ownEntryType, setOwnEntryType] = useState('')
  const [tabData, setTabData] = useState<Record<MessageTab, TabData>>({
    whoseviewednumber: { ...INITIAL_TAB_DATA },
    whoviewednumber:   { ...INITIAL_TAB_DATA },
  })

  const userIdRef = useRef('')

  const [newCounts, setNewCounts] = useState<Record<MessageTab, number>>({ whoseviewednumber: 0, whoviewednumber: 0 })
  const [viewedTabs, setViewedTabs] = useState<Record<string, boolean>>({})
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)

  function showToast(message: string) {
    setToastRequest({ message, key: Date.now() })
  }

  // ── Data helpers ─────────────────────────────────────────────────────────────

  function updateTab(tab: MessageTab, patch: Partial<TabData>) {
    setTabData(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }))
  }

  // ── API ──────────────────────────────────────────────────────────────────────

  async function loadTab(tab: MessageTab, start: number, isFirst: boolean) {
    if (isFirst) updateTab(tab, { loaded: false })
    else         updateTab(tab, { loadingMore: true })

    try {
      const result = await fetchActivityListingPage(tab, userIdRef.current, start, LIMIT)
      const adapted = result.items.map(matchProfileAdapter.adapt)
      const hasMore = result.items.length >= LIMIT

      setTabData(prev => {
        const existing = prev[tab]
        return {
          ...prev,
          [tab]: {
            profiles:    isFirst ? adapted : [...existing.profiles, ...adapted],
            total:       isFirst ? result.totalCount : existing.total,
            hasMore,
            loadingMore: false,
            start:       start + LIMIT,
            loaded:      true,
          },
        }
      })
    } catch {
      updateTab(tab, { loaded: true, loadingMore: false })
    }
  }

  // Angular: activity.config.ts's ViewedActivitytList — shared across
  // ActivityScreen and this screen (tab-type keys don't collide).
  async function markTabViewed(tab: MessageTab) {
    setViewedTabs(prev => {
      if (prev[tab]) return prev
      const next = { ...prev, [tab]: true }
      setJson('VIEWEDACTIVITYLIST', next).catch(() => {})
      return next
    })
  }

  useEffect(() => {
    logScreen('MessagerList')
    Promise.all([
      getItem(StorageKeys.Auth.USER_ID),
      getSessionValue('ENTRYTYPE'),
      getJson<Record<string, boolean>>('VIEWEDACTIVITYLIST'),
      fetchNotifCount().catch(() => ({ newCount: 0, comCount: [] })),
    ]).then(async ([id, entryType, viewed, notif]) => {
      userIdRef.current = id ?? ''
      setOwnEntryType(entryType ?? '')
      setViewedTabs(viewed ?? {})

      const whoseViewedEntry = notif.comCount.find(c => c.comtype === 'whoseviewednumber')
      const whoViewedEntry   = notif.comCount.find(c => c.comtype === 'whoviewednumber')
      setNewCounts({
        whoseviewednumber: Number(whoseViewedEntry?.newcount ?? 0),
        whoviewednumber:   Number(whoViewedEntry?.newcount ?? 0),
      })

      await Promise.all([
        loadTab('whoseviewednumber', 0, true),
        loadTab('whoviewednumber', 0, true),
      ])
      setInitialLoad(false)
      markTabViewed('whoseviewednumber')
    })
  }, [])

  // Angular: changeLanguage() — re-fetch so translated content refreshes.
  const mountedLangRef = useRef(i18n.language)
  useEffect(() => {
    if (i18n.language === mountedLangRef.current) return
    mountedLangRef.current = i18n.language
    loadTab('whoseviewednumber', 0, true)
    loadTab('whoviewednumber', 0, true)
  }, [i18n.language])

  function switchTab(tab: MessageTab) {
    if (tab === activeTab) return
    setActiveTab(tab)
    logEvent({ category: 'messagerlist', action: 'tab_click', label: tab })
    markTabViewed(tab)
    if (!tabData[tab].loaded) loadTab(tab, 0, true)
  }

  const handleEndReached = useCallback(() => {
    const d = tabData[activeTab]
    if (!d.loadingMore && d.hasMore && d.loaded) loadTab(activeTab, d.start, false)
  }, [tabData, activeTab])

  // ── Row actions ────────────────────────────────────────────────────────────
  // Angular: clickOnViewProfile() — deleted profiles show a toast instead of
  // navigating; live profiles go to ViewProfileScreen with prev/next context.

  function handlePress(profile: MatchProfile) {
    const ids = tabData[activeTab].profiles.map(p => p.profileId)
    redirectToViewProfile('', profile.profileId, 'messagerlist', ids)
  }

  function handleDeletedPress() {
    showToast(t('LIKE_LIST.DELETED_PROFILE_TXT'))
  }

  // ── Footer nav ────────────────────────────────────────────────────────────────

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      // case 4 is this screen — do nothing
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const current = tabData[activeTab]
  const isFree  = ['B', 'F'].includes(ownEntryType)
  // Angular: only WHOSEVIEWEDNUMBER (numbers viewed BY you) is a paid feature —
  // being viewed by someone else (WHOVIEWEDNUMBER) needs no membership, so it
  // never gets a paywall variant (matches the Figma: only one paywall mock exists).
  const showPaywall = isFree && activeTab === 'whoseviewednumber'

  function tabLabel(tab: MessageTab): string {
    const count = tabData[tab].total
    const base  = tab === 'whoseviewednumber' ? t('MESSAGES.WHOSEVIEWEDNUMBER_TITLE') : t('MESSAGES.WHOVIEWEDNUMBER_TITLE')
    return count > 0 ? `${base} (${count})` : base
  }

  function tabUnreadCount(tab: MessageTab): number {
    return viewedTabs[tab] ? 0 : newCounts[tab]
  }

  function emptyHeading(): string {
    if (showPaywall) return t('MESSAGES.WHOSEVIEWEDNUMBER_TEXT').replace(/<br\s*\/?>/gi, ' ')
    return activeTab === 'whoseviewednumber'
      ? t('MESSAGES.WHOSEVIEWEDNUMBER_TEXT1').replace(/<br\s*\/?>/gi, ' ')
      : t('MESSAGES.WHOVIEWEDNUMBER_TEXT').replace(/<br\s*\/?>/gi, ' ')
  }

  function emptySubtext(): string {
    if (showPaywall) return ''
    return activeTab === 'whoseviewednumber'
      ? t('MESSAGES.WHOSEVIEWEDNUMBER_TEXT1_SUB')
      : t('MESSAGES.WHOVIEWEDNUMBER_TEXT_SUB')
  }

  function emptyButtonText(): string {
    return showPaywall ? t('VERIFY_ID_DOC.BECOME_PAID') : t('STAR_RATING.GOTOMATCHES')
  }

  function handleEmptyAction() {
    if (showPaywall) { paymentTrack('32'); navigation.navigate('recharge') }
    else navigation.navigate('Matches')
  }

  // ── Desktop ────────────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <MessagerListDesktopLayout
        navigation={navigation}
        activeTab={activeTab}
        tabLabel={tabLabel}
        tabUnreadCount={tabUnreadCount}
        current={current}
        initialLoad={initialLoad}
        showPaywall={showPaywall}
        emptyHeading={emptyHeading()}
        emptySubtext={emptySubtext()}
        emptyButtonText={emptyButtonText()}
        langCode={i18n.language}
        onSwitchTab={switchTab}
        onLoadMore={handleEndReached}
        onPress={handlePress}
        onDeletedPress={handleDeletedPress}
        onEmptyAction={handleEmptyAction}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
        onTabPress={handleTabPress}
      >
        <Toast request={toastRequest} />
      </MessagerListDesktopLayout>
    )
  }

  // ── Render helpers (mobile) ────────────────────────────────────────────────────

  function renderItem({ item }: { item: MatchProfile }) {
    return (
      <ContactedProfileCard
        profile={item}
        onPress={() => handlePress(item)}
        onDeletedPress={handleDeletedPress}
      />
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
        <CdnSvg
          uri={activeTab === 'whoseviewednumber' ? CDN + 'mobile_no_viewed_by_you.svg' : CDN + 'mobile_no_viewed.svg'}
          width={140}
          height={140}
        />
        <Text style={styles.emptyTitle}>{emptyHeading()}</Text>
        {!!emptySubtext() && <Text style={styles.emptySubtitle}>{emptySubtext()}</Text>}
        <Pressable style={styles.emptyBtn} onPress={handleEmptyAction}>
          <Text style={styles.emptyBtnLabel}>{emptyButtonText()}</Text>
        </Pressable>
      </View>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('MESSAGES.MESSAGE_HEADER')}</Text>
      </View>

      {/* ── Tab chips ── */}
      {/* Angular: these two labels ("Phone numbers viewed by you" / "Who viewed
          your phone number") are long enough to overflow the screen width — needs
          its own horizontal ScrollView (matches ActivityScreen.tsx) so the chip
          row scrolls independently instead of the overflow bleeding into a
          page-wide horizontal scroll that drags the header/list/footer with it. */}
      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {(['whoseviewednumber', 'whoviewednumber'] as MessageTab[]).map(tab => {
            const isActive = activeTab === tab
            const unread = tabUnreadCount(tab)
            return (
              <Pressable
                key={tab}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => switchTab(tab)}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{tabLabel(tab)}</Text>
                {unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unread}</Text>
                  </View>
                )}
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
            keyExtractor={item => item.profileId}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.rowGap} />}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </View>

      {/* ── Footer — tab 4 ("Contacted profiles") is this screen ── */}
      <AppFooter activeTab={4} onTabPress={handleTabPress} />

      <Toast request={toastRequest} bottomOffset={56 + 16} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  flex1:  { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.textDark },

  tabBarWrap: { backgroundColor: Colors.surface },
  tabScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: Colors.inputBorder,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: Colors.chipSurfaceSelected, borderColor: Colors.chipBorderActive },
  chipLabel: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textDark },
  chipLabelActive: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textDark },
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { fontFamily: 'Poppins-SemiBold', fontSize: 11, color: Colors.white },

  listContent: { flexGrow: 1, padding: 16 },
  rowGap: { height: 16 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 40, gap: 12,
  },
  emptyTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 6,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnLabel: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.primary },
})
