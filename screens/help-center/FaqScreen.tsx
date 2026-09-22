// Angular equivalent: pages/profile-related-faq/, contacting-matches-faq/,
// payment-faq/ — three near-identical Ionic pages, each list+detail multiplexed
// inside one component via string-compared `router.url`. Ported here as one
// generic, config-driven list+detail screen since Angular itself has no shared
// "faq-item"/"accordion" component to mirror.
//
// Known simplifications vs Angular (documented, not silent):
//  - Angular's [innerHTML] copy is rendered as plain text (basic tags stripped) —
//    no rich formatting/embedded links.
//  - Interactive widgets that need whole subsystems RN hasn't built yet — photo
//    privacy radio settings (PROFILE id 4), mobile-number change (id 5),
//    horoscope-add (id 6), payment-proof file upload (PAYMENT id 5), the
//    dynamic explore-category shortcuts (CONTACTMATCHES id 5) — render their
//    text content but any further action stubs with "Coming soon", same
//    convention as MenuScreen's other unbuilt rows.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import LinkCTA from '../../components/link-cta/LinkCTA'
import { fetchFaqContent, stripHtml, type FaqType, type FaqContentItem } from '../../service/faqService'
import { setFilterEventType } from '../../service/filterService'
import { handleBack } from '../../utils/navigationRef'
import { FontSize } from '../../src/theme/fonts'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

const R = CDN_REACT + '/'
const ICON_BACK  = R + 'menu_back_arrow.svg'
const ICON_ARROW = R + 'menu_right_arrow.svg'

type Props = { navigation: any; route: { params?: { type: FaqType; itemId?: number } } }

const HEADER_KEY: Record<FaqType, string> = {
  PROFILE:        'FAQ_DETAILS.HEADER_1',
  CONTACTMATCHES: 'FAQ_DETAILS.HEADER_2',
  PAYMENT:        'FAQ_DETAILS.HEADER_4',
}

// Angular's list→id mapping. Most types are 1:1 (rowIndex+1), but
// CONTACTMATCHES swaps its first two rows (help-center.component.ts /
// contacting-matches-faq.component.ts routeNavigate calls), and a few ids have
// no dedicated detail screen — tapping them redirects immediately instead.
function idForRow(type: FaqType, rowIndex: number): number {
  if (type === 'CONTACTMATCHES') {
    if (rowIndex === 0) return 2
    if (rowIndex === 1) return 1
  }
  return rowIndex + 1
}

// ids with no detail screen — the *list row itself* triggers a direct action.
function directRowAction(type: FaqType, id: number, navigation: any): boolean {
  if (type === 'PROFILE' && id === 7) {
    navigation.navigate('DeleteProfile')
    return true
  }
  if (type === 'CONTACTMATCHES' && id === 2) {
    // Angular: searchProfileRedirection() — tapping "How to get suitable
    // matches?" goes straight to the filter screen, no detail view.
    setFilterEventType('pp')
    navigation.navigate('Search')
    return true
  }
  if (type === 'PAYMENT' && (id === 1 || id === 2)) {
    navigation.navigate('recharge')
    return true
  }
  return false
}

