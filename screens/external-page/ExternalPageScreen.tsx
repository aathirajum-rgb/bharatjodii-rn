// Angular equivalent: pages/external-page/external-page.page.ts + .html — a
// hardcoded id→URL map (1=privacy policy, 2=terms) rendered in an <iframe>,
// no API call, no loading/error state, no in-page title (Angular's header is
// just a back button; the label only ever exists as the menu link text).
//
// Ported as one generic screen taking {url, title} instead of an id, since RN
// has no reason to re-derive the URL from a numeric id — the caller already
// knows which page it wants. Adds a header title bar to match this app's own
// screen convention (FaqScreen, IgnoredProfilesScreen, etc.) — Angular itself
// has no such title on this page, so this is a deliberate convention-match,
// not a ported behavior.

import { useEffect } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { handleBack } from '../../utils/navigationRef'
import { FontSize } from '../../src/theme/fonts'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'

type Props = { navigation: any; route: { params?: { url: string; title: string } } }

export default function ExternalPageScreen({ navigation: _navigation, route }: Props) {
  // route.params is undefined if this screen is ever reached with no
  // navigation state (e.g. a future deep link) — nothing to show without a
  // url, so bail out below instead of crashing on the destructure.
  const { url, title } = route.params ?? {} as Partial<NonNullable<Props['route']['params']>>
  const insets = useSafeAreaInsets()

  // react-native-webview has no web implementation — it renders an "unsupported
  // platform" placeholder there. This isn't an Angular behavior to port (Angular's
  // web build is a real browser, so its iframe works fine); it's a native-module
  // gap on RN-web specifically, worked around the same way CdnSvg already
  // branches on Platform.OS. A new tab is the natural web equivalent of "open
  // this page without leaving the app flow."
  useEffect(() => {
    if (Platform.OS === 'web' && url) {
      Linking.openURL(url).catch(e => {
        if (__DEV__) console.error('[ExternalPage] open url error:', e)
      })
    }
  }, [url])

  // No url to show — reached with no navigation params.
  useEffect(() => {
    if (!url) handleBack()
  }, [url])

  if (!url) return null

  return (
    <View style={[s.screen, { paddingBottom: insets.bottom }]}>
      <ScreenTopInset />
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {Platform.OS === 'web' ? (
        <View style={s.center}>
          <Text style={s.webFallbackText}>Opening in a new tab…</Text>
        </View>
      ) : (
        <WebView source={{ uri: url }} style={s.webview} />
      )}
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
  headerTitle: { flex: 1, fontSize: FontSize.font16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  webFallbackText: { fontSize: FontSize.font14, color: Colors.textSecondary },
})
