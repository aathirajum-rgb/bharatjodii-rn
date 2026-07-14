// Desktop web layout for the Matches screen (Figma "Jodii Desktop", node 225:2522
// of file UaPAN9aG6MfZf6CRpwXf1L). Purely presentational — MatchesScreen.tsx owns
// all data-loading/state/action-handler logic and passes it down as props; this
// file only lays out the top nav + filter sidebar + card list.
//
// `listData`/`renderBanner` are the SAME merged-list + banner-render-callback
// mobile's own FlatList uses (MatchesScreen.tsx) — every BANNERSLOT shows under
// the exact same condition and at the exact same API-reported position as
// mobile. The one thing this layout does differently: BANNERSLOT 1013 gets a
// Figma-accurate desktop treatment (ActivationBanner) since that's the only
// slot with a desktop design reference; the other slots fall back to
// `renderBanner`, i.e. mobile's own presentational components.
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import type { ReactElement } from 'react'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import FilterChipsRow, { DESKTOP_FILTER_CHIPS } from '../../components/matches-header/FilterChipsRow'
import MatchesFilterSidebar from '../../components/matches-filter-sidebar/MatchesFilterSidebar'
import MatchCardDesktop from '../../components/matches/MatchCardDesktop'
import { ActivationBannerRich } from '../../components/matches/ActivationBanner'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { isBanner, type MatchProfile, type BannerItem, type MatchListItem } from '../../types/interfaces/matches.interface'
import { EEndCardText } from '../../types/enums/common.enum'

export interface MatchesDesktopLayoutProps {
  langCode:          string
  onTabPress:        (tab: FooterTab) => void
  onLanguagePress?:  (() => void) | undefined

  loading:           boolean
  totalCount:        number
  listData:          MatchListItem[]
  renderBanner:      (item: BannerItem) => ReactElement | null
  oppGender:         'M' | 'F'
  ownEntryType:       string
  femaleFreeEligible: boolean
  indNumbersLeft:     string

  onProfilePress:    (profile: MatchProfile) => void
  onLike:            (profile: MatchProfile) => void
  onDontShow:        (profile: MatchProfile) => void
  onViewLater:       (profile: MatchProfile) => void
  onCall:            (profile: MatchProfile) => void
  onWhatsApp:        (profile: MatchProfile) => void

  onEditPreferences?: () => void
  loadingMore:        boolean
  onLoadMore:         () => void

  selectedChip:       string
  onChipSelect:       (key: string) => void

  addPhotoBannerMatches?: any
  onActivateProfile:      () => void
}

