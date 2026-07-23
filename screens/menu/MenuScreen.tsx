import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import { getSession } from '../../service/registrationService'
import { clearSession } from '../../service/apiClient'
import { disconnectSocket } from '../../service/socketService'
import { logEvent, dispatchNativeEvent } from '../../service/analyticsService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'
const SCREEN_H = Dimensions.get('window').height

// Angular: external-page.page.ts's hardcoded urlObjs = {1: privacy, 2: terms}.
const PRIVACY_POLICY_URL   = 'https://www.jodii.com/privacy-policy.html'
const TERMS_CONDITIONS_URL = 'https://www.jodii.com/terms.html'

export const ICON = {
  back:          R + 'menu_back_arrow.svg',
  avatar:        R + 'menu_avatar.svg',
  verified:      R + 'menu_verified.svg',
  paidTag:       R + 'menu_paid_tag.svg',
  edit:          R + 'menu_edit_icon.svg',
  biodata:       R + 'menu_info_paper.svg',
  wedding:       R + 'menu_wedding_rings.svg',
  searchId:      R + 'menu_file_info.svg',
  support:       R + 'menu_support.svg',
  dontShow:      R + 'menu_profile_close.svg',
  arrow:         R + 'menu_right_arrow.svg',
  camera:        R + 'menu_camera.svg',
  language:      R + 'setting_language_selection.svg',
  deleteAccount: R + 'settings_delete_account.svg',
  privacy:       R + 'settings_privacy_ploicy.svg',
  terms:         R + 'settings_terms_condition.svg',
  logout:        R + 'settings_logout.svg',
  logoutSheet:   R + 'bottomsheet_logout.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

// ─── Logout side effects ─────────────────────────────────────────────────────
// Extracted so other entry points (e.g. HomeSidebar's desktop logout row) can
// fire the exact same sequence without duplicating it — only the confirm-sheet
// UI around it (LogoutSheet, also exported below) differs per caller.

export async function performLogout(): Promise<void> {
  // 1. Emit socket Logout event and disconnect
  disconnectSocket()
  // 2. Fire analytics events (matches Angular's pushfirebaseEvents + triggerAppNativeEvent)
  logEvent({ category: 'ManageAccount', action: 'Logout', label: 'Submitted' })
  dispatchNativeEvent({ event_name: 'logout' })
  // 3. Clear session storage and flip navigation to AuthStack
  await clearSession()
}

// ─── MenuRow ──────────────────────────────────────────────────────────────────

interface RowProps {
  icon: string
  iconSize?: number
  title: string
  onPress: () => void
  showDivider?: boolean
}

function MenuRow({ icon, iconSize = 24, title, onPress, showDivider }: RowProps) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
        <View style={s.rowIconWrap}>
          <CdnSvg uri={icon} width={iconSize} height={iconSize} />
        </View>
        <Text style={s.rowTitle}>{title}</Text>
        <CdnSvg uri={ICON.arrow} width={16} height={16} />
      </Pressable>
      {showDivider && <View style={s.rowDivider} />}
    </>
  )
}

// ─── LogoutSheet ──────────────────────────────────────────────────────────────
// Ported from the old SettingsScreen — same confirm-before-logout bottom sheet.

export function LogoutSheet({ visible, onYes, onNo }: { visible: boolean; onYes: () => void; onNo: () => void }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [modalVisible, setModalVisible] = useState(visible)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const scrimAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 11 }),
        Animated.timing(scrimAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
        Animated.timing(scrimAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setModalVisible(false) })
    }
  }, [visible, slideAnim, scrimAnim])

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onNo} statusBarTranslucent>
      {/* Scrim */}
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          backgroundColor: Colors.black,
          opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        }]}
        pointerEvents="none"
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onNo} />

      {/* Sheet */}
      <Animated.View style={[ls.sheet, { paddingBottom: insets.bottom + 20 }, { transform: [{ translateY: slideAnim }] }]}>
        {/* Icon */}
        <View style={ls.iconWrap}>
          <CdnSvg uri={ICON.logoutSheet} width={48} height={48} />
        </View>

        {/* Title — left aligned */}
        <Text style={ls.title}>{t('ACCOUNT.LOGOUT')}</Text>

        {/* Message */}
        <Text style={ls.message}>{t('ACCOUNT.LOGOUT_SHEET_MSG')}</Text>

        {/* Side-by-side: Yes (secondary) | No (primary) */}
        <View style={ls.btnRow}>
          <ButtonRevamp
            label={t('ACCOUNT.YES')}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={onYes}
          />
          <ButtonRevamp
            label={t('ACCOUNT.NO')}
            variant="primary"
            style={{ flex: 1 }}
            onPress={onNo}
          />
        </View>
      </Animated.View>
    </Modal>
  )
}

