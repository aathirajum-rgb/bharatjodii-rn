// Desktop layout for "Contact Customer support" (Figma "Jodii Desktop -
// Registration", UaPAN9aG6MfZf6CRpwXf1L, node 659:21644 — the frame's own
// internal Figma layer name is stale/mislabeled "Settings_Change language",
// confirmed by rendered screenshot instead of trusting the name). Same
// account-sidebar shell as Settings/ViewLater/IgnoredProfiles
// (DesktopPageShell) — reached from HomeSidebar, not the footer tabs.
//
// Standalone screen reusing HelpCenterScreen.tsx's exact real data/behavior
// (faqHelp API for Quick Links, the same static 3-topic Support Topics list,
// fetchCustomerCare for the footer phone) inside Figma's real desktop shape:
// one big white card, Quick Links + Support Topics + Contact us stacked with
// dividers, chevron-DOWN row icons (confirmed via get_design_context — a
// different glyph from mobile's chevron-right).
//
// Figma's mock shows ONE quick-link row ("Somebody tried to scam me...")
// expanded inline with a 3-step bullet answer. Verified live against the real
// faqhelp/v1 API: QUICKLINKS items only ever carry {TITLE, IMAGE, CTA} — no
// answer/body field exists to expand. That bullet text is mockup filler the
// designer typed by hand; the CTA for that exact row ("Activity") confirms
// its real behavior is just navigation, matching HelpCenterScreen.tsx's own
// handleQuickLink() mapping. So no inline-accordion state is built here.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { fetchCustomerCare } from '../../service/homeService'
import type { FooterTab } from '../../components/app-footer/AppFooter'

const CALL_ICON = CDN_SVG + 'revamp/call-blue.svg'
const CHEVRON_DOWN = CDN_REACT + '/chevron-down-row-icon.svg'

const SUPPORT_TOPIC_TYPES = ['PROFILE', 'CONTACTMATCHES', 'PAYMENT'] as const

type Props = { navigation: any }

type QuickLink = { TITLE: string; CTA: string }

function Row({ title, onPress, showDivider }: { title: string; onPress: () => void; showDivider: boolean }) {
  return (
    <>
      <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={onPress}>
        <Text style={s.rowTitle}>{title}</Text>
        <CdnSvg uri={CHEVRON_DOWN} width={16} height={16} />
      </Pressable>
      {showDivider && <View style={s.rowDivider} />}
    </>
  )
}

export default function HelpCenterDesktopScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [loading,    setLoading]    = useState(true)
  const [csPhone,    setCsPhone]    = useState('')
  const [userName,   setUserName]   = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))

    fetchCustomerCare().then(({ phone }) => setCsPhone(phone))

    getItem(StorageKeys.Auth.USER_ID).then(userId => {
      apiCall(Endpoints.communication.faqHelp, 'POST', `ID=${userId ?? ''}&TYPE=ALL`)
        .then(res => {
          if (res['RESPONSECODE'] == 1 && res['ERRCODE'] == 0 && res['RESPONSE']) {
            setQuickLinks(res['RESPONSE']['QUICKLINKS'] ?? [])
          }
        })
        .finally(() => setLoading(false))
    })
  }, [])

  // Mirrors HelpCenterScreen.tsx's handleQuickLink() exactly — see that file's
  // header comment for the full Angular PageNavigation() trace this is ported from.
  function handleQuickLink(cta: string, title: string) {
    if (cta === 'Add Photo') {
      navigation.navigate('onboarding', { pageNo: '21', standalone: true })
    } else if (cta === 'Membership Plan') {
      navigation.navigate('recharge')
    } else if (cta === 'Edit filter') {
      navigation.navigate('Search')
    } else if (cta === 'Newly Joined') {
      navigation.navigate('Matches', { exploreType: 'NEYLYJOINED', exploreLabel: title })
    } else if (cta === 'Activity') {
      navigation.navigate('Faq', { type: 'CONTACTMATCHES', itemId: 9 })
    } else {
      Alert.alert(cta, 'Coming soon')
    }
  }

  function callSupport() {
    if (csPhone) Linking.openURL(`tel:${csPhone}`)
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: navigation.navigate('recharge', { fromTab: true }); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  const supportTopics = [
    { type: SUPPORT_TOPIC_TYPES[0], title: t('FAQ_DETAILS.HEADER_1') },
    { type: SUPPORT_TOPIC_TYPES[1], title: t('FAQ_DETAILS.HEADER_2') },
    { type: SUPPORT_TOPIC_TYPES[2], title: t('FAQ_DETAILS.HEADER_4') },
  ]

  return (
    <DesktopPageShell navigation={navigation} userName={userName} activeItem="customerSupport" onTabPress={handleTabPress}>
      <View style={s.header}>
        <Text style={s.title}>{t('MENU.CUSTOMER_SUPPORT')}</Text>
      </View>

      <View style={s.card}>
        {loading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color={Colors.primaryDark} />
          </View>
        ) : quickLinks.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('FAQ_DETAILS.QUICK_LINKS')}</Text>
            <View style={s.rows}>
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

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('FAQ_DETAILS.SUPPORT_TOPICS')}</Text>
          <View style={s.rows}>
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

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('FAQ_DETAILS.CONTACT_US', 'Contact us')}</Text>
          <Pressable style={s.contactBox} onPress={callSupport}>
            <Text style={s.contactText}>{t('DELETE_PROFILE.CONTACT_SUPPORT_MSG')}</Text>
            <View style={s.contactPhoneRow}>
              <CdnSvg uri={CALL_ICON} width={18} height={18} />
              <Text style={s.contactPhone}>{csPhone}</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </DesktopPageShell>
  )
}

const s = StyleSheet.create({
  header: { width: 810, marginBottom: 24 },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 22, color: Colors.black },

  card: {
    width: 810, backgroundColor: Colors.white, borderRadius: 16,
    padding: 40, gap: 32,
  },
  loaderWrap: { paddingVertical: 24, alignItems: 'center' },

  section: { gap: 16 },
  sectionTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black },
  rows: {},

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  rowPressed: { opacity: 0.6 },
  rowTitle: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderSubtle },

  contactBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  contactText: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  contactPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactPhone: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link },
})
