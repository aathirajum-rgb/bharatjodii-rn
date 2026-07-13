import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Linking,
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
import CdnSvg from '../../components/cdn-svg/CdnSvg'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back:         R + 'menu_back_arrow.svg',
  avatar:       R + 'menu_avatar.svg',
  verified:     R + 'menu_verified.svg',
  paidTag:      R + 'menu_paid_tag.svg',
  edit:         R + 'menu_edit_icon.svg',
  biodata:      R + 'menu_info_paper.svg',
  wedding:      R + 'menu_wedding_rings.svg',
  searchId:     R + 'menu_file_info.svg',
  account:      R + 'menu_account_settings.svg',
  support:      R + 'menu_support.svg',
  dontShow:     R + 'menu_profile_close.svg',
  arrow:        R + 'menu_right_arrow.svg',
  camera:       R + 'menu_camera.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

// ─── MenuRow ──────────────────────────────────────────────────────────────────

interface RowProps {
  icon: string
  title: string
  onPress: () => void
  showDivider?: boolean
}

function MenuRow({ icon, title, onPress, showDivider }: RowProps) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
        <View style={s.rowIconWrap}>
          <CdnSvg uri={icon} width={24} height={24} />
        </View>
        <Text style={s.rowTitle}>{title}</Text>
        <CdnSvg uri={ICON.arrow} width={16} height={16} />
      </Pressable>
      {showDivider && <View style={s.rowDivider} />}
    </>
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
  const [customerCare,  setCustomerCare]  = useState('')

  useEffect(() => {
    Promise.all([
      getSession(),
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.PHOTO_URL),
      getItem(StorageKeys.App.APP_VERSION),
      getItem(StorageKeys.App.CUSTOMER_CARE),
      getItem(StorageKeys.Verification.EKYC_STATUS),
    ]).then(([session, id, photo, ver, cc, ekyc]) => {
      setUserName(String(session['NAME'] ?? ''))
      setUserId(id ?? '')
      setPhotoUrl(photo ?? '')
      setEntryType(String(session['ENTRYTYPE'] ?? ''))
      setMembershipExp(String(session['PLANEXPIRY'] ?? session['VALIDTILL'] ?? ''))
      setAppVersion(ver ?? '')
      setCustomerCare(cc ?? '')
      setIsVerified(ekyc === '1')
    })
  }, [])

  const isPaid = entryType !== '' && !['B', 'F'].includes(entryType)

  function stub(label: string) {
    Alert.alert(label, 'Coming soon')
  }

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
            onPress={() => stub('Edit Profile')}
            showDivider
          />
          <MenuRow
            icon={ICON.searchId}
            title={t('MENU.SEARCH_BY_ID')}
            onPress={() => stub('Search by ID')}
          />
        </View>

        {/* ── Card 3: Download Biodata ── */}
        <View style={s.card}>
          <MenuRow
            icon={ICON.biodata}
            title={t('MENU.DOWNLOAD_BIODATA')}
            onPress={() => stub('Download Biodata')}
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
            onPress={() => stub('Ignored Profiles')}
            showDivider
          />
          <MenuRow
            icon={ICON.account}
            title={t('MENU.SETTINGS')}
            onPress={() => navigation.navigate('Settings')}
            showDivider
          />
          <MenuRow
            icon={ICON.support}
            title={t('MENU.CUSTOMER_SUPPORT')}
            onPress={() => {
              if (customerCare) Linking.openURL(`tel:${customerCare}`)
              else stub('Customer Support')
            }}
          />
        </View>

        {/* ── Footer ── */}
        {!!appVersion && (
          <Text style={s.footerVersion}>{t('MENU.APPVERSION_LBL')} {appVersion}</Text>
        )}

      </ScrollView>
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