// ─── MenuScreen ───────────────────────────────────────────────────────────────

export default function MenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [userName,      setUserName]      = useState('')
  const [userId,        setUserId]        = useState('')
  const [photoUrl,      setPhotoUrl]      = useState('')
  const [entryType,     setEntryType]     = useState('')
  const [isVerified,    setIsVerified]    = useState(false)
  const [membershipExp, setMembershipExp] = useState('')
  const [appVersion,    setAppVersion]    = useState('')
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false)

  useEffect(() => {
    Promise.all([
      getSession(),
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.PHOTO_URL),
      getItem(StorageKeys.App.APP_VERSION),
      getItem(StorageKeys.Verification.EKYC_STATUS),
    ]).then(([session, id, photo, ver, ekyc]) => {
      setUserName(String(session['NAME'] ?? ''))
      setUserId(id ?? '')
      setPhotoUrl(photo ?? '')
      setEntryType(String(session['ENTRYTYPE'] ?? ''))
      setMembershipExp(String(session['PLANEXPIRY'] ?? session['VALIDTILL'] ?? ''))
      setAppVersion(ver ?? '')
      setIsVerified(ekyc === '1')
    })
  }, [])

  const isPaid = entryType !== '' && !['B', 'F'].includes(entryType)

  // Angular: menu.page.ts redirectToBioData() → /download-biodata — a
  // dedicated screen (BiodataScreen.tsx), not ViewProfileScreen's own-profile
  // mode.
  function handleDownloadBiodata() {
    navigation.navigate('Biodata')
  }

  const handleLogout = useCallback(() => {
    setLogoutSheetVisible(true)
  }, [])

  const handleConfirmLogout = useCallback(async () => {
    setLogoutSheetVisible(false)
    await performLogout()
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── Header back button ── */}
      <Pressable
        style={[s.backBtn, { marginTop: 8 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <CdnSvg uri={ICON.back} width={24} height={24} />
      </Pressable>

      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Card 1: Profile ── */}
        <View style={s.card}>
          <View style={s.profileRow}>
            {/* Avatar with camera badge */}
            <View style={s.avatarContainer}>
              <View style={s.avatarWrap}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={s.avatar} contentFit="cover" />
                ) : (
                  <CdnSvg uri={ICON.avatar} width={70} height={70} />
                )}
              </View>
              <View style={s.cameraBadge}>
                <CdnSvg uri={ICON.camera} width={13} height={13} />
              </View>
            </View>

            {/* Info */}
            <View style={s.profileInfo}>
              {/* Name + verified badge */}
              <View style={s.nameRow}>
                <Text style={s.profileName} numberOfLines={1}>{userName || '—'}</Text>
                {isVerified && (
                  <View style={{ marginLeft: 6 }}>
                    <CdnSvg uri={ICON.verified} width={16} height={16} />
                  </View>
                )}
              </View>

              {/* ID */}
              <Text style={s.profileId}>{t('MENU.ID')} {userId}</Text>

              {/* Paid tag */}
              {isPaid && (
                <View style={s.paidTagRow}>
                  <CdnSvg uri={ICON.paidTag} width={125} height={24} />
                </View>
              )}

              {/* Membership expiry */}
              {isPaid && !!membershipExp && (
                <Text style={s.expiryText}>{t('MENU.MEMBERSHIP_TILL')} {membershipExp}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Card 2: Edit Profile + Search by ID ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.edit}
            title={t('MENU.EDIT_PROFILE')}
            onPress={() => navigation.navigate('EditProfile')}
            showDivider
          />
          <MenuRow
            icon={ICON.searchId}
            title={t('MENU.SEARCH_BY_ID')}
            onPress={() => navigation.navigate('SearchById')}
          />
        </View>

        {/* ── Card 3: Download Biodata ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.biodata}
            title={t('MENU.DOWNLOAD_BIODATA')}
            onPress={handleDownloadBiodata}
          />
        </View>

        {/* ── Card 4: Main menu ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.wedding}
            title={t('MENU.SUCCESS_STORIES')}
            onPress={() => navigation.navigate('SuccessStories')}
            showDivider
          />
          <MenuRow
            icon={ICON.dontShow}
            title={t('MENU.IGNORED_PROFILES')}
            onPress={() => navigation.navigate('IgnoredProfiles')}
            showDivider
          />
          <MenuRow
            icon={ICON.support}
            title={t('MENU.CUSTOMER_SUPPORT')}
            onPress={() => navigation.navigate('HelpCenter')}
          />
        </View>

        {/* ── Card 5: Settings (merged from the old SettingsScreen) ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.language}
            title={t('MENU.TTTLE_6')}
            onPress={() => navigation.navigate('LanguageSelection')}
            showDivider
          />
          <MenuRow
            icon={ICON.deleteAccount}
            title={t('ACCOUNT.DEL_PRO')}
            onPress={() => navigation.navigate('DeleteProfile')}
            showDivider
          />
          <MenuRow
            icon={ICON.privacy}
            iconSize={18}
            title={t('ACCOUNT.PRIVACY_POLICY')}
            onPress={() => navigation.navigate('ExternalPage', { url: PRIVACY_POLICY_URL, title: t('ACCOUNT.PRIVACY_POLICY') })}
            showDivider
          />
          <MenuRow
            icon={ICON.terms}
            iconSize={18}
            title={t('ACCOUNT.TERMS_CONDITIONS')}
            onPress={() => navigation.navigate('ExternalPage', { url: TERMS_CONDITIONS_URL, title: t('ACCOUNT.TERMS_CONDITIONS') })}
            showDivider
          />
          <MenuRow
            icon={ICON.logout}
            title={t('ACCOUNT.LOGOUT')}
            onPress={handleLogout}
          />
        </View>

        {/* ── Footer ── */}
        {!!appVersion && (
          <Text style={s.footerVersion}>{t('MENU.APPVERSION_LBL')} {appVersion}</Text>
        )}

      </ScrollView>

      <LogoutSheet
        visible={logoutSheetVisible}
        onYes={handleConfirmLogout}
        onNo={() => setLogoutSheetVisible(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: '#F1F3FB',
  },
  flex1: { flex: 1 },

  // ── Back button ──
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:     16,
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop:        16,
    gap:               12,
  },

  // ── Card shell ──
  card: {
    backgroundColor: Colors.white,
    borderRadius:    12,
    overflow:        'hidden',
  },

  // ── Profile card internals ──
  profileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       16,
    gap:           12,
  },
  avatarContainer: {
    width:     70,
    height:    70,
    flexShrink: 0,
  },
  avatarWrap: {
    width:        70,
    height:       70,
    borderRadius: 35,
    overflow:     'hidden',
  },
  avatar: {
    width:        70,
    height:       70,
    borderRadius: 35,
  },
  cameraBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: Colors.white,
    borderWidth:     1.5,
    borderColor:     'rgba(204,204,204,0.5)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  profileInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  2,
  },
  profileName: {
    fontSize:   16,
    fontWeight: '700',
    color:      Colors.textPrimary,
    flexShrink: 1,
  },
  profileId: {
    fontSize:     14,
    color:        '#372F3A',
    marginBottom: 6,
  },
  paidTagRow:  { marginBottom: 4 },
  expiryText: {
    fontSize: 12,
    color:    '#888686',
    marginTop: 4,
  },

  // ── Menu rows ──
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   20,
    gap:               12,
  },
  rowPressed: { opacity: 0.6 },
  rowIconWrap: {
    width:          24,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  rowTitle: {
    flex:       1,
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  rowDivider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  'rgba(204,204,204,0.5)',
    marginHorizontal: 12,
  },

  // ── Footer ──
  footerVersion: {
    fontSize:  12,
    color:     'rgba(0,0,0,0.5)',
    marginTop: 4,
  },
})

// ─── LogoutSheet styles ───────────────────────────────────────────────────────

const ls = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:    24,
    paddingTop:           28,
    shadowColor:          '#000',
    shadowOpacity:        0.15,
    shadowRadius:         16,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            16,
  },
  iconWrap: {
    alignItems:    'flex-start',
    marginBottom:  16,
  },
  title: {
    fontSize:     18,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: 10,
  },
  message: {
    fontSize:     14,
    color:        Colors.textMedium,
    lineHeight:   22,
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: 'row',
    gap:           12,
  },
})
