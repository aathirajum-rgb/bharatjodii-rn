// Desktop/laptop layout for "Contacted profiles" — Figma "Jodii Desktop —
// Registration": node 693:54/693:7575 (list, tab 1/2 active), 693:3927
// (paywall — free user, tab 1 only), 693:5139/693:6357 (paid-empty, tab 1/2).
// Mirrors ActivityDesktopLayout.tsx's structure (title + pill tabs fixed
// above a full-width FlatList, MatchesDesktopNav at top, centered content column).
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import ContactedProfileCardDesktop from '../../components/messagerList/ContactedProfileCardDesktop'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import type { MessageTab, TabData } from './MessagerListScreen'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const CDN = CDN_SVG

export interface MessagerListDesktopLayoutProps {
  navigation:      any
  activeTab:       MessageTab
  tabLabel:        (tab: MessageTab) => string
  tabUnreadCount:  (tab: MessageTab) => number
  current:         TabData
  initialLoad:     boolean
  showPaywall:     boolean
  emptyHeading:    string
  emptySubtext:    string
  emptyButtonText: string
  langCode:        string

  onSwitchTab:     (tab: MessageTab) => void
  onLoadMore:      () => void
  onPress:         (p: MatchProfile) => void
  onDeletedPress:  () => void
  onEmptyAction:   () => void
  onLanguagePress: () => void
  onTabPress:      (tab: FooterTab) => void
  // JODII-499: the "photo protected" nudge card's WhatsApp button — owned by
  // the parent screen (like onPress/onDeletedPress above) so it can run the
  // full communicationBtnOnClick() dispatch and render whatever sheet/modal
  // the result calls for. Previously this component called the dispatcher
  // itself and discarded the result, so the button did nothing visible at all.
  onWhatsApp:      (p: MatchProfile) => void

  children?: ReactNode  // Toast/sheets rendered by MessagerListScreen.tsx, shown on top of this layout
}

export default function MessagerListDesktopLayout({
  activeTab, tabLabel, tabUnreadCount, current, initialLoad, showPaywall,
  emptyHeading, emptySubtext, emptyButtonText, langCode,
  onSwitchTab, onLoadMore, onPress, onDeletedPress, onEmptyAction, onLanguagePress, onTabPress, onWhatsApp, children,
}: MessagerListDesktopLayoutProps) {
  const { t } = useTranslation()

  function renderItem({ item }: { item: MatchProfile }) {
    return (
      <ContactedProfileCardDesktop
        profile={item}
        onPress={() => onPress(item)}
        onDeletedPress={onDeletedPress}
        onWhatsApp={() => onWhatsApp(item)}
      />
    )
  }

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

      {initialLoad ? (
        <View style={ds.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : showPaywall ? (
        renderEmptyOrPaywall()
      ) : (
        <FlatList
          style={ds.list}
          data={current.profiles}
          keyExtractor={item => item.profileId}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={ds.rowGap} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={current.loadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={ds.footerLoader} /> : null}
          ListEmptyComponent={current.loaded ? renderEmptyOrPaywall() : null}
          contentContainerStyle={ds.listContent}
        />
      )}

      {children}
    </View>
  )
}

const ds = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  headerWrap: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24 },
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
