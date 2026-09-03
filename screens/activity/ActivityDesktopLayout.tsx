// Desktop/laptop layout for the Liked Profile screen — Figma "Jodii Desktop —
// Registration", node 629:11046 ("Liked profiles"): a single-column list of
// full-width cards (NOT the 2-column grid this used before there was a real
// desktop frame to check against), a 20px title, and pill-chip tabs. Reuses
// MatchCardDesktop (the desktop twin of the same MatchCard ActivityScreen.tsx's
// mobile branch reuses) so both breakpoints share one card implementation.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import MatchCardDesktop from '../../components/matches/MatchCardDesktop'
import ThreeDotMenu from '../../components/matches/ThreeDotMenu'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import type { ContactGating } from '../../hooks/useContactGating'
import type { LikedTab } from './ActivityScreen'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { CDN_SVG } from '../../constants/cdn'

interface TabData {
  profiles: MatchProfile[]
  total: number
  hasMore: boolean
  loadingMore: boolean
  start: number
  loaded: boolean
}

export interface ActivityDesktopLayoutProps {
  activeTab:    LikedTab
  tabLabel:     (tab: LikedTab) => string
  tabUnreadCount: (tab: LikedTab) => number
  current:      TabData
  initialLoad:  boolean
  isPaid:       boolean
  bannerTitle:  string
  gating:       ContactGating
  langCode:     string

  onSwitchTab:  (tab: LikedTab) => void
  onLoadMore:   () => void
  onPress:      (p: MatchProfile) => void
  onLike:       (p: MatchProfile) => void
  onDontShow:   (p: MatchProfile) => void
  onViewLater:  (p: MatchProfile) => void
  onCall:       (p: MatchProfile) => void
  onWhatsApp:   (p: MatchProfile) => void
  onMenuPress:  (p: MatchProfile) => void
  openMenuId:   string | null
  onRemovePress: (p: MatchProfile) => void
  onReportPress: (p: MatchProfile) => void
  onGetPaidMembership: () => void
  onLanguagePress:     () => void
  onTabPress:          (tab: FooterTab) => void

  children?: ReactNode  // modals/toast rendered by ActivityScreen.tsx, shown on top of this layout
}

export default function ActivityDesktopLayout({
  activeTab, tabLabel, tabUnreadCount, current, initialLoad, isPaid, bannerTitle, gating, langCode,
  onSwitchTab, onLoadMore, onPress, onLike, onDontShow, onViewLater, onCall, onWhatsApp, onMenuPress,
  openMenuId, onRemovePress, onReportPress,
  onGetPaidMembership, onLanguagePress, onTabPress, children,
}: ActivityDesktopLayoutProps) {
  const { t } = useTranslation()

  function renderItem({ item }: { item: MatchProfile }) {
    return (
      <MatchCardDesktop
        profile={item}
        oppGender={gating.oppGender}
        ownEntryType={gating.ownEntryType}
        femaleFreeEligible={gating.femaleFreeEligible}
        indNumbersLeft={gating.indNumbersLeft}
        onPress={() => onPress(item)}
        onLike={() => onLike(item)}
        onDontShow={() => onDontShow(item)}
        onViewLater={() => onViewLater(item)}
        onCall={() => onCall(item)}
        onWhatsApp={() => onWhatsApp(item)}
        showLikedBadge
        menu={{
          open: openMenuId === item.profileId,
          onPress: () => onMenuPress(item),
          content: (
            <ThreeDotMenu
              showRemove={activeTab === 'likesent'}
              showReport
              onRemove={() => onRemovePress(item)}
              onReport={() => onReportPress(item)}
              positionStyle={ds.menuDropdown}
            />
          ),
        }}
      />
    )
  }

  return (
    <View style={ds.screen}>
      <MatchesDesktopNav activeTab={2} langCode={langCode} onTabPress={onTabPress} onLanguagePress={onLanguagePress} />

      {/* Figma's scrollbar sits at the true window edge, not at the centered
          860px content column's edge — so the FlatList itself (the element
          that actually produces the scrollbar on web) must span the FULL
          screen width; only its `contentContainerStyle` centers the cards to
          860px. A previous version wrapped the FlatList in the same
          maxWidth:860/alignSelf:'center' box as the header, which pulled the
          browser-rendered scrollbar in from the edge to sit flush against the
          narrow content column instead — confirmed via a live screenshot
          comparison against this Figma frame. */}
      <View style={ds.headerWrap}>
        <Text style={ds.title}>{t('GENERAL.ICON_3')}</Text>

        <View style={ds.tabRow}>
          {(['likedyou', 'likesent'] as LikedTab[]).map(tab => {
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

        {!isPaid && current.total > 0 && (
          <View style={ds.banner}>
            <View>
              <Text style={ds.bannerTitle}>{bannerTitle}</Text>
              <Text style={ds.bannerSub}>{t('VERIFY_ID_DOC.BECOMEPAIDMEMBER')}</Text>
            </View>
            <Pressable style={ds.bannerBtn} onPress={onGetPaidMembership}>
              <Text style={ds.bannerBtnLabel}>{t('GENERAL.BECOME_PAID')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {initialLoad ? (
        <View style={ds.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
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
          ListEmptyComponent={current.loaded ? (
            <View style={ds.emptyBox}>
              <CdnSvg uri={CDN_SVG + 'liked_profiles_empty.svg'} width={140} height={140} />
              <Text style={ds.emptyTitle}>
                {t(activeTab === 'likesent' ? 'LIKE_LIST.NOPROFILE_CONT' : 'LIKE_LIST.NOPROFILE_CONT_1')}
              </Text>
              <Text style={ds.emptyDesc}>
                {t(activeTab === 'likesent' ? 'LIKE_LIST.NOPROFILE_CONT_SUB' : 'LIKE_LIST.NOPROFILE_CONT_1_SUB')}
              </Text>
            </View>
          ) : null}
          contentContainerStyle={ds.listContent}
        />
      )}

      {children}
    </View>
  )
}

const ds = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  // Title/tabs/banner never scroll away (fixed above the list, like the nav) —
  // only this block needs the 860px centering; the FlatList below is full-width.
  headerWrap: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 24 },
  // Figma node 629:11046: the card column itself is 810px, sitting inside a
  // wider nav — narrower than this screen's previous 1200px full-bleed grid.
  // Lives on `contentContainerStyle` (below), NOT on the FlatList's own
  // outer bounding box — see the comment above the FlatList for why.
  list: { flex: 1, width: '100%' },
  // Figma: heading2-semibold-20, tracking 0.6px (this used 24px/no tracking).
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

  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(181, 0, 51, 0.05)', borderRadius: 8, padding: 16, marginTop: 16,
  },
  bannerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.textPrimary },
  bannerSub: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textMedium, marginTop: 4 },
  bannerBtn: {
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 6,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  bannerBtnLabel: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.primary },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: {
    width: '100%', maxWidth: 1000, alignSelf: 'center',
    paddingHorizontal: 32, paddingTop: 24, paddingBottom: 32,
  },
  rowGap: { height: 16 },

  // Anchors ThreeDotMenu to MatchCardDesktop's inline `menuWrap` (a 24×24
  // button), not the mobile/legacy top-right-of-photo position.
  menuDropdown: { top: 32, right: 0 },

  footerLoader: { marginVertical: 16 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 6 },
  emptyTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 18, color: Colors.textDark, textAlign: 'center' },
  emptyDesc: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textDark, textAlign: 'center' },
})
