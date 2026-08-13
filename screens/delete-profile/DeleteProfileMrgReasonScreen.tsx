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
import DeleteProfileMrgReasonDesktopLayout from './DeleteProfileMrgReasonDesktopLayout'
import type { FooterTab } from '../../components/app-footer/AppFooter'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back: R + 'menu_back_arrow.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }

// MRGFIXEDREASON KEYs (Angular page 2)
const MRG_KEYS = ['1', '2', '3'] as const
type MrgKey = typeof MRG_KEYS[number]

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
      <Text style={[s.cardLabel, selected && s.cardLabelSelected]} numberOfLines={2}>
        {label}
      </Text>
      <View style={s.radioOuter}>
        <View style={[s.radioRing, selected ? s.radioRingSelected : s.radioRingUnselected]}>
          {selected && <View style={s.radioDot} />}
        </View>
      </View>
    </Pressable>
  )
}

// ─── DeleteProfileMrgReasonScreen ─────────────────────────────────────────────

export default function DeleteProfileMrgReasonScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const [selectedMrgReason, setSelectedMrgReason] = useState<MrgKey>('1')
  const [deleting,          setDeleting]          = useState(false)
  const [userName,          setUserName]          = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  // Angular page 2: MRGFIXEDREASON '3' → callDeleteAPI('2') directly
  async function handleDirectDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const vals = await getMultiple([
        StorageKeys.Auth.USER_ID,
        StorageKeys.User.LOGIN_GENDER,
      ])
      const userId = vals[StorageKeys.Auth.USER_ID] ?? ''
      const gender = vals[StorageKeys.User.LOGIN_GENDER] ?? ''

      const formData = new FormData()
      formData.append('MatriId',        userId)
      formData.append('DELETEDID',      userId)
      formData.append('REASON',         t('DELETE_PROFILE.MRG_REASON_3'))
      formData.append('MRGFIXEDREASON', t('DELETE_PROFILE.MRG_REASON_3'))
      formData.append('PARTNERNAME',    '')
      formData.append('DATEFIX',        '')
      formData.append('MRGDATE',        '')
      formData.append('MRGINMONTHS',    '')
      formData.append('ADDRESS',        '')
      formData.append('WEBSITENAME',    '')
      formData.append('UPLOADIMAGE',    '')

      await uploadFile(Endpoints.media.deleteProfile, formData)

      const reason = t('DELETE_PROFILE.MRG_REASON_3')
      const params = `ID=${userId}&GENDER=${gender}&REASON=${encodeURIComponent(reason)}&TYPE=2&DELETIONTYPE=2`
      const res    = await apiCall(Endpoints.auth.deleteProfile, 'POST', params)

      if (String(res['RESPONSECODE']) === '1' && String(res['ERRCODE']) === '0') {
        const msg = res['RESPONSE']?.['MSG'] ?? {}
        navigation.navigate('DeleteProfileSuccess', {
          successMsgImage: msg['SUCCESS_MSG_IMAGE'] ?? '',
          successMsg:      msg['SUCCESS_MSG']       ?? 'Your profile has been successfully deleted',
        })
      } else {
        const errMsg = res['RESPONSE']?.['MSG']
        Alert.alert('Error', typeof errMsg === 'string' ? errMsg : 'Something went wrong. Please try again.')
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  function handleNext() {
    // Angular landingDetails.MRGFIXEDREASON maps:
    //   '1' (Found on Jodii)           → page 3 (partner name + marriage date)
    //   '2' (Found on another website) → page 10 (enter website/app name)
    //   '3' (Found from other sources) → callDeleteAPI('2') — directly deletes profile
    if (selectedMrgReason === '1') {
      navigation.navigate('DeleteProfileShareDetails', {
        reason:        route.params?.reason ?? '1',
        mrgReason:     '1',
        reasonName:    route.params?.reasonName    ?? '',
        mrgReasonName: t('DELETE_PROFILE.MRG_REASON_1'),
      })
    } else if (selectedMrgReason === '2') {
      navigation.navigate('DeleteProfileWebsiteName', {
        mrgReasonName: t('DELETE_PROFILE.MRG_REASON_2'),
      })
    } else {
      // option '3': directly call delete API (TYPE=2)
      handleDirectDelete()
    }
  }

  const options: { key: MrgKey; label: string }[] = MRG_KEYS.map(k => ({
    key:   k,
    label: t(`DELETE_PROFILE.MRG_REASON_${k}`),
  }))

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: openMembershipTab(); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  if (isDesktop) {
    return (
      <DeleteProfileMrgReasonDesktopLayout
        navigation={navigation}
        userName={userName}
        onTabPress={handleTabPress}
        options={options}
        selectedOption={selectedMrgReason}
        onSelectOption={key => setSelectedMrgReason(key as MrgKey)}
        isDeleting={deleting}
        onNext={handleNext}
        nextLabel={selectedMrgReason === '3' ? t('DELETE_PROFILE.DELETE_CTA') : t('DELETE_PROFILE.NEXT_CTA')}
      />
    )
  }

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
        <Text style={s.headerTitle}>{t('DELETE_PROFILE.HEADER')}</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Congratulations! */}
        <Text style={s.congratsTitle}>{t('DELETE_PROFILE.CONGRAT_HEADER')}</Text>

        {/* Sub-text */}
        <Text style={s.congratsSub}>{t('DELETE_PROFILE.CONGRAT_CONTENT')}</Text>

        {/* "How did you find your partner?" */}
        <Text style={s.sectionTitle}>{t('DELETE_PROFILE.CONGRAT_SUB_HEADER')}</Text>

        {/* Radio cards */}
        <View style={s.radioList}>
          {options.map(({ key, label }) => (
            <RadioCard
              key={key}
              label={label}
              selected={selectedMrgReason === key}
              onPress={() => setSelectedMrgReason(key)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Next / Delete CTA — fixed at bottom */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {deleting ? (
          <View style={s.loadingBtn}>
            <ActivityIndicator color={Colors.white} size="small" />
          </View>
        ) : (
          <ButtonRevamp
            label={selectedMrgReason === '3' ? t('DELETE_PROFILE.DELETE_CTA') : t('DELETE_PROFILE.NEXT_CTA')}
            variant="primary"
            fullWidth
            onPress={handleNext}
          />
        )}
      </View>

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = '#b50033'

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

  congratsTitle: {
    fontSize:   24,
    fontWeight: '600',
    color:      '#000000',
  },
  congratsSub: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
    marginTop:  8,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize:   18,
    fontWeight: '600',
    color:      '#000000',
    marginTop:  24,
  },

  // ── Radio list ──
  radioList: {
    marginTop: 16,
    gap:       12,
  },

  // ── Radio cards ──
  card: {
    minHeight:      64,
    borderRadius:   8,
    borderWidth:    1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingLeft:    16,
    paddingRight:   4,
    paddingVertical: 12,
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
    lineHeight: 20,
  },
  cardLabelSelected: {
    fontWeight: '500',
  },

  // ── Radio button ──
  radioOuter: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
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
})
