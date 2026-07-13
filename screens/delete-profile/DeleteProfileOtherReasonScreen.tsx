import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { getMultiple } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'
const ICON = { back: R + 'menu_back_arrow.svg' }

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }

// ─── DeleteProfileOtherReasonScreen ──────────────────────────────────────────

export default function DeleteProfileOtherReasonScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()

  const { reasonName = '' } = route.params ?? {}

  const [otherText,  setOtherText]  = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
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
      formData.append('REASON',         reasonName)
      formData.append('MRGFIXEDREASON', '')
      formData.append('PARTNERNAME',    '')
      formData.append('DATEFIX',        '')
      formData.append('MRGDATE',        '')
      formData.append('MRGINMONTHS',    '')
      formData.append('ADDRESS',        '')
      formData.append('WEBSITENAME',    '')
      formData.append('UPLOADIMAGE',    '')
      formData.append('OTHERREASONTXT', otherText.trim())

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

  return (
    <KeyboardAvoidingView
      style={s.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* "Other reasons" section label */}
          <Text style={s.sectionLabel}>{t('DELETE_PROFILE.OTHER_REASON')}</Text>

          {/* Bordered text area box */}
          <View style={s.inputBox}>
            <Text style={s.inputLabel}>{t('DELETE_PROFILE.TYPE_CONCERN')}</Text>
            <TextInput
              style={s.textArea}
              value={otherText}
              onChangeText={setOtherText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={140}
              placeholderTextColor="#b0b0b0"
            />
          </View>
        </ScrollView>

        {/* Footer: Submit — always enabled (text is optional) */}
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
              onPress={handleSubmit}
            />
          )}
        </View>

      </View>
    </KeyboardAvoidingView>
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

  // ── Section label ──
  sectionLabel: {
    fontSize:     14,
    fontWeight:   '400',
    color:        '#1f1e1b',
    lineHeight:   20,
    marginBottom: 24,
  },

  // ── Text area box ──
  inputBox: {
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       '#e6e6e6',
    paddingHorizontal: 12,
    paddingVertical:   16,
    backgroundColor:   Colors.white,
  },
  inputLabel: {
    fontSize:     14,
    fontWeight:   '400',
    color:        '#1f1e1b',
    marginBottom: 8,
  },
  textArea: {
    minHeight:  120,
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
    padding:    0,
    margin:     0,
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
