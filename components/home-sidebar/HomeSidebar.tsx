// Desktop Home left sidebar (Figma "Jodii Desktop - Registration", node
// 161:10324) — profile summary card + the SAME menu list as mobile's
// MenuScreen.tsx (same rows, same order, same icons, same nav targets/i18n
// keys), just laid out as a compact sidebar instead of a full-screen scroll
// of cards. Per explicit instruction, this does NOT follow Figma's own
// (different/curated) row set — it mirrors MenuScreen.tsx exactly.
//
// Logout reuses MenuScreen.tsx's own exported LogoutSheet + performLogout —
// same confirm-before-logout bottom sheet and side effects, not a re-implementation.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image } from 'expo-image'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { paymentTrack } from '../../service/paymentService'
import { ICON, LogoutSheet, performLogout } from '../../screens/menu/MenuScreen'

// Angular: external-page.page.ts's hardcoded urlObjs = {1: privacy, 2: terms}.
const PRIVACY_POLICY_URL   = 'https://www.jodii.com/privacy-policy.html'
const TERMS_CONDITIONS_URL = 'https://www.jodii.com/terms.html'

// Matches the row a given sidebar destination screen should highlight
// (Figma's pink active-row state on Search-by-ID / Edit-profile screens).
export type SidebarItem =
  | 'editProfile' | 'searchById' | 'biodata' | 'successStories' | 'ignoredProfiles'
  | 'customerSupport' | 'language' | 'deleteProfile' | 'privacyPolicy' | 'terms'

export interface HomeSidebarProps {
  navigation:  any
  userName:    string
  userId:      string
  photoUrl?:   string | undefined
  activeItem?: SidebarItem | undefined
}

function SidebarRow({ icon, iconSize = 20, title, active = false, onPress }: { icon: string; iconSize?: number; title: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.row, active && s.rowActive, pressed && s.rowPressed]} onPress={onPress} accessibilityRole="button">
      <View style={s.rowIconWrap}>
        <CdnSvg uri={icon} width={iconSize} height={iconSize} />
      </View>
      <Text style={[s.rowTitle, active && s.rowTitleActive]} numberOfLines={1}>{title}</Text>
      <CdnSvg uri={ICON.arrow} width={14} height={14} />
    </Pressable>
  )
}

