import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { handleBack } from '../../utils/navigationRef'
import { fetchCustomerCare } from '../../service/homeService'
import { setFilterEventType } from '../../service/filterService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import LinkCTA from '../../components/link-cta/LinkCTA'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import HelpCenterDesktopScreen from './HelpCenterDesktopScreen'
import { FontSize } from '../../src/theme/fonts'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON_BACK  = R + 'menu_back_arrow.svg'
const ICON_ARROW = R + 'menu_right_arrow.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

type QuickLink = { TITLE: string; CTA: string }

const SUPPORT_TOPIC_TYPES = ['PROFILE', 'CONTACTMATCHES', 'PAYMENT'] as const

// ─── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  title:       string
  onPress:     () => void
  showDivider?: boolean
}

function Row({ title, onPress, showDivider }: RowProps) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
        <Text style={s.rowTitle}>{title}</Text>
        <CdnSvg uri={ICON_ARROW} width={16} height={16} />
      </Pressable>
      {showDivider && <View style={s.rowDivider} />}
    </>
  )
}

// ─── HelpCenterScreen ─────────────────────────────────────────────────────────
// Angular: help-center.component.ts — Quick Links + Support Topics hub reached
// from Menu's "Need help?" row (menu.page.ts:checkCondtion). Support Topics'
// destination FAQ pages (profile-related-faq, contacting-matches-faq, payment-faq)
// don't exist in RN yet, so those rows stub with "Coming soon" like MenuScreen's
// other unbuilt rows. Quick Links' CTA→route mapping (help-center.component.ts:
// PageNavigation) mostly targets screens not yet built in RN either — only
// "Membership Plan" maps confidently to the existing `recharge` route; the rest
// stub until their target screens are migrated.

