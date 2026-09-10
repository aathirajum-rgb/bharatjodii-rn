import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { StorageKeys } from '../../constants/storage.keys'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { getItem, getMultiple } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { handleFooterTabPress } from '../../utils/footerTabPress'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import DeleteProfileUnsatisfactoryDesktopLayout from './DeleteProfileUnsatisfactoryDesktopLayout'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { handleBack } from '../../utils/navigationRef'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back:  R + 'menu_back_arrow.svg',
  phone: R + 'call_icon.svg',
}

// ─── Fallback list if REGISTRATIONARRAYS not loaded ───────────────────────────

const FALLBACK_OPTIONS = [
  { KEY: '1', VALUE: 'Matches related issues\n(less / no matches)' },
  { KEY: '2', VALUE: 'Payment related issues' },
  { KEY: '3', VALUE: 'Privacy issues' },
  { KEY: '4', VALUE: 'Other reasons' },
]

const OTHER_KEY = '4'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }
type Option = { KEY: string; VALUE: string; checked?: boolean }

// ─── CheckboxCard ─────────────────────────────────────────────────────────────

interface CheckboxCardProps {
  label:    string
  checked:  boolean
  onPress:  () => void
}

function CheckboxCard({ label, checked, onPress }: CheckboxCardProps) {
  return (
    <Pressable
      style={[s.card, checked ? s.cardSelected : s.cardUnselected]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Text style={[s.cardLabel, checked && s.cardLabelSelected]}>{label}</Text>
      <View style={[s.checkbox, checked ? s.checkboxSelected : s.checkboxUnselected]}>
        {checked && <Text style={s.checkmark}>✓</Text>}
      </View>
    </Pressable>
  )
}

// ─── DeleteProfileUnsatisfactoryScreen ────────────────────────────────────────

export default function DeleteProfileUnsatisfactoryScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const { reasonName = '' } = route.params ?? {}

  const [options,      setOptions]      = useState<Option[]>([])
  const [concernText,  setConcernText]  = useState('')
  const [customerCare, setCustomerCare] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [userName,     setUserName]     = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  const isOtherSelected = options.some(o => o.KEY === OTHER_KEY && o.checked)

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    getItem('REGISTRATIONARRAYS').then(raw => {
      try {
        const arrays = raw ? JSON.parse(raw) : {}
        const page5  = arrays?.DELETEPROFILE?.PAGE5
        setOptions((Array.isArray(page5) && page5.length > 0 ? page5 : FALLBACK_OPTIONS)
          .map((o: Option) => ({ ...o, checked: false })))
      } catch {
        setOptions(FALLBACK_OPTIONS.map(o => ({ ...o, checked: false })))
      }
    })

    getItem(StorageKeys.App.CUSTOMER_CARE).then(cc => {
      if (cc) setCustomerCare(cc)
    })
  }, [])

  // ── Toggle checkbox ───────────────────────────────────────────────────────

  function toggleOption(key: string) {
    setOptions(prev => prev.map(o =>
      o.KEY === key ? { ...o, checked: !o.checked } : o
    ))
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const anyChecked = options.some(o => o.checked)

  const canSubmit = (() => {
    if (!anyChecked) return false
    if (isOtherSelected) return concernText.trim().length > 0
    return true
  })()

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)

    try {
      const vals = await getMultiple([
        StorageKeys.Auth.USER_ID,
        StorageKeys.User.LOGIN_GENDER,
      ])
      const userId = vals[StorageKeys.Auth.USER_ID] ?? ''
      const gender = vals[StorageKeys.User.LOGIN_GENDER] ?? ''

      const selectedNames = options.filter(o => o.checked).map(o => o.VALUE).join(', ')

      const formData = new FormData()
      formData.append('MatriId',              userId)
      formData.append('DELETEDID',            userId)
      formData.append('REASON',               reasonName)
      formData.append('MRGFIXEDREASON',       '')
      formData.append('PARTNERNAME',          '')
      formData.append('DATEFIX',              '')
      formData.append('MRGDATE',              '')
      formData.append('MRGINMONTHS',          '')
      formData.append('ADDRESS',              '')
      formData.append('WEBSITENAME',          '')
      formData.append('UPLOADIMAGE',          '')
      formData.append('OTHERREASONTXT',       concernText.trim())
      formData.append('UNSATISFACTORYREASON', selectedNames)
      formData.append('UNSATISFACTORYTXT',    concernText.trim())
      formData.append('UNSATISFACTORYAUDIO',  '')

      await uploadFile(Endpoints.media.deleteProfile, formData)

      const params = `ID=${userId}&GENDER=${gender}&REASON=${encodeURIComponent(reasonName)}&TYPE=2&DELETIONTYPE=2`
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
      setSubmitting(false)
    }
  }

  const handleTabPress = (tab: FooterTab) => handleFooterTabPress(navigation, tab)

  // ── Render ────────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <DeleteProfileUnsatisfactoryDesktopLayout
        navigation={navigation}
        userName={userName}
        onTabPress={handleTabPress}
        options={options}
        onToggleOption={toggleOption}
        isOtherSelected={isOtherSelected}
        concernText={concernText}
        onChangeConcernText={setConcernText}
        customerCare={customerCare}
        canSubmit={canSubmit}
        submitting={submitting}
        onSubmit={handleSubmit}
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

      {/* Scrollable content */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question title */}
        <Text style={s.title}>{t('DELETE_PROFILE.UNSATISFACTION_HEADER')}</Text>

        {/* Checkbox list */}
        <View style={s.optionList}>
          {options.map(opt => (
            <CheckboxCard
              key={opt.KEY}
              label={opt.VALUE}
              checked={!!opt.checked}
              onPress={() => toggleOption(opt.KEY)}
            />
          ))}
        </View>

        {/* "Other reasons" text area — shown when KEY='4' is checked */}
        {isOtherSelected && (
          <View style={s.concernSection}>
            <Text style={s.concernTitle}>{t('DELETE_PROFILE.CONCERN_TITLE')}</Text>

            <TextInput
              style={s.concernInput}
              value={concernText}
              onChangeText={setConcernText}
              placeholder={t('DELETE_PROFILE.TYPE_CONCERN')}
              placeholderTextColor="#b0b0b0"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        )}

        {/* Customer support section */}
        {!!customerCare && (
          <View style={s.supportSection}>
            <Text style={s.supportText}>{t('DELETE_PROFILE.CONTACT_SUPPORT_MSG')}</Text>
            <Pressable
              style={s.phoneRow}
              onPress={() => Linking.openURL(`tel:${customerCare}`)}
              accessibilityRole="link"
            >
              <CdnSvg uri={ICON.phone} width={16} height={16} />
              <Text style={s.phoneText}>{customerCare}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Footer: Submit */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {submitting ? (
          <View style={s.loadingBtn}>
            <ActivityIndicator color={Colors.white} size="small" />
          </View>
        ) : (
          <ButtonRevamp
            label={t('DELETE_PROFILE.SUBMIT_CTA')}
            variant="primary"
            fullWidth
            disabled={!canSubmit}
            onPress={handleSubmit}
          />
        )}
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

  // ── Scroll ──
  scroll: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },

  // ── Title ──
  title: {
    fontSize:     18,
    fontWeight:   '600',
    color:        '#000000',
    marginBottom: 20,
  },

  // ── Option list ──
  optionList: {
    gap: 12,
  },

  // ── Checkbox card ──
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
    borderColor:     '#e6e6e6',
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
  checkbox: {
    width:          24,
    height:         24,
    borderRadius:   4,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    10,
  },
  checkboxUnselected: {
    borderColor:     '#8a8a8a',
    backgroundColor: Colors.white,
  },
  checkboxSelected: {
    borderColor:     PRIMARY,
    backgroundColor: PRIMARY,
  },
  checkmark: {
    fontSize:   13,
    fontWeight: '700',
    color:      Colors.white,
    lineHeight: 16,
  },

  // ── Concern section ──
  concernSection: {
    marginTop: 28,
  },
  concernTitle: {
    fontSize:     18,
    fontWeight:   '600',
    color:        '#000000',
    marginBottom: 12,
  },
  concernInput: {
    height:            140,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       '#e6e6e6',
    paddingHorizontal: 16,
    paddingVertical:   12,
    fontSize:          14,
    fontWeight:        '400',
    color:             '#000000',
    backgroundColor:   Colors.white,
  },

  // ── Customer support ──
  supportSection: {
    marginTop:  32,
    alignItems: 'center',
    gap:        12,
  },
  supportText: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
    textAlign:  'center',
    lineHeight: 20,
  },
  phoneRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    paddingVertical: 8,
  },
  phoneText: {
    fontSize:          12,
    fontWeight:        '500',
    color:             Colors.link,
    textDecorationLine:'underline',
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
