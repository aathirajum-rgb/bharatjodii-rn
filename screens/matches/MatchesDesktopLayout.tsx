// Desktop web layout for the Matches screen (Figma "Jodii Desktop", node 225:2522
// of file UaPAN9aG6MfZf6CRpwXf1L). Purely presentational — MatchesScreen.tsx owns
// all data-loading/state/action-handler logic and passes it down as props; this
// file only lays out the top nav + filter sidebar + card list.
//
// Scoped out of this pass: the mobile promo banners (membership/add-photo/
// photo-promotion) aren't shown here — the Figma desktop design doesn't include
// them, only the plain filtered match list.
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import FilterChipsRow, { DESKTOP_FILTER_CHIPS } from '../../components/matches-header/FilterChipsRow'
import MatchesFilterSidebar from '../../components/matches-filter-sidebar/MatchesFilterSidebar'
import MatchCardDesktop from '../../components/matches/MatchCardDesktop'
import { Colors } from '../../constants/colors'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import type { MatchProfile } from '../../types/interfaces/matches.interface'

export interface MatchesDesktopLayoutProps {
  langCode:          string
  onTabPress:        (tab: FooterTab) => void
  onLanguagePress?:  (() => void) | undefined

  loading:           boolean
  totalCount:        number
  profiles:          MatchProfile[]
  oppGender:         'M' | 'F'

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
}

export default function MatchesDesktopLayout({
  langCode, onTabPress, onLanguagePress,
  loading, totalCount, profiles, oppGender,
  onProfilePress, onLike, onDontShow, onViewLater, onCall, onWhatsApp,
  onEditPreferences, loadingMore, onLoadMore,
  selectedChip, onChipSelect,
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

      <View style={s.body}>
        <MatchesFilterSidebar />

        <View style={s.main}>
          <Text style={s.title}>
            {loading ? 'New Matches' : t('MATCHES.NEW_MATCHES_TITLE').replace('#COUNT#', String(totalCount))}
          </Text>

          {!loading && (
            <View style={s.ppRow}>
              <Text style={s.ppText}>
                {t('MATCHES.PROFILE_COUNT').replace('#COUNT#', String(totalCount))}
              </Text>
              <Pressable onPress={onEditPreferences}>
                <Text style={s.ppEditText}>{t('MATCHES.EDIT_PP')}</Text>
              </Pressable>
            </View>
          )}

          <FilterChipsRow chips={DESKTOP_FILTER_CHIPS} selected={selectedChip} onSelect={onChipSelect} />

          {loading ? (
            <View style={s.loaderBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              data={profiles}
              keyExtractor={p => p.profileId}
              renderItem={({ item }) => (
                <MatchCardDesktop
                  profile={item}
                  oppGender={oppGender}
                  onPress={() => onProfilePress(item)}
                  onLike={() => onLike(item)}
                  onDontShow={() => onDontShow(item)}
                  onViewLater={() => onViewLater(item)}
                  onCall={() => onCall(item)}
                  onWhatsApp={() => onWhatsApp(item)}
                />
              )}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator size="small" color={Colors.primary} style={s.footerLoader} /> : null
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
  body: {
    flex:              1,
    flexDirection:     'row',
    paddingHorizontal: 32,
    paddingTop:        24,
    gap:               24,
  },
  main:  { flex: 1 },
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
})