export default function FaqScreen({ navigation, route }: Props) {
  // route.params is undefined if this screen is ever reached with no
  // navigation state (e.g. a future deep link) — nothing to show without a
  // FaqType, so bail out below instead of crashing on the destructure.
  const { type, itemId } = route.params ?? {} as Partial<NonNullable<Props['route']['params']>>
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [content,  setContent]  = useState<FaqContentItem[]>([])
  const [payCs,    setPayCs]    = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!type) return
    let cancelled = false
    fetchFaqContent(type).then(data => {
      if (cancelled) return
      setContent(data.content)
      setPayCs(data.payCs)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [type])

  // No FaqType to show — reached with no navigation params.
  useEffect(() => {
    if (!type) handleBack()
  }, [type])

  // Redirecting back (see the effect above) — nothing to render, and lets
  // every use of `type` below narrow from `FaqType | undefined` to `FaqType`.
  if (!type) return null

  function callSupport() {
    if (payCs) Linking.openURL(`tel:${payCs}`)
  }

  function handleCta(label: string) {
    Alert.alert(label, 'Coming soon')
  }

  function openDetail(rowIndex: number) {
    if (!type) return
    const id = idForRow(type, rowIndex)
    if (directRowAction(type, id, navigation)) return
    navigation.navigate('Faq', { type, itemId: id })
  }

  const title = t(HEADER_KEY[type])

  return (
    <View style={s.screen}>
      <ScreenTopInset />
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.link} /></View>
      ) : itemId == null ? (
        <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            {content.map((item, i) => (
              <View key={i}>
                <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={() => openDetail(i)} accessibilityRole="button">
                  <Text style={s.rowTitle}>{stripHtml(item.TITLE)}</Text>
                  <CdnSvg uri={ICON_ARROW} width={16} height={16} />
                </Pressable>
                {i < content.length - 1 && <View style={s.rowDivider} />}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FaqDetail
          type={type}
          item={content[itemId - 1]}
          insets={insets}
          t={t}
          navigation={navigation}
          onCta={handleCta}
          onCallSupport={callSupport}
        />
      )}
    </View>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function FaqDetail({
  type, item, insets, t, navigation, onCta, onCallSupport,
}: {
  type: FaqType
  item: FaqContentItem | undefined
  insets: { top: number; bottom: number }
  t: (k: string) => string
  navigation: any
  onCta: (label: string) => void
  onCallSupport: () => void
}) {
  const [showVideo, setShowVideo] = useState(false)

  if (!item) {
    return <View style={s.center}><Text style={s.rowTitle}>Not found</Text></View>
  }

  const steps = [item.CONTENT1, item.CONTENT2, item.CONTENT3, item.CONTENT4, item.CONTENT5, item.CONTENT6]
    .filter(Boolean) as string[]

  // CONTACTMATCHES id 6 uses static translated steps, not CONTENT1-3 (Angular:
  // contacting-matches-faq.component.html FOLLOW_STEPS/CON_STEP_1-3 block).
  const staticSteps = (type === 'CONTACTMATCHES' && steps.length === 0)
    ? [t('FAQ_DETAILS.CON_STEP_1'), t('FAQ_DETAILS.CON_STEP_2'), t('FAQ_DETAILS.CON_STEP_3')]
    : []

  const ctaTarget = (label: string) => {
    // Angular: navigationPages('edit-filter') / navigationPages('activity') —
    // both real, already-built RN destinations.
    if (type === 'CONTACTMATCHES' && label === item.CTA1) {
      setFilterEventType('pp')
      navigation.navigate('Search')
      return
    }
    if (type === 'CONTACTMATCHES' && label === item.CTA && label.toLowerCase().includes('activity')) {
      navigation.navigate('MainTabs', { screen: 'Activity' })
      return
    }
    if (type === 'PAYMENT') { onCallSupport(); return }
    onCta(label)
  }

  return (
    <ScrollView contentContainerStyle={[s.detailContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
      {!!item.TITLE && <Text style={s.detailTitle}>{stripHtml(item.TITLE)}</Text>}
      {!!item.BODY  && <Text style={s.detailBody}>{stripHtml(item.BODY)}</Text>}

      {(staticSteps.length > 0 ? staticSteps : steps).length > 0 && (
        <View style={s.stepsList}>
          {(staticSteps.length > 0 ? staticSteps : steps).map((step, i) => (
            <View key={i} style={s.stepRow}>
              <Text style={s.stepBullet}>{'•'}</Text>
              <Text style={s.stepText}>{stripHtml(step)}</Text>
            </View>
          ))}
        </View>
      )}

      {!!item.VIDEO && (
        showVideo ? (
          <FaqVideoPlayer uri={item.VIDEO} />
        ) : (
          <Pressable style={s.videoLink} onPress={() => setShowVideo(true)}>
            <Text style={s.videoLinkText}>{'▶'}  Watch video</Text>
          </Pressable>
        )
      )}

      {!!item.CTA && (
        <Pressable style={s.ctaBtn} onPress={() => ctaTarget(item.CTA!)}>
          <Text style={s.ctaBtnText}>{stripHtml(item.CTA)}</Text>
        </Pressable>
      )}
      {!!item.CTA1 && (
        <Pressable style={[s.ctaBtn, s.ctaBtnOutline]} onPress={() => ctaTarget(item.CTA1!)}>
          <Text style={s.ctaBtnOutlineText}>{stripHtml(item.CTA1)}</Text>
        </Pressable>
      )}

      {type === 'PAYMENT' && (
        <LinkCTA
          text={t('DELETE_PROFILE.CONTACT_SUPPORT_MSG')}
          contact=""
          onPress={onCallSupport}
          style={s.footerLink}
        />
      )}
    </ScrollView>
  )
}

// ─── Video player ─────────────────────────────────────────────────────────────
// Angular: profile-related-faq.component.html's <video> tag plays the same
// direct .mp4 URL inline with native controls — this mirrors that instead of
// handing the URL off to the OS browser via Linking.

function FaqVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.play() })
  return <VideoView player={player} style={s.video} nativeControls />
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: FontSize.font16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16 },
  card: { width: '100%' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, gap: 12 },
  rowPressed: { opacity: 0.6 },
  rowTitle: { flex: 1, fontSize: FontSize.font14, fontWeight: '500', color: Colors.textPrimary },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(204,204,204,0.5)' },

  detailContent: { padding: 24, gap: 16 },
  detailTitle: { fontSize: FontSize.font18, fontWeight: '600', color: '#000' },
  detailBody:  { fontSize: FontSize.font14, color: '#333', lineHeight: 20 },

  stepsList: { gap: 8 },
  stepRow: { flexDirection: 'row', gap: 8 },
  stepBullet: { fontSize: FontSize.font14, color: Colors.textPrimary },
  stepText: { flex: 1, fontSize: FontSize.font14, color: Colors.textPrimary, lineHeight: 20 },

  videoLink: { paddingVertical: 8 },
  videoLinkText: { fontSize: FontSize.font14, fontWeight: '500', color: Colors.link },
  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: '#000' },

  ctaBtn: {
    height: 48, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtnText: { color: Colors.white, fontSize: FontSize.font14, fontWeight: '600' },
  ctaBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primaryDark },
  ctaBtnOutlineText: { color: Colors.primaryDark, fontSize: FontSize.font14, fontWeight: '600' },

  footerLink: { marginTop: 16 },
})
