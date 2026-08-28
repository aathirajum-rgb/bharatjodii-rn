// Messages screen — Angular: messager-list.component.ts/.html (route
// `/messager-list`). Message Relaunch Figma: two outer tabs, "All Messages"
// and "Phone number views" — both now fed live over the socket (RESPMYCHAT,
// TAPTYPE 5/6/7) exactly like Angular does, using the same ConversationRow
// for every row regardless of tab (matching Angular's own single shared row
// template — the phoneviews "viewed your mobile number" caption is just
// another msgType (11/12/13) in the same RECORDLIST shape as a real message).
// Phone-view tabs previously fetched via REST (activityService.ts); switched
// to the socket to get real OnlineNow/TimeStamp data the new row design needs.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import MessageSectionTabs from '../../components/messages/MessageSectionTabs'
import AllMessagesEmptyState from '../../components/messages/AllMessagesEmptyState'
import ConversationRow from '../../components/messages/ConversationRow'
import MessagerListDesktopLayout from './MessagerListDesktopLayout'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { adaptChatListRecord, dedupeChatList } from '../../adapters/chatList.adapter'
import { redirectToViewProfile } from '../../service/buttonService'
import { openMembershipTab, paymentTrack } from '../../service/paymentService'
import { fetchNotifCount } from '../../service/homeService'
import { getSessionValue } from '../../service/registrationService'
import { logEvent, logScreen } from '../../service/analyticsService'
import { getItem, getJson, setJson } from '../../service/storageService'
import { socketConnection, emitChatList, onChatList, onLoginConfirmation } from '../../service/socketService'
import { StorageKeys } from '../../constants/storage.keys'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { EnvConfig } from '../../constants/env'
import i18n from '../../i18n'
import type { ChatListItem, ChatListResponse } from '../../types/interfaces/chatList.interface'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route?: any }
export type MessageTab = 'whoseviewednumber' | 'whoviewednumber'

// Angular: messager-list.component.ts's `messageSections` — the outer
// "All Messages" / "Phone number views" switch (Figma node 56:4094).
// "messages" (All Messages) defaults active, matching Figma.
export type MessageSection = 'messages' | 'phoneviews'

export interface TabData {
  items:       ChatListItem[]
  total:       number
  hasMore:     boolean
  loadingMore: boolean
  start:       number
  loaded:      boolean
}

const LIMIT = 20
const INITIAL_TAB_DATA: TabData = { items: [], total: 0, hasMore: true, loadingMore: false, start: 0, loaded: false }
const CDN = CDN_SVG

// Angular: message.config.ts's messageList tabValues — the socket-side TAPTYPE
// identifying which list a RESPMYCHAT response belongs to.
const CONVERSATION_TAB_VALUE = 5
const TAB_VALUES: Record<MessageTab, number> = { whoseviewednumber: 6, whoviewednumber: 7 }

// ─── MessagerListScreen ─────────────────────────────────────────────────────