export default function HomeSidebar({ navigation, userName, userId, photoUrl, activeItem }: HomeSidebarProps) {
  const { t } = useTranslation()
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false)

  async function handleConfirmLogout() {
    setLogoutSheetVisible(false)
    await performLogout()
  }

  return (
    <View style={s.container}>
      {/* ── Profile summary ── */}
      <View style={s.avatarWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={s.avatar} contentFit="cover" />
        ) : (
          <CdnSvg uri={ICON.avatar} width={80} height={80} />
        )}
      </View>
      <Text style={s.name} numberOfLines={1}>{userName}</Text>
      <Text style={s.id}>{t('MENU.ID')} {userId}</Text>

      {/* ── Membership promo (Figma: "Flat ₹300 OFF on Jodii membership") ── */}
      <View style={s.promoCard}>
        <View>
          <Text style={s.promoTitle}>{t('MENU.FLAT_OFF', 'Flat ₹300 OFF')}</Text>
          <Text style={s.promoSubtitle}>{t('MENU.ON_MEMBERSHIP', 'on Jodii membership')}</Text>
        </View>
        <Pressable
          style={s.promoBtn}
          onPress={() => { paymentTrack('31'); navigation.navigate('recharge') }}
        >
          <Text style={s.promoBtnText}>{t('MENU.PAY_NOW', 'Pay now')}</Text>
        </Pressable>
      </View>

      {/* ── Card 2: Edit Profile + Search by ID ── */}
      <View style={s.card}>
        <SidebarRow icon={ICON.edit} title={t('MENU.EDIT_PROFILE')} active={activeItem === 'editProfile'} onPress={() => navigation.navigate('EditProfile')} />
        <View style={s.rowDivider} />
        <SidebarRow icon={ICON.searchId} title={t('MENU.SEARCH_BY_ID')} active={activeItem === 'searchById'} onPress={() => navigation.navigate('SearchById')} />
      </View>

      {/* ── Card 3: Download Biodata ── */}
      <View style={s.card}>
        <SidebarRow icon={ICON.biodata} title={t('MENU.DOWNLOAD_BIODATA')} active={activeItem === 'biodata'} onPress={() => navigation.navigate('Biodata')} />
      </View>

      {/* ── Card 4: Main menu ── */}
      <View style={s.card}>
        <SidebarRow icon={ICON.wedding} title={t('MENU.SUCCESS_STORIES')} active={activeItem === 'successStories'} onPress={() => navigation.navigate('SuccessStories')} />
        <View style={s.rowDivider} />
        <SidebarRow icon={ICON.dontShow} title={t('MENU.IGNORED_PROFILES')} active={activeItem === 'ignoredProfiles'} onPress={() => navigation.navigate('IgnoredProfiles')} />
        <View style={s.rowDivider} />
        <SidebarRow icon={ICON.support} title={t('MENU.CUSTOMER_SUPPORT')} active={activeItem === 'customerSupport'} onPress={() => navigation.navigate('HelpCenter')} />
      </View>

      {/* ── Card 5: Settings (merged from the old SettingsScreen) ── */}
      <View style={s.card}>
        <SidebarRow icon={ICON.language} title={t('MENU.TTTLE_6')} active={activeItem === 'language'} onPress={() => navigation.navigate('LanguageSelection')} />
        <View style={s.rowDivider} />
        <SidebarRow icon={ICON.deleteAccount} title={t('ACCOUNT.DEL_PRO')} active={activeItem === 'deleteProfile'} onPress={() => navigation.navigate('DeleteProfile')} />
        <View style={s.rowDivider} />
        <SidebarRow
          icon={ICON.privacy} iconSize={16} title={t('ACCOUNT.PRIVACY_POLICY')} active={activeItem === 'privacyPolicy'}
          onPress={() => navigation.navigate('ExternalPage', { url: PRIVACY_POLICY_URL, title: t('ACCOUNT.PRIVACY_POLICY') })}
        />
        <View style={s.rowDivider} />
        <SidebarRow
          icon={ICON.terms} iconSize={16} title={t('ACCOUNT.TERMS_CONDITIONS')} active={activeItem === 'terms'}
          onPress={() => navigation.navigate('ExternalPage', { url: TERMS_CONDITIONS_URL, title: t('ACCOUNT.TERMS_CONDITIONS') })}
        />
        <View style={s.rowDivider} />
        <SidebarRow icon={ICON.logout} title={t('ACCOUNT.LOGOUT')} onPress={() => setLogoutSheetVisible(true)} />
      </View>

      <LogoutSheet
        visible={logoutSheetVisible}
        onYes={handleConfirmLogout}
        onNo={() => setLogoutSheetVisible(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { width: 254 },

  avatarWrap: {
    width: 80, height: 80, borderRadius: 40, overflow: 'hidden', alignSelf: 'center',
    backgroundColor: Colors.surfaceInput,
  },
  avatar: { width: 80, height: 80 },

  name: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: Colors.textDark, textAlign: 'center', marginTop: 12 },
  id:   { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: 20 },

  promoCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EAF7EE', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  promoTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: Colors.textDark },
  promoSubtitle: { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  promoBtn: { backgroundColor: Colors.discountGreen, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  promoBtnText: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: Colors.white },

  card: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle,
    marginBottom: 16, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 10,
  },
  rowPressed: { backgroundColor: Colors.surfaceInput },
  rowActive: { backgroundColor: Colors.selectionBg },
  rowIconWrap: { width: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTitle: { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textDark },
  rowTitleActive: { fontFamily: 'Poppins-Medium', color: Colors.primary },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderSubtle, marginHorizontal: 12 },
})
