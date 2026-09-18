// Angular equivalent: pages/manage-account/manage-account.page.ts ("Settings").
// This RN port's mobile MenuScreen.tsx already folded this page's rows
// (Change language/Delete profile/Logout, plus Privacy Policy/Terms which
// Angular's own Settings page doesn't show) directly into its own "Card 5" —
// there's no dedicated mobile Settings screen to branch off of the way most
// other screens in this app do. This is a fresh, single screen supporting
// both platforms: a full-screen list on mobile (for the sake of having a
// working 'Settings' route at all — nothing currently navigates here on
// mobile) and the DesktopPageShell-wrapped card Figma's desktop design
// (UaPAN9aG6MfZf6CRpwXf1L, node 647:13325 / 659-23124) actually asks for,
// reached via HomeSidebar's "Settings" row.
//
// Angular's Phone Privacy row is gated on `loginGender !== 'M'` — matched
// here via the SAME `g === 'M' ? 'M' : 'F'` convention the majority of this
// codebase's own gender checks already use (Home/DailyRecommendation/Search/
// EditProfileDesktop/BlockerScreen/...), not the minority '0'/'1' raw-code
// convention a couple of older files use.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DesktopPageShell from '../../components/desktop-page-shell/DesktopPageShell'
import LogoutConfirmModal from '../../components/home-sidebar/LogoutConfirmModal'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { handleFooterTabPress } from '../../utils/footerTabPress'
import { handleBack } from '../../utils/navigationRef'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { ICON, LogoutSheet, performLogout } from '../menu/MenuScreen'
import { restoreIosPurchases } from '../../service/iapService'
import type { FooterTab } from '../../components/app-footer/AppFooter'

type Props = { navigation: any }

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const [userName, setUserName] = useState('')
  const [isFemale, setIsFemale] = useState(false)
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false)

  useEffect(() => {
    Promise.all([
      getItem(SK.User.NAME),
      getItem(SK.User.LOGIN_GENDER),
    ]).then(([name, g]) => {
      setUserName(name ?? '')
      setIsFemale(g !== 'M')
    })
  }, [])

  const handleTabPress = (tab: FooterTab) => handleFooterTabPress(navigation, tab)

  function handleLogout() {
    setLogoutSheetVisible(true)
  }

  async function handleConfirmLogout() {
    setLogoutSheetVisible(false)
    await performLogout()
  }

  // Apple requires a visible "Restore Purchases" affordance for
  // non-consumable/subscription IAPs — see service/iapService.ts.
  async function handleRestorePurchases() {
    const result = await restoreIosPurchases()
    if (result.status === 'success') {
      Alert.alert('Restore Purchases', 'Your purchases have been restored.')
    } else {
      Alert.alert('Restore Purchases', result.message ?? 'No purchases to restore.')
    }
  }

  const rows = [
    {
      key: 'language', icon: ICON.language, title: t('MENU.TTTLE_6'),
      onPress: () => navigation.navigate('LanguageSelection'),
    },
    ...(isFemale ? [{
      key: 'phonePrivacy', icon: CDN_SVG + 'phone-privacy-settings.svg', title: t('MENU.PHONE_PRIVACY'),
      onPress: () => navigation.navigate('PhonePrivacy'),
    }] : []),
    // No dedicated "restore purchases" icon exists in ICON yet (see
    // MenuScreen.tsx) — reusing `support` as a neutral placeholder pending a
    // real asset from design.
    ...(Platform.OS === 'ios' ? [{
      key: 'restorePurchases', icon: ICON.support, title: t('ACCOUNT.RESTORE_PURCHASES'),
      onPress: handleRestorePurchases,
    }] : []),
    {
      key: 'deleteProfile', icon: ICON.deleteAccount, title: t('ACCOUNT.DEL_PRO'),
      onPress: () => navigation.navigate('DeleteProfile'),
    },
    {
      key: 'logout', icon: ICON.logout, title: t('ACCOUNT.LOGOUT'),
      onPress: handleLogout,
    },
  ]

  const rowList = (
    <>
      {rows.map((row, i) => (
        <View key={row.key}>
          <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={row.onPress} accessibilityRole="button">
            <View style={s.rowIconWrap}>
              <CdnSvg uri={row.icon} width={24} height={24} />
            </View>
            <Text style={s.rowTitle}>{row.title}</Text>
            <CdnSvg uri={ICON.arrow} width={16} height={16} />
          </Pressable>
          {i < rows.length - 1 && <View style={s.rowDivider} />}
        </View>
      ))}
    </>
  )

  if (isDesktop) {
    return (
      <DesktopPageShell navigation={navigation} userName={userName} activeItem="settings" onTabPress={handleTabPress}>
        <View style={s.desktopHeader}>
          <Text style={s.desktopTitle}>{t('MENU.SETTINGS')}</Text>
        </View>
        <View style={s.desktopCard}>
          {rowList}
        </View>
        <LogoutConfirmModal visible={logoutSheetVisible} onYes={handleConfirmLogout} onNo={() => setLogoutSheetVisible(false)} />
      </DesktopPageShell>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('MENU.SETTINGS')}</Text>
      </View>
      <View style={s.mobileCard}>
        {rowList}
      </View>
      <LogoutSheet visible={logoutSheetVisible} onYes={handleConfirmLogout} onNo={() => setLogoutSheetVisible(false)} />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: { height: 56, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  // Same back-button-header convention used across ~15 other screens
  // (e.g. MenuContactsScreen.tsx's headerTitle) — was missing fontFamily
  // entirely, so it rendered in the system font instead of Poppins-Medium.
  headerTitle: { flex: 1, fontSize: FontSize.font16, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: '#333333', marginLeft: 6, marginRight: 16 },

  mobileCard: { backgroundColor: Colors.white, marginTop: 8 },

  desktopHeader: { width: 810, marginBottom: 24 },
  desktopTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font22, color: Colors.black },
  desktopCard: {
    width: 810, backgroundColor: Colors.white, borderRadius: 24, overflow: 'hidden',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8,
    elevation: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, gap: 12,
  },
  rowPressed: { backgroundColor: Colors.surfaceInput },
  rowIconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderSubtle, marginHorizontal: 24 },
})
