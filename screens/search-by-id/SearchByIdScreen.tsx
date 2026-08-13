// Angular equivalent: pages/matches/search/search.page.ts + .html — there the
// ID-lookup box is one widget bolted onto the shared filter-search page
// (alongside the Age/Height/etc. filter-shortcut labels). This screen splits
// it into its own standalone flow, matching the Figma design (node 3366-13171)
// which shows it as a clean, single-purpose screen.
//
// Ported as-is from Angular (see search.page.ts):
//  - Submit stays disabled until length > 6 digits (not "exactly 7", despite
//    the copy) — up to 12 digits are accepted, matching the real code path.
//  - A not-found result and an API/network failure are indistinguishable to
//    the user — both show SEARCH_ID_ERROR. Not fixed here; that's a product
//    decision, not a silent improvement.
//  - No client-side guard against searching your own ID — same as Angular,
//    entirely a server-side concern.
//  - On success, navigates to ViewProfile WITHOUT a profileIds list, so
//    prev/next swipe is naturally disabled there (ViewProfileScreen derives
//    hasPrevProfile/hasNextProfile from profileIds, which defaults to []) —
//    same end result as Angular's router.url.includes('/searchbyid') check,
//    no special-casing needed on the ViewProfile side.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { searchProfileById } from '../../service/searchByIdService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import FloatingLabelInput from '../../components/input/FloatingLabelInput'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import SearchByIdDesktopLayout from './SearchByIdDesktopLayout'
import { getItem } from '../../service/storageService'
import { StorageKeys } from '../../constants/storage.keys'
import { openMembershipTab } from '../../service/paymentService'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any }

export default function SearchByIdScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  const [id, setId] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const canSubmit = id.length > 6 && !loading

  function handleChangeId(text: string) {
    setId(text)
    if (error) setError(undefined)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(undefined)
    try {
      const matriId = await searchProfileById(id)
      if (matriId) {
        navigation.navigate('viewProfile', { matriId, fromPage: 'searchbyid' })
      } else {
        setError(t('SEARCH.SEARCH_ID_ERROR'))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  if (isDesktop) {
    return (
      <SearchByIdDesktopLayout
        navigation={navigation}
        userName={userName}
        id={id}
        error={error}
        loading={loading}
        canSubmit={canSubmit}
        onChangeId={handleChangeId}
        onSubmit={handleSubmit}
        onTabPress={handleTabPress}
      />
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('SEARCH.SEARCH_BY_ID')}</Text>
      </View>

      <View style={[s.content, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.heading}>{t('SEARCH.SEARCH_ID_CONTENT')}</Text>

        <FloatingLabelInput
          label={t('MENU.SUBMENU_2_4')}
          value={id}
          onChangeText={handleChangeId}
          errorMessage={error}
          variant="id"
          style={s.input}
        />

        <View style={s.footer}>
          <ButtonRevamp
            label={t('SEARCH.SUBMIT')}
            variant="primary"
            fullWidth
            disabled={!canSubmit}
            loading={loading}
            onPress={handleSubmit}
          />
        </View>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  heading: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 24 },
  input: { marginBottom: 0 },

  footer: { marginTop: 'auto' },
})