export default function HelpCenterScreen({ navigation }: Props) {
  const isDesktop = useIsDesktopWeb()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [quickLinks, setQuickLinks]   = useState<QuickLink[]>([])
  const [loading,    setLoading]      = useState(true)
  const [csPhone,    setCsPhone]      = useState('')

  useEffect(() => {
    let cancelled = false

    fetchCustomerCare().then(({ phone }) => {
      if (!cancelled) setCsPhone(phone)
    })

    getItem(StorageKeys.Auth.USER_ID).then(userId => {
      apiCall(Endpoints.communication.faqHelp, 'POST', `ID=${userId ?? ''}&TYPE=ALL`)
        .then(res => {
          if (cancelled) return
          if (res['RESPONSECODE'] == 1 && res['ERRCODE'] == 0 && res['RESPONSE']) {
            setQuickLinks(res['RESPONSE']['QUICKLINKS'] ?? [])
          }
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    })

    return () => { cancelled = true }
  }, [])

  // Angular: help-center.component.ts PageNavigation() — mapped 1:1 per CTA:
  //  - "Add Photo"        -> router.navigate(['/editform/20'])            -> onboarding page 21
  //    (ManagePhotosScreen, opened in standalone mode so Confirm returns here
  //    instead of continuing the signup wizard — see its `standalone` param.)
  //  - "Membership Plan"  -> paymentService.redirectToIntermediatePage()  -> recharge
  //  - "Edit filter"      -> router.navigate(['search'])                 -> Search
  //  - "Newly Joined"     -> router.navigate(['/matches/bynewlyjoined']) -> Matches
  //    (matches.page.ts's urlExploreObj maps the route name 'bynewlyjoined' to the
  //    actual FILTERTYPE value 'NEYLYJOINED' (backend typo, preserved) before it
  //    ever reaches the API — passing 'bynewlyjoined' straight through would silently
  //    send the wrong filter, so the mapped value is hardcoded here.)
  //  - "Activity"         -> router.navigate(['contacting-matches-faq/9']) -> Faq
  //    (reuses the Contacting Matches FAQ's id=9 "report a scam" screen — not the
  //    Activity screen, despite the CTA's name; that's Angular's actual behavior.)
  //  - "Verify ID" has no RN destination yet (large standalone feature, out of
  //    scope here) — stays a "Coming soon" stub.
  function handleQuickLink(cta: string, title: string) {
    if (cta === 'Add Photo') {
      navigation.navigate('onboarding', { pageNo: '21', standalone: true })
    } else if (cta === 'Membership Plan') {
      navigation.navigate('recharge')
    } else if (cta === 'Edit filter') {
      setFilterEventType('pp')
      navigation.navigate('Search')
    } else if (cta === 'Newly Joined') {
      navigation.navigate('MainTabs', { screen: 'Matches', params: { exploreType: 'NEYLYJOINED', exploreLabel: title } })
    } else if (cta === 'Activity') {
      navigation.navigate('Faq', { type: 'CONTACTMATCHES', itemId: 9 })
    } else {
      Alert.alert(cta, 'Coming soon')
    }
  }

  function callSupport() {
    if (csPhone) Linking.openURL(`tel:${csPhone}`)
  }

  const supportTopics = [
    { type: SUPPORT_TOPIC_TYPES[0], title: t('FAQ_DETAILS.HEADER_1') },
    { type: SUPPORT_TOPIC_TYPES[1], title: t('FAQ_DETAILS.HEADER_2') },
    { type: SUPPORT_TOPIC_TYPES[2], title: t('FAQ_DETAILS.HEADER_4') },
  ]

  // Desktop (Figma "Jodii Desktop - Registration" node 659:21644) needs the
  // one-big-white-card layout with chevron-down rows — see
  // HelpCenterDesktopScreen.tsx's header comment. Standalone screen with its
  // own state, same split EditProfileScreen.tsx uses. Checked after (not
  // before) the hooks above since isDesktop can flip live on resize.
  if (isDesktop) {
    return <HelpCenterDesktopScreen navigation={navigation} />
  }

  return (
    <View style={s.screen}>
      <ScreenTopInset />

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => handleBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('MENU.CUSTOMER_SUPPORT')}</Text>
      </View>

      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Quick Links — dynamic, hidden while loading / if empty */}
        {loading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color={Colors.link} />
          </View>
        ) : quickLinks.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('FAQ_DETAILS.QUICK_LINKS')}</Text>
            <View style={s.card}>
              {quickLinks.map((item, i) => (
                <Row
                  key={`${item.TITLE}_${i}`}
                  title={item.TITLE}
                  onPress={() => handleQuickLink(item.CTA, item.TITLE)}
                  showDivider={i < quickLinks.length - 1}
                />
              ))}
            </View>
          </View>
        )}

        {/* Support Topics — static, mirrors Angular's 3 hardcoded cards */}
        <View style={s.section}>
          <Text style={s.sectionTitleLg}>{t('FAQ_DETAILS.SUPPORT_TOPICS')}</Text>
          <View style={s.card}>
            {supportTopics.map((topic, i) => (
              <Row
                key={topic.type}
                title={topic.title}
                onPress={() => navigation.navigate('Faq', { type: topic.type })}
                showDivider={i < supportTopics.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Footer — call customer support fallback */}
        <LinkCTA
          text={t('DELETE_PROFILE.CONTACT_SUPPORT_MSG')}
          contact={csPhone}
          onPress={callSupport}
          style={s.footer}
        />

      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.white,
  },
  flex1: { flex: 1 },

  // ── Header ──
  header: {
    height:          56,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     14,
  },
  headerTitle: {
    flex:        1,
    fontSize:    FontSize.font16,
    fontWeight:  '500',
    color:       '#333333',
    marginLeft:  6,
    marginRight: 16,
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        24,
    gap:               32,
  },

  loaderWrap: {
    paddingVertical: 24,
    alignItems:      'center',
  },

  // ── Section ──
  section: { gap: 8 },
  sectionTitle: {
    fontSize:   FontSize.font18,
    fontWeight: '600',
    color:      '#000',
  },
  sectionTitleLg: {
    fontSize:   FontSize.font20,
    fontWeight: '600',
    color:      '#000',
  },
  card: { width: '100%' },

  // ── Rows ──
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   20,
    gap:               12,
  },
  rowPressed: { opacity: 0.6 },
  rowTitle: {
    flex:       1,
    fontSize:   FontSize.font14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  rowDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(204,204,204,0.5)',
  },

  // ── Footer ──
  footer: {
    marginTop: 8,
  },
})
