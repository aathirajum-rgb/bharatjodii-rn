// Desktop layout for "Profile marked as view later" (Figma "Jodii Desktop -
// Registration", UaPAN9aG6MfZf6CRpwXf1L, node 647:14826) — a single-column
// list of full-width MatchCardDesktop rows inside the account sidebar shell
// (DesktopPageShell), not the top-nav-only shell ActivityDesktopLayout.tsx
// uses (that screen is reached from the footer tabs; this one is reached
// from HomeSidebar, same as Settings/Edit preferences/Delete profile).
// Purely presentational — ViewLaterScreen.tsx owns all state/handlers.
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import MatchCardDesktop from '../../components/matches/MatchCardDesktop'
import { Colors } from '../../constants/colors'
import type { MatchProfile } from '../../types/interfaces/matches.interface'
import type { ContactGating } from '../../hooks/useContactGating'
import type { FooterTab } from '../../components/app-footer/AppFooter'

export interface ViewLaterDesktopLayoutProps {
  navigation: any
  userName:   string
  title:      string
  profiles:   MatchProfile[]
  loaded:     boolean
  loadingMore: boolean
  gating:     ContactGating

  onTabPress:  (tab: FooterTab) => void
  onLoadMore:  () => void
  onPress:     (p: MatchProfile) => void
  onCall:      (p: MatchProfile) => void
  onWhatsApp:  (p: MatchProfile) => void

  children?: ReactNode  // modals/toast rendered by ViewLaterScreen.tsx
}

function noop() {}

export default function ViewLaterDesktopLayout({
  navigation, userName, title, profiles, loaded, loadingMore, gating,
  onTabPress, onLoadMore, onPress, onCall, onWhatsApp, children,
}: ViewLaterDesktopLayoutProps) {
  const { t } = useTranslation()

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="viewLater" onTabPress={onTabPress}>
      <View style={s.header}>
        <Text style={s.title}>{title}</Text>
      </View>

      {!loaded ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.profileId}
          style={s.list}
          renderItem={({ item }) => (
            <MatchCardDesktop
              profile={item}
              oppGender={gating.oppGender}
              ownEntryType={gating.ownEntryType}
              femaleFreeEligible={gating.femaleFreeEligible}
              indNumbersLeft={gating.indNumbersLeft}
              onPress={() => onPress(item)}
              onLike={noop}
              onDontShow={noop}
              onViewLater={noop}
              onCall={() => onCall(item)}
              onWhatsApp={() => onWhatsApp(item)}
            />
          )}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.primaryDark} style={s.footerLoader} /> : null}
          ListEmptyComponent={(
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>{t('PROFILES.NORESULT_2')}</Text>
            </View>
          )}
          contentContainerStyle={s.listContent}
        />
      )}

      {children}
    </DesktopPageShell>
  )
}

const s = StyleSheet.create({
  header: { width: 810, marginBottom: 24 },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.black },

  list: { width: 810 },
  listContent: { paddingBottom: 32 },
  loadingWrap: { width: 810, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  footerLoader: { marginVertical: 16 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black, textAlign: 'center' },
})
