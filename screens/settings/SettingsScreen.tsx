import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { clearSession } from '../../service/apiClient'
import { disconnectSocket } from '../../service/socketService'
import { logEvent, dispatchNativeEvent } from '../../service/analyticsService'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R        = CDN_REACT + '/'
const SCREEN_H = Dimensions.get('window').height

const ICON = {
  back:          R + 'menu_back_arrow.svg',
  language:      R + 'setting_language_selection.svg',
  deleteAccount: R + 'settings_delete_account.svg',
  privacy:       R + 'settings_privacy_ploicy.svg',
  terms:         R + 'settings_terms_condition.svg',
  logout:        R + 'settings_logout.svg',
  logoutSheet:   R + 'bottomsheet_logout.svg',
  arrow:         R + 'menu_right_arrow.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

interface RowProps {
  icon:         string
  iconSize?:    number
  title:        string
  onPress:      () => void
  showDivider?: boolean
}

// ─── SettingsRow ──────────────────────────────────────────────────────────────

function SettingsRow({ icon, iconSize = 24, title, onPress, showDivider = true }: RowProps) {
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
      {showDivider && <View style={s.divider} />}
    </>
  )
}

// ─── LogoutSheet ──────────────────────────────────────────────────────────────

function LogoutSheet({ visible, onYes, onNo }: { visible: boolean; onYes: () => void; onNo: () => void }) {
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

// ─── SettingsScreen ───────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false)

  const handleLogout = useCallback(() => {
    setLogoutSheetVisible(true)
  }, [])

  const handleConfirmLogout = useCallback(async () => {
    setLogoutSheetVisible(false)
    // 1. Emit socket Logout event and disconnect
    disconnectSocket()
    // 2. Fire analytics events (matches Angular's pushfirebaseEvents + triggerAppNativeEvent)
    logEvent({ category: 'ManageAccount', action: 'Logout', label: 'Submitted' })
    dispatchNativeEvent({ event_name: 'logout' })
    // 3. Clear session storage and flip navigation to AuthStack
    await clearSession()
  }, [])

  function stub(label: string) {
    Alert.alert(label, 'Coming soon')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>{t('ACCOUNT.Settings')}</Text>
      </View>

      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsRow
          icon={ICON.language}
          title={t('MENU.TTTLE_6')}
          onPress={() => navigation.navigate('LanguageSelection')}
        />
        <SettingsRow
          icon={ICON.deleteAccount}
          title={t('ACCOUNT.DEL_PRO')}
          onPress={() => navigation.navigate('DeleteProfile')}
        />
        <SettingsRow
          icon={ICON.privacy}
          iconSize={18}
          title={t('ACCOUNT.PRIVACY_POLICY')}
          onPress={() => stub('Privacy Policy')}
        />
        <SettingsRow
          icon={ICON.terms}
          iconSize={18}
          title={t('ACCOUNT.TERMS_CONDITIONS')}
          onPress={() => stub('Terms & Conditions')}
        />
        <SettingsRow
          icon={ICON.logout}
          title={t('ACCOUNT.LOGOUT')}
          onPress={handleLogout}
        />
      </ScrollView>

      <LogoutSheet
        visible={logoutSheetVisible}
        onYes={handleConfirmLogout}
        onNo={() => setLogoutSheetVisible(false)}
      />

    </View>
  )
}

// ─── Screen styles ────────────────────────────────────────────────────────────

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
    shadowOffset:    { width: 0, height: 4 },
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
    fontSize:   16,
    fontWeight: '500',
    color:      '#333333',
    marginLeft: 6,
  },

  // ── Content ──
  content: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },

  // ── Rows ──
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 20,
    gap:             12,
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
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(204,204,204,0.5)',
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
