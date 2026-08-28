import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem, getMultiple } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { openMembershipTab } from '../../service/paymentService'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import DeleteProfileHideDesktopLayout from './DeleteProfileHideDesktopLayout'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { handleBack } from '../../utils/navigationRef'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = { back: R + 'menu_back_arrow.svg' }

// ─── Fallback options if REGISTRATIONARRAYS not loaded ────────────────────────

const FALLBACK_OPTIONS = [
  { KEY: '1', VALUE: '15 days' },
  { KEY: '2', VALUE: '1 month' },
  { KEY: '3', VALUE: '3 months' },
  { KEY: '4', VALUE: '6 months' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }
type HideOption = { KEY: string; VALUE: string }

// ─── RadioCard ────────────────────────────────────────────────────────────────

interface RadioCardProps {
  label:    string
  selected: boolean
  onPress:  () => void
}

function RadioCard({ label, selected, onPress }: RadioCardProps) {
  return (
    <Pressable
      style={[s.card, selected ? s.cardSelected : s.cardUnselected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[s.cardLabel, selected && s.cardLabelSelected]}>{label}</Text>
      <View style={s.radioOuter}>
        <View style={[s.radioRing, selected ? s.radioRingSelected : s.radioRingUnselected]}>
          {selected && <View style={s.radioDot} />}
        </View>
      </View>
    </Pressable>
  )
}

// ─── DeleteProfileHideScreen ──────────────────────────────────────────────────

export default function DeleteProfileHideScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const { reasonName = '' } = route.params ?? {}

  const [options,       setOptions]       = useState<HideOption[]>([])
  const [selectedKey,   setSelectedKey]   = useState('')
  const [hidingProfile, setHidingProfile] = useState(false)
  const [deletingDirect,setDeletingDirect]= useState(false)
  const [userName,      setUserName]      = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  // Load HIDDENDAYS options from cached registration arrays
  useEffect(() => {
    getItem('REGISTRATIONARRAYS').then(raw => {
      try {
        const arrays  = raw ? JSON.parse(raw) : {}
        const page4   = arrays?.DELETEPROFILE?.PAGE4
        setOptions(Array.isArray(page4) && page4.length > 0 ? page4 : FALLBACK_OPTIONS)
      } catch {
        setOptions(FALLBACK_OPTIONS)
      }
    })
  }, [])

  // ── API helpers ───────────────────────────────────────────────────────────

  async function callUpload() {
    const vals = await getMultiple([
      StorageKeys.Auth.USER_ID,
      StorageKeys.User.LOGIN_GENDER,
    ])
    const userId = vals[StorageKeys.Auth.USER_ID] ?? ''
    const gender = vals[StorageKeys.User.LOGIN_GENDER] ?? ''

    const formData = new FormData()
    formData.append('MatriId',        userId)
    formData.append('DELETEDID',      userId)
    formData.append('REASON',         reasonName || t('DELETE_PROFILE.REASON_3'))
    formData.append('MRGFIXEDREASON', '')
    formData.append('PARTNERNAME',    '')
    formData.append('DATEFIX',        '')
    formData.append('MRGDATE',        '')
    formData.append('MRGINMONTHS',    '')
    formData.append('ADDRESS',        '')
    formData.append('HIDDENDAYS',     selectedKey)
    formData.append('UPLOADIMAGE',    '')

    await uploadFile(Endpoints.media.deleteProfile, formData)
    return { userId, gender }
  }

  // "Hide my profile" → TYPE=6, DELETIONTYPE=3, BREAK=selectedKey
  async function handleHideProfile() {
    if (hidingProfile || !selectedKey) return
    setHidingProfile(true)
    try {
      const { userId, gender } = await callUpload()
      const reason = reasonName || t('DELETE_PROFILE.REASON_3')
      const params = `ID=${userId}&GENDER=${gender}&REASON=${encodeURIComponent(reason)}&TYPE=6&DELETIONTYPE=3&BREAK=${selectedKey}&REPORTEDID=${userId}`
      const res    = await apiCall(Endpoints.auth.deleteProfile, 'POST', params)

      if (String(res['RESPONSECODE']) === '1' && String(res['ERRCODE']) === '0') {
        const msg = res['RESPONSE']?.['MSG'] ?? {}
        navigation.navigate('DeleteProfileSuccess', {
          successMsg: msg['SUCCESS_MSG'] ?? 'Your profile has been hidden.',
        })
      } else {
        const errMsg = res['RESPONSE']?.['MSG']
        Alert.alert('Error', typeof errMsg === 'string' ? errMsg : 'Something went wrong. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setHidingProfile(false)
    }
  }

  // "tap here" — direct delete, TYPE=2
  async function handleDirectDelete() {
    if (deletingDirect) return
    setDeletingDirect(true)
    try {
      const { userId, gender } = await callUpload()
      const reason = reasonName || t('DELETE_PROFILE.REASON_3')
      const params = `ID=${userId}&GENDER=${gender}&REASON=${encodeURIComponent(reason)}&TYPE=2&DELETIONTYPE=2`
      const res    = await apiCall(Endpoints.auth.deleteProfile, 'POST', params)

      if (String(res['RESPONSECODE']) === '1' && String(res['ERRCODE']) === '0') {
        const msg = res['RESPONSE']?.['MSG'] ?? {}
        navigation.navigate('DeleteProfileSuccess', {
          successMsg: msg['SUCCESS_MSG'] ?? 'Your profile has been successfully deleted',
        })
      } else {
        const errMsg = res['RESPONSE']?.['MSG']
        Alert.alert('Error', typeof errMsg === 'string' ? errMsg : 'Something went wrong. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setDeletingDirect(false)
    }
  }

  const isLoading = hidingProfile || deletingDirect

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <DeleteProfileHideDesktopLayout
        navigation={navigation}
        userName={userName}
        onTabPress={handleTabPress}
        options={options}
        selectedKey={selectedKey}
        onSelectKey={setSelectedKey}
        hidingProfile={hidingProfile}
        deletingDirect={deletingDirect}
        onHideProfile={handleHideProfile}
        onDirectDelete={handleDirectDelete}
      />
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => handleBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>{t('DELETE_PROFILE.HEADER')}</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionTitle}>{t('DELETE_PROFILE.HIDE_CONTENT')}</Text>

        {/* Duration options */}
        <View style={s.radioList}>
          {options.map(opt => (
            <RadioCard
              key={opt.KEY}
              label={opt.VALUE}
              selected={selectedKey === opt.KEY}
              onPress={() => setSelectedKey(opt.KEY)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {/* "Hide my profile" primary CTA */}
        {hidingProfile ? (
          <View style={s.loadingBtn}>
            <ActivityIndicator color={Colors.white} size="small" />
          </View>
        ) : (
          <ButtonRevamp
            label={t('DELETE_PROFILE.NEXT_CTA')}
            variant="primary"
            fullWidth
            disabled={!selectedKey || isLoading}
            onPress={handleHideProfile}
          />
        )}

        {/* "If you still wish to delete, tap here" */}
        <Pressable
          style={s.deleteLink}
          onPress={handleDirectDelete}
          disabled={isLoading}
          accessibilityRole="button"
        >
          {deletingDirect ? (
            <ActivityIndicator color={PRIMARY} size="small" />
          ) : (
            <Text style={s.deleteLinkText}>
              {t('DELETE_PROFILE.HIDE_CTA1')}
              <Text style={s.deleteLinkUnderline}>{t('DELETE_PROFILE.HIDE_CTA2')}</Text>
            </Text>
          )}
        </Pressable>
      </View>

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = '#b50033'

const s = StyleSheet.create({
  flex1: { flex: 1 },
  screen: {
    flex:            1,
    backgroundColor: Colors.white,
  },

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
    flex:       1,
    fontSize:   16,
    fontWeight: '500',
    color:      '#333333',
    marginLeft: 6,
  },

  // ── Content ──
  scroll: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },
  sectionTitle: {
    fontSize:     18,
    fontWeight:   '600',
    color:        '#000000',
    marginBottom: 16,
  },

  // ── Radio list ──
  radioList: {
    gap: 12,
  },

  // ── Radio cards ──
  card: {
    height:         64,
    borderRadius:   8,
    borderWidth:    1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingLeft:    16,
    paddingRight:   4,
    gap:            16,
  },
  cardUnselected: {
    borderColor:     '#b0b0b0',
    backgroundColor: Colors.white,
  },
  cardSelected: {
    borderColor:     PRIMARY,
    backgroundColor: 'rgba(181,0,51,0.02)',
  },
  cardLabel: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
  },
  cardLabelSelected: {
    fontWeight: '500',
  },
  radioOuter: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  radioRing: {
    width:          24,
    height:         24,
    borderRadius:   12,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
  },
  radioRingUnselected: {
    borderColor: '#8a8a8a',
  },
  radioRingSelected: {
    borderColor: PRIMARY,
  },
  radioDot: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: PRIMARY,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    backgroundColor:   Colors.white,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: -2 },
    shadowOpacity:     0.04,
    shadowRadius:      4,
    elevation:         4,
  },
  loadingBtn: {
    height:          44,
    borderRadius:    8,
    backgroundColor: PRIMARY,
    alignItems:      'center',
    justifyContent:  'center',
  },
  deleteLink: {
    marginTop:      16,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  deleteLinkText: {
    fontSize:   12,
    fontWeight: '400',
    color:      '#000000',
    textAlign:  'center',
  },
  deleteLinkUnderline: {
    fontSize:   12,
    fontWeight: '500',
    color:      Colors.link,
  },
})
