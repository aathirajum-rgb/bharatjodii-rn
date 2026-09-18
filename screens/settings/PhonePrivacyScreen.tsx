// Angular equivalent: pages/phone-privacy/phone-privacy.component.ts — female-
// only (Settings row gated the same way, see SettingsScreen.tsx), reached from
// Settings on both mobile and desktop. Figma desktop design: UaPAN9aG6MfZf6CRpwXf1L,
// node 659-28968.
//
// Known simplification vs Angular: the 3 option titles/contents are static
// i18n content (PRIVACY.PHONE_OPTION_*), not fetched from initialfetch?type=
// phoneprivacy's RESPONSE.PHONEPRIVACYCONTENT — same deliberate simplification
// this app's sibling PhotoPrivacySheet.tsx already makes for photo privacy.
//
// Angular's phonePrivacyArr = {"0":"1","1":"2","2":"3"} (UI radio index -> server
// VALUE) and MOBILEPRIVACY is stored as the UI INDEX itself, not the server
// value — matched exactly here (CODE_FOR_VALUE below, stored as-is).
// Submitting index '1' or '2' shows a confirm dialog first (fewer responses
// warning); index '0' ("Highly recommended") saves immediately.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { handleFooterTabPress } from '../../utils/footerTabPress'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { handleBack } from '../../utils/navigationRef'
import { ICON } from '../menu/MenuScreen'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

type Props = { navigation: any }

type UiValue = '0' | '1' | '2'

// UI radio index -> server VALUE (Angular: phonePrivacyArr)
const CODE_FOR_VALUE: Record<UiValue, string> = { '0': '1', '1': '2', '2': '3' }

const ICON_VERIFIED = CDN_SVG + 'privacy-verified.svg'
const ICON_STAR     = CDN_SVG + 'privacy-star.svg'

