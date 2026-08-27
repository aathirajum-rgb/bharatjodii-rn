import { useEffect, useState } from 'react'
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
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem, getMultiple } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { openMembershipTab } from '../../service/paymentService'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import DeleteProfileWebsiteNameDesktopLayout from './DeleteProfileWebsiteNameDesktopLayout'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import { handleBack } from '../../utils/navigationRef'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back: R + 'menu_back_arrow.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }

// ─── DeleteProfileWebsiteNameScreen ──────────────────────────────────────────

export default function DeleteProfileWebsiteNameScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const { mrgReasonName = '' } = route.params ?? {}

  const [websiteName, setWebsiteName] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [userName,    setUserName]    = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  async function callDeleteAPI() {
    if (submitting || !websiteName.trim()) return
    setSubmitting(true)

    try {
      const vals = await getMultiple([
        StorageKeys.Auth.USER_ID,
        StorageKeys.User.LOGIN_GENDER,
      ])
      const userId = vals[StorageKeys.Auth.USER_ID] ?? ''
      const gender = vals[StorageKeys.User.LOGIN_GENDER] ?? ''

      // Upload details (with WEBSITENAME)
      const formData = new FormData()
      formData.append('MatriId',        userId)
      formData.append('DELETEDID',      userId)
      formData.append('REASON',         mrgReasonName)
      formData.append('MRGFIXEDREASON', mrgReasonName)
      formData.append('PARTNERNAME',    '')
      formData.append('DATEFIX',        '')
      formData.append('MRGDATE',        '')
      formData.append('MRGINMONTHS',    '')
      formData.append('ADDRESS',        '')
      formData.append('WEBSITENAME',    websiteName.trim())
      formData.append('UPLOADIMAGE',    '')

      await uploadFile(Endpoints.media.deleteProfile, formData)

      // Delete profile API — TYPE=2 (non-Jodii found)
      const reason = mrgReasonName || '2'
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
      setSubmitting(false)
    }
  }

  const canSubmit = websiteName.trim().length > 0

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
      <DeleteProfileWebsiteNameDesktopLayout
        navigation={navigation}
        userName={userName}
        onTabPress={handleTabPress}
        websiteName={websiteName}
        onChangeWebsiteName={setWebsiteName}
        canSubmit={canSubmit}
        submitting={submitting}
        onSubmit={callDeleteAPI}
      />
    )
  }

  return (
    <KeyboardAvoidingView
      style={s.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.subtitle}>{t('DELETE_PROFILE.SHARE_DTL_HEADER')}</Text>

          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={websiteName}
              onChangeText={setWebsiteName}
              placeholder={t('DELETE_PROFILE.APP_WEBSITE_NAME')}
              placeholderTextColor="#b0b0b0"
              returnKeyType="done"
              maxLength={200}
              autoFocus
            />
          </View>
        </ScrollView>

        {/* Submit CTA — always visible, disabled until input has text */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          {submitting ? (
            <View style={s.loadingBtn}>
              <ActivityIndicator color={Colors.white} size="small" />
            </View>
          ) : (
            <ButtonRevamp
              label={t('DELETE_PROFILE.DELETE_CTA')}
              variant="primary"
              fullWidth
              disabled={!canSubmit}
              onPress={callDeleteAPI}
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

  // ── Content ──
  subtitle: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#1f1e1b',
    lineHeight: 20,
  },
  inputWrap: {
    marginTop:         16,
    height:            52,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       '#b0b0b0',
    justifyContent:    'center',
    paddingHorizontal: 16,
    backgroundColor:   Colors.white,
  },
  input: {
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
