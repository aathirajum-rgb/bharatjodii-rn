import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem, getMultiple } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import DeleteProfileUploadPhotoDesktopLayout from './DeleteProfileUploadPhotoDesktopLayout'
import type { FooterTab } from '../../components/app-footer/AppFooter'

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back: R + 'menu_back_arrow.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }

// ─── DeleteProfileUploadPhotoScreen ──────────────────────────────────────────

export default function DeleteProfileUploadPhotoScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()
  const isDesktop = useIsDesktopWeb()

  const {
    partnerName      = '',
    dateFixType      = '2',
    mrgDate          = '',
    mrgInMonthsName  = '',
    reasonName       = '',
    mrgReasonName    = '',
  } = route.params ?? {}

  const [photoUri,   setPhotoUri]   = useState<string | null>(null)
  // Web only — FormData needs a real File/Blob, not the {uri,name,type} object
  // RN's FormData polyfill accepts on native. photoUri still drives the preview.
  const [photoFile,  setPhotoFile]  = useState<File | null>(null)
  const [address,    setAddress]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [userName,   setUserName]   = useState('')

  useEffect(() => {
    getItem(StorageKeys.User.NAME).then(name => setUserName(name ?? ''))
  }, [])

  // ── Image picker ──────────────────────────────────────────────────────────

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri)
    }
  }

  function pickPhotoWeb(file: File) {
    setPhotoFile(file)
    setPhotoUri(URL.createObjectURL(file))
  }

  // ── API call ──────────────────────────────────────────────────────────────

  async function callDeleteAPI() {
    if (submitting) return
    setSubmitting(true)

    try {
      const vals = await getMultiple([
        StorageKeys.Auth.USER_ID,
        StorageKeys.User.LOGIN_GENDER,
      ])
      const userId = vals[StorageKeys.Auth.USER_ID] ?? ''
      const gender = vals[StorageKeys.User.LOGIN_GENDER] ?? ''

      // 1. Upload photo + details to media endpoint
      const formData = new FormData()
      formData.append('MatriId',        userId)
      formData.append('DELETEDID',      userId)
      formData.append('REASON',         reasonName)
      formData.append('MRGFIXEDREASON', mrgReasonName)
      formData.append('PARTNERNAME',    partnerName)
      formData.append('DATEFIX',        dateFixType === '1' ? 'Marriage date fixed' : 'Date not yet fixed')
      formData.append('MRGDATE',        mrgDate)
      formData.append('MRGINMONTHS',    mrgInMonthsName)
      formData.append('ADDRESS',        address)

      if (Platform.OS === 'web' && photoFile) {
        formData.append('UPLOADIMAGE', photoFile, photoFile.name)
      } else if (photoUri) {
        const filename = photoUri.split('/').pop() ?? 'photo.jpg'
        const ext      = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
        formData.append('UPLOADIMAGE', { uri: photoUri, name: filename, type: mimeType } as any)
      }

      await uploadFile(Endpoints.media.deleteProfile, formData)

      // 2. Delete profile API
      const reason = reasonName || mrgReasonName || '1'
      const params = `ID=${userId}&GENDER=${gender}&REASON=${reason}&TYPE=1&DELETIONTYPE=1&PARTNERNAME=${encodeURIComponent(partnerName)}`
      const res    = await apiCall(Endpoints.auth.deleteProfile, 'POST', params)

      if (String(res['RESPONSECODE']) === '1' && String(res['ERRCODE']) === '0') {
        const msg = res['RESPONSE']?.['MSG'] ?? {}
        navigation.navigate('DeleteProfileSuccess', {
          successMsgImage: msg['SUCCESS_MSG_IMAGE'] ?? '',
          successMsg:      msg['SUCCESS_MSG']       ?? 'Your profile has been successfully deleted',
        })
      } else {
        const msg = res['RESPONSE']?.['MSG'] ?? 'Something went wrong. Please try again.'
        Alert.alert('Error', msg)
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    await callDeleteAPI()
  }

  async function handleSubmit() {
    await callDeleteAPI()
  }

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 3: navigation.navigate('recharge', { fromTab: true }); break
      case 4: navigation.navigate('MessagerList'); break
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <DeleteProfileUploadPhotoDesktopLayout
        navigation={navigation}
        userName={userName}
        onTabPress={handleTabPress}
        photoUri={photoUri}
        onPickPhotoWeb={pickPhotoWeb}
        address={address}
        onChangeAddress={setAddress}
        submitting={submitting}
        onSkip={handleSkip}
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
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CdnSvg uri={ICON.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle}>{t('DELETE_PROFILE.HEADER')}</Text>
        <Pressable
          style={s.skipBtn}
          onPress={handleSkip}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Skip"
        >
          <Text style={s.skipText}>{t('DELETE_PROFILE.SKIP')}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Title */}
        <Text style={s.title}>{t('DELETE_PROFILE.UPLOAD_CONTENT')}</Text>
        <Text style={s.optional}>{t('DELETE_PROFILE.OPTIONAL_LABEL')}</Text>

        {/* Photo upload area */}
        <Pressable style={s.uploadArea} onPress={pickPhoto} accessibilityRole="button">
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={s.photoPreview}
              contentFit="cover"
            />
          ) : (
            <View style={s.uploadPlaceholder}>
              <View style={s.plusCircle}>
                <Text style={s.plusText}>+</Text>
              </View>
              <Text style={s.addPhotoText}>{t('DELETE_PROFILE.ADD_PHOTO')}</Text>
            </View>
          )}
        </Pressable>

        {/* Gift Delivery Address */}
        <View style={s.addressWrap}>
          <TextInput
            style={s.addressInput}
            value={address}
            onChangeText={setAddress}
            placeholder={t('DELETE_PROFILE.GIFT_DELIVERY_ADDRESS')}
            placeholderTextColor="#b0b0b0"
            multiline={false}
            returnKeyType="done"
            maxLength={200}
          />
        </View>

      </ScrollView>

      {/* Submit CTA */}
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
    flex:       1,
    fontSize:   16,
    fontWeight: '500',
    color:      '#333333',
    marginLeft: 6,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical:   8,
  },
  skipText: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#000000',
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },

  // ── Title ──
  title: {
    fontSize:   18,
    fontWeight: '600',
    color:      '#000000',
    lineHeight: 26,
  },
  optional: {
    fontSize:   14,
    fontWeight: '400',
    color:      'rgba(0,0,0,0.4)',
    marginTop:  4,
  },

  // ── Upload area ──
  uploadArea: {
    marginTop:       16,
    height:          240,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     '#e6e6e6',
    borderStyle:     'dashed',
    backgroundColor: 'rgba(230,230,230,0.3)',
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
  },
  uploadPlaceholder: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  plusCircle: {
    width:           40,
    height:          40,
    borderRadius:    20,
    borderWidth:     1.5,
    borderColor:     '#666',
    alignItems:      'center',
    justifyContent:  'center',
  },
  plusText: {
    fontSize:   22,
    lineHeight: 26,
    color:      '#666',
    fontWeight: '300',
  },
  addPhotoText: {
    marginTop:  10,
    fontSize:   14,
    fontWeight: '500',
    color:      '#000000',
  },
  photoPreview: {
    width:  '100%',
    height: '100%',
  },

  // ── Address ──
  addressWrap: {
    marginTop:    16,
    height:       48,
    borderRadius: 8,
    borderWidth:  1,
    borderColor:  '#b0b0b0',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
  },
  addressInput: {
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