export default function PhonePrivacyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [userName, setUserName] = useState('')
  const [userId, setUserId]     = useState('')
  const [storedValue, setStoredValue] = useState<UiValue>('0')
  const [selected, setSelected] = useState<UiValue>('0')
  const [step, setStep]         = useState<'options' | 'confirm'>('options')

  useEffect(() => {
    Promise.all([
      getItem(SK.User.NAME),
      getItem(SK.Auth.USER_ID),
      getItem(SK.Profile.MOBILE_PRIVACY),
    ]).then(([name, id, stored]) => {
      setUserName(name ?? '')
      setUserId(id ?? '')
      const v: UiValue = stored === '1' || stored === '2' ? stored : '0'
      setStoredValue(v)
      setSelected(v)
      setLoading(false)
    })
  }, [])

  const handleTabPress = (tab: FooterTab) => handleFooterTabPress(navigation, tab)

  function handleSubmit() {
    if (selected === '1' || selected === '2') {
      setStep('confirm')
      return
    }
    save(selected)
  }

  function handleConfirmYes() {
    save(selected)
  }

  function handleConfirmNo() {
    setSelected(storedValue)
    setStep('options')
  }

  async function save(value: UiValue) {
    if (value === storedValue) {
      handleBack()
      return
    }
    setSaving(true)
    try {
      const res = await apiCall(Endpoints.profile.privacySetting, 'POST', `ID=${userId}&VALUE=${CODE_FOR_VALUE[value]}&TYPE=2`)
      setSaving(false)
      if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        await setItem(SK.Profile.MOBILE_PRIVACY, value)
        Alert.alert('', t('PRIVACY.SUCCESS_TOAST'))
        handleBack()
      } else {
        Alert.alert('', res?.RESPONSE?.MSG || 'Something went wrong. Please try again.')
      }
    } catch {
      setSaving(false)
      Alert.alert('', 'Something went wrong. Please try again.')
    }
  }

  const options: Array<{ value: UiValue; title: string; content: string; recommended?: boolean }> = [
    { value: '0', title: t('PRIVACY.PHONE_OPTION_1_TITLE'), content: t('PRIVACY.PHONE_OPTION_1_CONTENT'), recommended: true },
    { value: '1', title: t('PRIVACY.PHONE_OPTION_2_TITLE'), content: t('PRIVACY.PHONE_OPTION_2_CONTENT') },
    { value: '2', title: t('PRIVACY.PHONE_OPTION_3_TITLE'), content: t('PRIVACY.PHONE_OPTION_3_CONTENT') },
  ]

  const confirmTitle = selected === '1' ? t('PRIVACY.PHONE_POPUP_TITLE2') : t('PRIVACY.PHONE_POPUP_TITLE1')

  const body = loading ? (
    <View style={s.loadingBox}><ActivityIndicator color={Colors.primaryDark} size="large" /></View>
  ) : step === 'confirm' ? (
    <View style={s.confirmBox}>
      <Text style={s.confirmTitle}>{confirmTitle}</Text>
      <Text style={s.confirmContent}>{t('PRIVACY.PHONE_POPUP_CONTENT')}</Text>
      {/* Angular: middlepopup.component.html:80-88 — the two CTAs are STACKED
          (Yes on top, pt-16; No below, pt-12), not side-by-side, and "No"
          uses .primary-disabled-cta-jodii — a muted grey look, not an active
          outlined secondary button. */}
      <View style={s.confirmYesWrap}>
        <ButtonRevamp label={t('PRIVACY.PHONE_POPUP_CTA1')} variant="primary" size="standard" fullWidth loading={saving} onPress={handleConfirmYes} disabled={saving} />
      </View>
      <Pressable style={s.confirmNoBtn} onPress={handleConfirmNo} disabled={saving} accessibilityRole="button">
        <Text style={s.confirmNoText}>{t('PRIVACY.PHONE_POPUP_CTA2')}</Text>
      </Pressable>
    </View>
  ) : (
    <>
      {/* Angular's blue banner bleeds edge-to-edge on mobile (only the row's
          own pl-24/pr-24 insets the icon/text) — the desktop card's own
          padding is a Figma-driven 40px, a different container this bleed
          math doesn't apply to, so it's gated to mobile only. */}
      <View style={[s.assureBanner, !isDesktop && s.assureBannerBleed]}>
        {/* privacy-verified.svg's real intrinsic size is 24x24 (fetched
            directly), not 20x20. */}
        <CdnSvg uri={ICON_VERIFIED} width={24} height={24} />
        <Text style={s.assureText}>{t('PRIVACY.PHONE_PRIVACY_TITLE')}</Text>
      </View>

      {/* Angular: .list-block { gap: 12px } — the 12px space BETWEEN option
          rows, distinct from each row's own 10px padding-top/bottom. */}
      <View style={s.optionsList}>
        {options.map((opt, i) => {
          const isSelected = selected === opt.value
          return (
            <Pressable
              key={opt.value}
              style={[s.option, i > 0 && s.optionDivider]}
              onPress={() => setSelected(opt.value)}
            >
              <View style={s.optionText}>
                <Text style={s.optionTitle}>{opt.title}</Text>
                <Text style={s.optionContent}>{opt.content}</Text>
                {opt.recommended && (
                  <View style={s.recommendedRow}>
                    <View style={s.recommendedIconWrap}>
                      <CdnSvg uri={ICON_STAR} width={12} height={12} />
                    </View>
                    <Text style={s.recommendedText}>{t('PRIVACY.POPUP_SHOW_ALL_PHOTO_HR_TXT')}</Text>
                  </View>
                )}
              </View>
              <View style={[s.radio, isSelected && s.radioSelected]}>
                {isSelected && <View style={s.radioDot} />}
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={s.submitRow}>
        <ButtonRevamp label={t('GENERAL.SUBMIT')} variant="primary" size="standard" fullWidth onPress={handleSubmit} />
      </View>
    </>
  )

  if (isDesktop) {
    return (
      <DesktopPageShell navigation={navigation} userName={userName} activeItem="settings" onTabPress={handleTabPress}>
        <View style={s.desktopHeader}>
          <Pressable onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
            <Text style={s.desktopBackArrow}>←</Text>
          </Pressable>
          <Text style={s.desktopTitle}>{t('PRIVACY.PHONE_PRIVACY_HEADER')}</Text>
        </View>
        <View style={s.desktopCard}>
          {body}
        </View>
      </DesktopPageShell>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('PRIVACY.PHONE_PRIVACY_HEADER')}</Text>
      </View>
      <View style={s.mobileBody}>
        {body}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: { height: 56, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  // Angular: .heading4-medium-16 (phone-privacy.component.html:31) — 16px
  // Poppins-Medium — was missing fontFamily entirely (bare fontWeight).
  headerTitle: { flex: 1, fontSize: FontSize.font16, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: '#333333', marginLeft: 6, marginRight: 16 },
  // Angular: every section here (we-assure-block, the options row, the
  // footer) uses 24px horizontal padding (`pl-24 pr-24` / `ion-cust-padding`),
  // not 16.
  mobileBody: { flex: 1, paddingHorizontal: 24 },

  desktopHeader: {
    width: 810, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24,
  },
  desktopBackArrow: { fontSize: FontSize.font22, color: Colors.black },
  desktopTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font22, color: Colors.black },
  desktopCard: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, padding: 40,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4,
  },

  loadingBox: { paddingVertical: 32, alignItems: 'center' },

  // Angular: .we-assure-block { background: #EFF9FF }, no border-radius —
  // marginBottom matches the FOLLOWING options list's real `mt-20`
  // (phone-privacy.component.html:59), not an arbitrary banner gap.
  assureBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#EFF9FF', paddingVertical: 16, marginBottom: 20,
  },
  // Mobile only (see render comment) — the row's own pl-24/pr-24 is INSIDE an
  // ion-content with no side padding of its own, so the blue background
  // bleeds edge-to-edge across the full screen width and only the ICON/TEXT
  // are inset by 24px. RN's `mobileBody` applies paddingHorizontal:24 to
  // every child, which was trapping the banner's background inside that
  // inset instead of letting it bleed — cancelled with a matching negative
  // marginHorizontal, then paddingHorizontal:24 re-applied so the icon/text
  // land in the same place as before.
  assureBannerBleed: { marginHorizontal: -24, paddingHorizontal: 24 },
  // Angular: .body3-regular-12 — 12px, not 13.
  assureText: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, lineHeight: 18, color: Colors.black },

  // Angular: .list-block { gap: 12px } — the space between option rows.
  optionsList: { gap: 12 },
  // Angular: .show-photo-block { padding-top: 10px; padding-bottom: 10px }
  // — 10, not 16 (RN's flat 16 had coincidentally summed to the same total
  // gap between adjacent rows as 10+12(list gap)+10, but the first row's own
  // gap from the banner above — 20(banner) + 10(this) — didn't match RN's
  // 20+16 = 36 instead of the real 30).
  option: { paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  // Angular: .show-photo-block { border-bottom: 1px solid #dddddd } —
  // Colors.border (#dddddd), not Colors.borderSubtle (#e6e6e6).
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  // Angular: title's mb-8 and the recommended-block's mt-8 are both 8px, not 6.
  optionText: { flex: 1, gap: 8 },
  // Angular: .body1-medium-14 (phone-privacy.component.html:65) — 14px
  // Poppins-MEDIUM, not SemiBold — plus its own line-height-18.
  optionTitle: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font14, lineHeight: 18, color: Colors.black },
  // Angular: .body2-regular-14 — 14px, not 13.
  optionContent: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, lineHeight: 18, color: Colors.black },

  recommendedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, alignSelf: 'flex-start',
    backgroundColor: '#FBF2F5', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 8,
  },
  // Angular: .star-bg { background:#C70038; padding:6px; border-radius:50% }
  // around a 12x12 icon — a 24x24 circle, not 16x16, and a distinct red from
  // Colors.primaryDark (#B50033).
  recommendedIconWrap: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#C70038',
    alignItems: 'center', justifyContent: 'center',
  },
  // Angular: .color-C70038 — not Colors.primaryDark.
  recommendedText: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font12, color: '#C70038' },

  // Angular: ion-radio's --color-checked: #B30033 — a distinct hex from
  // Colors.primaryDark (#B50033). marginTop matches the radio's own real
  // `mt-16` (phone-privacy.component.html:63), not a small 2px nudge.
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  radioSelected: { borderColor: '#B30033' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B30033' },

  submitRow: { marginTop: 24, marginBottom: 16 },

  confirmBox: { paddingVertical: 8 },
  // Angular: middlepopup.component.html:59/66 — .heading3-semibold-16
  // .color-1f1e1b, not Colors.black.
  confirmTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font16, color: '#1f1e1b', textAlign: 'center' },
  confirmContent: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font13, color: Colors.black, textAlign: 'center', marginTop: 8 },
  // Angular: the two CTAs are stacked (pt-16 above Yes, pt-12 above No), not
  // side-by-side.
  confirmYesWrap: { marginTop: 16 },
  // Angular: .primary-disabled-cta-jodii — a muted grey look (NOT an active
  // outlined secondary button): background #F0F0F0, text #B0B0B0, radius 8,
  // height:auto with --padding-top/-bottom:8px (content-hugging, not a fixed
  // 44px slab like the real button above it).
  confirmNoBtn: {
    marginTop: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  // Angular: line-height:16px, letter-spacing:0.05px (also declared on
  // .primary-disabled-cta-jodii).
  confirmNoText: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font14, lineHeight: 16, letterSpacing: 0.05, color: '#B0B0B0' },
})
