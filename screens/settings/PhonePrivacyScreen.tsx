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
import { openMembershipTab } from '../../service/paymentService'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { handleBack } from '../../utils/navigationRef'
import { ICON } from '../menu/MenuScreen'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

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

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

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
      <View style={s.confirmRow}>
        <View style={s.confirmBtn}>
          <ButtonRevamp label={t('PRIVACY.PHONE_POPUP_CTA2')} variant="secondary" fullWidth onPress={handleConfirmNo} disabled={saving} />
        </View>
        <View style={s.confirmBtn}>
          <ButtonRevamp label={t('PRIVACY.PHONE_POPUP_CTA1')} variant="primary" fullWidth loading={saving} onPress={handleConfirmYes} disabled={saving} />
        </View>
      </View>
    </View>
  ) : (
    <>
      <View style={s.assureBanner}>
        <CdnSvg uri={ICON_VERIFIED} width={20} height={20} />
        <Text style={s.assureText}>{t('PRIVACY.PHONE_PRIVACY_TITLE')}</Text>
      </View>

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

      <View style={s.submitRow}>
        <ButtonRevamp label={t('GENERAL.SUBMIT')} variant="primary" fullWidth onPress={handleSubmit} />
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
    <View style={[s.screen, { paddingTop: insets.top }]}>
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
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333333', marginLeft: 6, marginRight: 16 },
  mobileBody: { flex: 1, paddingHorizontal: 16 },

  desktopHeader: {
    width: 810, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24,
  },
  desktopBackArrow: { fontSize: 22, color: Colors.black },
  desktopTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },
  desktopCard: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, padding: 40,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4,
  },

  loadingBox: { paddingVertical: 32, alignItems: 'center' },

  assureBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#EAF4FF', borderRadius: 8, padding: 16, marginBottom: 16,
  },
  assureText: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, lineHeight: 18, color: Colors.black },

  option: { paddingVertical: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle },
  optionText: { flex: 1, gap: 6 },
  optionTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  optionContent: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, lineHeight: 18, color: Colors.black },

  recommendedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, alignSelf: 'flex-start',
    backgroundColor: '#FBF2F5', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 8,
  },
  recommendedIconWrap: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  recommendedText: { fontFamily: Fonts.poppinsMedium, fontSize: 12, color: Colors.primaryDark },

  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  submitRow: { marginTop: 24, marginBottom: 16 },

  confirmBox: { paddingVertical: 8 },
  confirmTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, textAlign: 'center' },
  confirmContent: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.black, textAlign: 'center', marginTop: 8 },
  confirmRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  confirmBtn: { flex: 1 },
})
