// Desktop/laptop layout for the Messages screen. Outer "All Messages" /
// "Phone number views" tabs added per the Message Relaunch Figma (mobile-only
// reference; this desktop styling is this file's own approximation, same as
// before). "Phone number views" — Figma "Jodii Desktop — Registration":
// node 693:54/693:7575 (list, tab 1/2 active), 693:3927 (paywall — free user,
// tab 1 only), 693:5139/693:6357 (paid-empty, tab 1/2). Mirrors
// ActivityDesktopLayout.tsx's structure (title + pill tabs fixed above a
// full-width FlatList, MatchesDesktopNav at top, centered content column).
// Phoneviews rows use the same ConversationRow as "All Messages" — both tabs
// are fed by the same socket RECORDLIST shape now (TAPTYPE 6/7 vs 5).
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import MessageSectionTabs, { type MessageSectionTabItem } from '../../components/messages/MessageSectionTabs'
import AllMessagesEmptyState from '../../components/messages/AllMessagesEmptyState'
import ConversationRow from '../../components/messages/ConversationRow'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { ChatListItem } from '../../types/interfaces/chatList.interface'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import type { MessageTab, MessageSection, TabData } from './MessagerListScreen'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CDN = CDN_SVG

export interface MessagerListDesktopLayoutProps {
  navigation:      any
  activeSection:    MessageSection
  sectionItems:     MessageSectionTabItem[]
  onSwitchSection:  (key: MessageSection) => void
  isFree:           boolean
  onAllMessagesCta: () => void
  conversations:             ChatListItem[]
  conversationsLoaded:       boolean
  conversationsLoadingMore:  boolean
  onConversationPress:       (item: ChatListItem) => void
  onConversationsEndReached: () => void
  activeTab:       MessageTab
  tabLabel:        (tab: MessageTab) => string
  tabUnreadCount:  (tab: MessageTab) => number
  current:         TabData
  showPaywall:     boolean
  emptyHeading:    string
  emptySubtext:    string
  emptyButtonText: string
  langCode:        string

  onSwitchTab:     (tab: MessageTab) => void
  onLoadMore:      () => void
  onPress:         (item: ChatListItem) => void
  onEmptyAction:   () => void
  onLanguagePress: () => void
  onTabPress:      (tab: FooterTab) => void

  children?: ReactNode  // Toast rendered by MessagerListScreen.tsx, shown on top of this layout
}

export default function MessagerListDesktopLayout({
  activeSection, sectionItems, onSwitchSection, isFree, onAllMessagesCta,
  conversations, conversationsLoaded, conversationsLoadingMore, onConversationPress, onConversationsEndReached,
  activeTab, tabLabel, tabUnreadCount, current, showPaywall,
  emptyHeading, emptySubtext, emptyButtonText, langCode,
  onSwitchTab, onLoadMore, onPress, onEmptyAction, onLanguagePress, onTabPress, children,
}: MessagerListDesktopLayoutProps) {
  const { t } = useTranslation()

  function renderEmptyOrPaywall() {
    return (
      <View style={ds.emptyBox}>
        <CdnSvg
          uri={showPaywall ? CDN + 'mobile_no_viewed_by_you.svg' : CDN + 'mobile_no_viewed.svg'}
          width={180}
          height={180}
        />
        <Text style={ds.emptyTitle}>{emptyHeading}</Text>
        {!!emptySubtext && <Text style={ds.emptyDesc}>{emptySubtext}</Text>}
        <Pressable style={ds.emptyBtn} onPress={onEmptyAction}>
          <Text style={ds.emptyBtnLabel}>{emptyButtonText}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={ds.screen}>
      <MatchesDesktopNav activeTab={4} langCode={langCode} onTabPress={onTabPress} onLanguagePress={onLanguagePress} />

      <View style={ds.headerWrap}>
        <Text style={ds.title}>{t('MESSAGES.MESSAGE_HEADER')}</Text>
      </View>

      <View style={ds.sectionTabsWrap}>
        <MessageSectionTabs sections={sectionItems} active={activeSection} onChange={key => onSwitchSection(key as MessageSection)} />
      </View>

      {activeSection === 'messages' ? (
        !conversationsLoaded ? (
          <View style={ds.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : conversations.length === 0 ? (
          <AllMessagesEmptyState variant={isFree ? 'paywall' : 'empty'} onCtaPress={onAllMessagesCta} iconSize={180} />
        ) : (
          <FlatList
            style={ds.list}
            data={conversations}
            keyExtractor={item => item.matriId}
            renderItem={({ item }) => <ConversationRow item={item} onPress={onConversationPress} />}
            ItemSeparatorComponent={() => <View style={ds.rowGap} />}
            onEndReached={onConversationsEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={conversationsLoadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={ds.footerLoader} /> : null}
            contentContainerStyle={ds.listContent}
          />
        )
      ) : (
        <>
          <View style={ds.headerWrap}>
            <View style={ds.tabRow}>
              {(['whoseviewednumber', 'whoviewednumber'] as MessageTab[]).map(tab => {
                const isActive = activeTab === tab
                const unread = tabUnreadCount(tab)
                return (
                  <Pressable
                    key={tab}
                    style={[ds.chip, isActive && ds.chipActive]}
                    onPress={() => onSwitchTab(tab)}
                  >
                    <Text style={ds.chipLabel}>{tabLabel(tab)}</Text>
                    {unread > 0 && (
                      <View style={ds.unreadBadge}>
                        <Text style={ds.unreadBadgeText}>{unread}</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          </View>

          {!current.loaded ? (
            <View style={ds.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : current.items.length === 0 ? (
            renderEmptyOrPaywall()
          ) : (
            <FlatList
              style={ds.list}
              data={current.items}
              keyExtractor={item => item.matriId}
              renderItem={({ item }) => <ConversationRow item={item} onPress={onPress} />}
              ItemSeparatorComponent={() => <View style={ds.rowGap} />}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={current.loadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={ds.footerLoader} /> : null}
              contentContainerStyle={ds.listContent}
            />
          )}
        </>
      )}

      {children}
    </View>
  )
}

const ds = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  headerWrap: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24 },
  sectionTabsWrap: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 32, marginTop: 16 },
  list: { flex: 1, width: '100%' },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, letterSpacing: 0.6, color: Colors.textDark },

  tabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: Colors.inputBorder,
  },
  chipActive: { backgroundColor: Colors.chipSurfaceSelected, borderColor: Colors.chipBorderActive },
  chipLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark },
  unreadBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  unreadBadgeText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 11, color: Colors.white },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: {
    width: '100%', maxWidth: 1000, alignSelf: 'center',
    paddingHorizontal: 32, paddingTop: 24, paddingBottom: 32,
  },
  rowGap: { height: 16 },

  footerLoader: { marginVertical: 16 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textDark, textAlign: 'center' },
  emptyDesc: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark, textAlign: 'center' },
  emptyBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 6,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.primary },
})