export default function MatchesDesktopLayout({
  langCode, onTabPress, onLanguagePress,
  loading, totalCount, listData, renderBanner, oppGender,
  ownEntryType, femaleFreeEligible, indNumbersLeft,
  onProfilePress, onLike, onDontShow, onViewLater, onCall, onWhatsApp,
  onEditPreferences, loadingMore, onLoadMore,
  selectedChip, onChipSelect,
  addPhotoBannerMatches, onActivateProfile,
}: MatchesDesktopLayoutProps) {
  const { t } = useTranslation()

  return (
    <View style={s.screen}>
      <MatchesDesktopNav
        activeTab={1}
        langCode={langCode}
        onTabPress={onTabPress}
        onLanguagePress={onLanguagePress}
      />

      {/* Live desktop-web testing (not just the static Figma reference) showed
          the Filters sidebar and match list need to scroll INDEPENDENTLY, each
          with their own scrollbar — a shared single page-scroll left the
          sidebar's column blank once scrolled past its own short content,
          since the match list is far longer. `body` keeps its default row
          alignItems ('stretch'), so both MatchesFilterSidebar (self-scrolling
          via its own internal ScrollView) and this FlatList get stretched to
          the exact same height — the full space below the nav — and each
          scrolls on its own within that. */}
      <View style={s.body}>
        <MatchesFilterSidebar
          totalCount={totalCount}
          selectedChip={selectedChip}
          onChipSelect={onChipSelect}
          onEditPreferences={onEditPreferences}
        />

        <View style={s.main}>
          {loading ? (
            <>
              <Text style={s.title}>New Matches</Text>
              <FilterChipsRow
                chips={DESKTOP_FILTER_CHIPS}
                selected={selectedChip}
                onSelect={onChipSelect}
                selectedBg={Colors.radioCheckedBg}
                selectedTextColor={Colors.black}
              />
              <View style={s.loaderBox}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            </>
          ) : (
            // "New Matches (N)" + "N profiles..." + the filter chips now live in
            // ListHeaderComponent — the FIRST item of the FlatList's own
            // scrollable content — so scrolling the match list scrolls this
            // heading block away with it, same as it did in the shared-scroll
            // version, but WITHOUT touching MatchesFilterSidebar's independent
            // scroll (that column is a completely separate ScrollView, untouched
            // by anything happening in this FlatList).
            <FlatList
              data={listData}
              keyExtractor={item => isBanner(item) ? item.uid : item.profileId}
              ListHeaderComponent={
                <View style={s.listHeader}>
                  <Text style={s.title}>
                    {t('MATCHES.NEW_MATCHES_TITLE').replace('#COUNT#', String(totalCount))}
                  </Text>
                  <View style={s.ppRow}>
                    <Text style={s.ppText}>
                      {t('MATCHES.PROFILE_COUNT').replace('#COUNT#', String(totalCount))}
                    </Text>
                    <Pressable onPress={onEditPreferences}>
                      <Text style={s.ppEditText}>{t('MATCHES.EDIT_PP')}</Text>
                    </Pressable>
                  </View>
                  <FilterChipsRow
                    chips={DESKTOP_FILTER_CHIPS}
                    selected={selectedChip}
                    onSelect={onChipSelect}
                    selectedBg={Colors.radioCheckedBg}
                    selectedTextColor={Colors.black}
                  />
                </View>
              }
              renderItem={({ item }) => {
                if (isBanner(item)) {
                  return item.bannerSlot === '1013'
                    ? <ActivationBannerRich data={addPhotoBannerMatches} onPress={onActivateProfile} />
                    : renderBanner(item)
                }
                return (
                  <MatchCardDesktop
                    profile={item}
                    oppGender={oppGender}
                    ownEntryType={ownEntryType}
                    femaleFreeEligible={femaleFreeEligible}
                    indNumbersLeft={indNumbersLeft}
                    onPress={() => onProfilePress(item)}
                    onLike={() => onLike(item)}
                    onDontShow={() => onDontShow(item)}
                    onViewLater={() => onViewLater(item)}
                    onCall={() => onCall(item)}
                    onWhatsApp={() => onWhatsApp(item)}
                  />
                )
              }}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.5}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={7}
              updateCellsBatchingPeriod={50}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={s.footerLoader} /> : null
              }
              ListEmptyComponent={
                totalCount === 0 ? (
                  <View style={s.emptyBox}>
                    <Text style={s.emptyTitle}>{t(EEndCardText.noMatches)}</Text>
                    <Text style={s.emptyDesc}>{t(EEndCardText.modifyPreference)}</Text>
                    <Pressable style={s.emptyCta} onPress={onEditPreferences}>
                      <Text style={s.emptyCtaText}>{t(EEndCardText.ctaModifyPreference)}</Text>
                    </Pressable>
                  </View>
                ) : null
              }
              contentContainerStyle={s.listContent}
            />
          )}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  // flex:1 fills the remaining height below the nav; default row alignItems
  // ('stretch') gives BOTH MatchesFilterSidebar and `main` that exact same
  // height, so the sidebar's own internal ScrollView (flex:1 inside it) and
  // this FlatList each get a real bounded height to scroll independently
  // within, instead of either being sized to its own content.
  body: {
    flex:              1,
    flexDirection:     'row',
    paddingHorizontal: 32,
    paddingTop:        24,
    gap:               24,
  },
  main:  { flex: 1 },
  // Wraps title/ppRow/chips when they're FlatList's ListHeaderComponent —
  // same bottom gap before the first card that listContent's paddingTop used
  // to provide back when this block sat outside the FlatList entirely.
  listHeader: { marginBottom: 16 },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   24,
    color:      Colors.textDark,
  },
  ppRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginTop:     6,
  },
  ppText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.textDark,
  },
  ppEditText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.link,
  },
  loaderBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  footerLoader: { marginVertical: 16 },
  listContent:  { paddingTop: 16, paddingBottom: 32 },
  emptyBox: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingTop:        80,
    paddingHorizontal: 24,
    gap:               6,
  },
  emptyTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    color:      Colors.textDark,
    textAlign:  'center',
  },
  emptyDesc: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.textDark,
    textAlign:  'center',
  },
  emptyCta: {
    marginTop:         16,
    borderWidth:       1,
    borderColor:       Colors.primary,
    borderRadius:      8,
    paddingHorizontal: 20,
    paddingVertical:   10,
  },
  emptyCtaText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.primary,
  },
})