export default function MessagerListScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()

  const [activeSection, setActiveSection] = useState<MessageSection>('messages')
  const [activeTab,   setActiveTab]   = useState<MessageTab>('whoseviewednumber')
  const [ownEntryType, setOwnEntryType] = useState('')
  const [tabData, setTabData] = useState<Record<MessageTab, TabData>>({
    whoseviewednumber: { ...INITIAL_TAB_DATA },
    whoviewednumber:   { ...INITIAL_TAB_DATA },
  })

  const userIdRef = useRef('')

  // ── "All Messages" conversation list — Angular: chatListArr/loadChatListData().
  const [conversations, setConversations] = useState<ChatListItem[]>([])
  const [conversationsLoaded, setConversationsLoaded] = useState(false)
  const [conversationsLoadingMore, setConversationsLoadingMore] = useState(false)
  const [conversationsHasMore, setConversationsHasMore] = useState(true)
  const conversationStartRef = useRef(0)

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

  // Angular: switchTab()'s emitChatList(tabNo, startLimit, limit) — requests a page
  // of a phoneviews tab over the socket; the response lands in the onChatList
  // listener below, routed by TAPTYPE.
  function requestTab(tab: MessageTab, start: number, isFirst: boolean) {
    if (isFirst) updateTab(tab, { loaded: false })
    else         updateTab(tab, { loadingMore: true })
    emitChatList(TAB_VALUES[tab], start, LIMIT)
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
    ]).then(([id, entryType, viewed, notif]) => {
      userIdRef.current = id ?? ''
      setOwnEntryType(entryType ?? '')
      setViewedTabs(viewed ?? {})

      const whoseViewedEntry = notif.comCount.find(c => c.comtype === 'whoseviewednumber')
      const whoViewedEntry   = notif.comCount.find(c => c.comtype === 'whoviewednumber')
      setNewCounts({
        whoseviewednumber: Number(whoseViewedEntry?.newcount ?? 0),
        whoviewednumber:   Number(whoViewedEntry?.newcount ?? 0),
      })

      markTabViewed('whoseviewednumber')
    })
  }, [])

  // Angular: ionViewWillEnter() — socketConnection() then, 100ms later,
  // chatLoginEmit() + loadChatListData() (listener attached before the list is
  // requested, so a fast response isn't missed) + emitChatList for every tab.
  // socketConnection() here already waits for that login step internally.
  useEffect(() => {
    let cancelled = false
    let chatListReceived = false
    let retried = false

    const unsubscribe = onChatList((data: ChatListResponse) => {
      if (cancelled || !data) return
      const records = data.RECORDLIST ?? []
      const adapted = records.map(r => adaptChatListRecord(r, userIdRef.current))

      if (data.TAPTYPE === CONVERSATION_TAB_VALUE) {
        chatListReceived = true
        setConversations(prev => {
          const merged = conversationStartRef.current === 0 ? adapted : dedupeChatList([...prev, ...adapted])
          return [...merged].sort((a, b) => b.timestamp - a.timestamp)
        })
        conversationStartRef.current += LIMIT
        setConversationsHasMore(records.length >= LIMIT)
        setConversationsLoaded(true)
        setConversationsLoadingMore(false)
        return
      }

      const tab = (Object.keys(TAB_VALUES) as MessageTab[]).find(key => TAB_VALUES[key] === data.TAPTYPE)
      if (!tab) return
      setTabData(prev => {
        const existing = prev[tab]
        const merged = existing.start === 0 ? adapted : dedupeChatList([...existing.items, ...adapted])
        return {
          ...prev,
          [tab]: {
            items:       merged,
            total:       data.TOTALREC ?? existing.total,
            hasMore:     records.length >= LIMIT,
            loadingMore: false,
            start:       existing.start + LIMIT,
            loaded:      true,
          },
        }
      })
    })

    // Angular: getRESPLOGIN() subscription in loadChatListData() — the list request can
    // still reach the server before Login is fully processed and get dropped, so once
    // login is confirmed, give the conversation list one 2s grace period and re-ask
    // exactly once if it hasn't shown up yet (matches Angular's own guard, which is
    // conversation-tab-specific).
    const unsubscribeLogin = onLoginConfirmation(() => {
      if (retried) return
      retried = true
      setTimeout(() => {
        if (cancelled || chatListReceived) return
        emitChatList(CONVERSATION_TAB_VALUE, 0, LIMIT)
      }, 2000)
    })

    socketConnection(EnvConfig.notify).then(() => {
      if (cancelled) return
      emitChatList(CONVERSATION_TAB_VALUE, 0, LIMIT)
      emitChatList(TAB_VALUES.whoseviewednumber, 0, LIMIT)
      emitChatList(TAB_VALUES.whoviewednumber, 0, LIMIT)
    })

    return () => {
      cancelled = true
      unsubscribe()
      unsubscribeLogin()
    }
  }, [])

  const handleConversationsEndReached = useCallback(() => {
    if (conversationsLoadingMore || !conversationsHasMore || !conversationsLoaded) return
    setConversationsLoadingMore(true)
    emitChatList(CONVERSATION_TAB_VALUE, conversationStartRef.current, LIMIT)
  }, [conversationsLoadingMore, conversationsHasMore, conversationsLoaded])

  // Angular: navigateToPage() (JODII-453 fix) — a reported chat is opened and
  // read like any other one now, ChatScreen.tsx shows the reported note in
  // place of the input instead of this page refusing the tap; only a deleted
  // profile still shows a toast and stays unreachable.
  function handleConversationPress(item: ChatListItem) {
    if (item.isDeleted) { showToast(t('LIKE_LIST.DELETED_PROFILE_TXT')); return }
    navigation.navigate('chat-window', {
      partnerId: item.matriId,
      partnerName: item.name,
      partnerPhoto: item.photoUrl,
      partnerOnline: item.isOnline,
      partnerReported: item.isReported,
      ...(item.lastActive != null ? { partnerLastActive: item.lastActive } : {}),
    })
  }

  function switchTab(tab: MessageTab) {
    if (tab === activeTab) return
    setActiveTab(tab)
    logEvent({ category: 'messagerlist', action: 'tab_click', label: tab })
    markTabViewed(tab)
    if (!tabData[tab].loaded) requestTab(tab, 0, true)
  }

  const handleEndReached = useCallback(() => {
    const d = tabData[activeTab]
    if (!d.loadingMore && d.hasMore && d.loaded) requestTab(activeTab, d.start, false)
  }, [tabData, activeTab])

  // ── Row actions ────────────────────────────────────────────────────────────
  // Angular: navigateToPage() — reported/deleted rows show a toast; live rows
  // go to ViewProfileScreen with prev/next context (this app has no one-to-one
  // chat screen yet, unlike Angular's own '/messages' target for these rows).
  function handlePhoneViewPress(item: ChatListItem) {
    if (item.isReported) { showToast(t('MESSAGES.REPORTED_PROFILE')); return }
    if (item.isDeleted)  { showToast(t('LIKE_LIST.DELETED_PROFILE_TXT')); return }
    const ids = tabData[activeTab].items.map(i => i.matriId)
    redirectToViewProfile('', item.matriId, 'messagerlist', ids)
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
    return showPaywall ? t('GENERAL.BECOME_PAID') : t('STAR_RATING.GOTOMATCHES')
  }

  function handleEmptyAction() {
    if (showPaywall) { paymentTrack('32'); navigation.navigate('recharge') }
    else navigation.navigate('Matches')
  }

  // Angular: emptyCtaAction() free-member branch — goToPaidMembership().
  function handleAllMessagesCta() {
    paymentTrack('32')
    navigation.navigate('recharge')
  }

  const sectionItems = [
    { key: 'messages',   label: t('MESSAGES.CONVERSATION_TITLE') },
    { key: 'phoneviews', label: t('MESSAGES.VIEWED_NUMBERS') },
  ]

  // ── Desktop ────────────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <MessagerListDesktopLayout
        navigation={navigation}
        activeSection={activeSection}
        sectionItems={sectionItems}
        onSwitchSection={setActiveSection}
        isFree={isFree}
        onAllMessagesCta={handleAllMessagesCta}
        conversations={conversations}
        conversationsLoaded={conversationsLoaded}
        conversationsLoadingMore={conversationsLoadingMore}
        onConversationPress={handleConversationPress}
        onConversationsEndReached={handleConversationsEndReached}
        activeTab={activeTab}
        tabLabel={tabLabel}
        tabUnreadCount={tabUnreadCount}
        current={current}
        showPaywall={showPaywall}
        emptyHeading={emptyHeading()}
        emptySubtext={emptySubtext()}
        emptyButtonText={emptyButtonText()}
        langCode={i18n.language}
        onSwitchTab={switchTab}
        onLoadMore={handleEndReached}
        onPress={handlePhoneViewPress}
        onEmptyAction={handleEmptyAction}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
        onTabPress={handleTabPress}
      >
        <Toast request={toastRequest} />
      </MessagerListDesktopLayout>
    )
  }

  // ── Render helpers (mobile) ────────────────────────────────────────────────────

  function renderFooter() {
    if (!current.loadingMore) return null
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    )
  }

  function renderEmpty() {
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

      {/* ── Outer section switch: All Messages / Phone number views ── */}
      <MessageSectionTabs sections={sectionItems} active={activeSection} onChange={key => setActiveSection(key as MessageSection)} />

      {activeSection === 'messages' ? (
        !conversationsLoaded ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : conversations.length === 0 ? (
          <AllMessagesEmptyState variant={isFree ? 'paywall' : 'empty'} onCtaPress={handleAllMessagesCta} />
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={item => item.matriId}
            renderItem={({ item }) => <ConversationRow item={item} onPress={handleConversationPress} />}
            ItemSeparatorComponent={() => <View style={styles.conversationSeparator} />}
            onEndReached={handleConversationsEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={conversationsLoadingMore ? (
              <View style={styles.footerLoader}><ActivityIndicator size="small" color={Colors.primary} /></View>
            ) : null}
            contentContainerStyle={styles.conversationListContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        <>
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
            {!current.loaded ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : current.items.length === 0 ? (
              renderEmpty()
            ) : (
              <FlatList
                data={current.items}
                keyExtractor={item => item.matriId}
                renderItem={({ item }) => <ConversationRow item={item} onPress={handlePhoneViewPress} />}
                ItemSeparatorComponent={() => <View style={styles.conversationSeparator} />}
                ListFooterComponent={renderFooter}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.4}
                contentContainerStyle={styles.conversationListContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </>
      )}

      {/* ── Footer — tab 4 ("Messages") is this screen ── */}
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
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textDark },

  tabBarWrap: { backgroundColor: Colors.surface },
  tabScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: Colors.inputBorder,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: Colors.chipSurfaceSelected, borderColor: Colors.chipBorderActive },
  chipLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark },
  chipLabelActive: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark },
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 11, color: Colors.white },

  conversationListContent: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 8 },
  conversationSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.divider, marginLeft: 64 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 40, gap: 12,
  },
  emptyTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 6,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.primary },
})
