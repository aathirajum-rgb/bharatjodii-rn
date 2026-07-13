import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
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
import { getMultiple } from '../../service/storageService'
import { apiCall, uploadFile } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'

const SCREEN_H = Dimensions.get('window').height

// ─── CDN ──────────────────────────────────────────────────────────────────────

const R = CDN_REACT + '/'

const ICON = {
  back: R + 'menu_back_arrow.svg',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any }

const REASON_KEYS = ['1', '2', '3', '4', '5'] as const
type ReasonKey = typeof REASON_KEYS[number]

// ─── RadioCard ────────────────────────────────────────────────────────────────

interface RadioCardProps {
  label: string
  selected: boolean
  onPress: () => void
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

// ─── BreakSheet ───────────────────────────────────────────────────────────────

interface BreakSheetProps {
  visible:   boolean
  onClose:   () => void
  onHide:    () => void
  onDelete:  () => void
  deleting:  boolean
}

function BreakSheet({ visible, onClose, onHide, onDelete, deleting }: BreakSheetProps) {
  const { t }    = useTranslation()
  const insets   = useSafeAreaInsets()
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
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Scrim */}
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          backgroundColor: Colors.black,
          opacity: scrimAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        }]}
        pointerEvents="none"
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Sheet */}
      <Animated.View style={[bs.sheet, { paddingBottom: insets.bottom + 24 }, { transform: [{ translateY: slideAnim }] }]}>

        {/* Sheet top row: handle pill + close button */}
        <View style={bs.topRow}>
          <View style={bs.handlePill} />
          <Pressable style={bs.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={bs.closeIcon}>✕</Text>
          </Pressable>
        </View>

        {/* Sheet title */}
        <Text style={bs.sheetTitle}>{t('DELETE_PROFILE.HEADER')}</Text>

        {/* Description */}
        <Text style={bs.title}>{t('DELETE_PROFILE.HIDE_HEADER')}</Text>

        {/* "Hide my profile" — solid primary CTA */}
        <ButtonRevamp
          label={t('DELETE_PROFILE.HIDE_CTA')}
          variant="primary"
          fullWidth
          onPress={onHide}
        />

        {/* "No, delete my profile" — gray bordered button */}
        <Pressable
          style={bs.deleteBtn}
          onPress={onDelete}
          disabled={deleting}
          accessibilityRole="button"
        >
          {deleting ? (
            <ActivityIndicator color="#545454" size="small" />
          ) : (
            <Text style={bs.deleteBtnText}>{t('DELETE_PROFILE.NO_DELETE_CTA')}</Text>
          )}
        </Pressable>

      </Animated.View>
    </Modal>
  )
}

// ─── DeleteProfileScreen ──────────────────────────────────────────────────────

export default function DeleteProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t }  = useTranslation()

  const [selectedReason,   setSelectedReason]   = useState<ReasonKey>('1')
  const [showBreakSheet,   setShowBreakSheet]   = useState(false)
  const [deleting,         setDeleting]         = useState(false)
  const [otherReasonText,  setOtherReasonText]  = useState('')
  const [submittingOther,  setSubmittingOther]  = useState(false)

  function handleNext() {
    const reasonName = t(`DELETE_PROFILE.REASON_${selectedReason}`)
    if (selectedReason === '1') {
      navigation.navigate('DeleteProfileMrgReason', { reason: selectedReason, reasonName })
    } else if (selectedReason === '3') {
      setShowBreakSheet(true)
    } else if (selectedReason === '4') {
      navigation.navigate('DeleteProfileUnsatisfactory', { reasonName })
    } else if (selectedReason === '5') {
      handleOtherReasonSubmit(reasonName)
    } else {
      // TODO: wire remaining flows ('2')
      navigation.navigate('DeleteProfileMrgReason', { reason: selectedReason, reasonName })
    }
  }

  async function handleOtherReasonSubmit(reasonName: string) {
    if (submittingOther) return
    setSubmittingOther(true)
    try {
      const vals = await getMultiple([StorageKeys.Auth.USER_ID, StorageKeys.User.LOGIN_GENDER])
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
      formData.append('OTHERREASONTXT', otherReasonText.trim())

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
      setSubmittingOther(false)
    }
  }

  // "No, delete my profile" from the break bottom sheet → TYPE=2
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
      formData.append('REASON',         t('DELETE_PROFILE.REASON_3'))
      formData.append('MRGFIXEDREASON', '')
      formData.append('PARTNERNAME',    '')
      formData.append('DATEFIX',        '')
      formData.append('MRGDATE',        '')
      formData.append('MRGINMONTHS',    '')
      formData.append('ADDRESS',        '')
      formData.append('WEBSITENAME',    '')
      formData.append('UPLOADIMAGE',    '')

      await uploadFile(Endpoints.media.deleteProfile, formData)

      const reason = t('DELETE_PROFILE.REASON_3')
      const params = `ID=${userId}&GENDER=${gender}&REASON=${encodeURIComponent(reason)}&TYPE=2&DELETIONTYPE=2`
      const res    = await apiCall(Endpoints.auth.deleteProfile, 'POST', params)

      if (String(res['RESPONSECODE']) === '1' && String(res['ERRCODE']) === '0') {
        setShowBreakSheet(false)
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
      setDeleting(false)
    }
  }

  const reasons: { key: ReasonKey; label: string }[] = REASON_KEYS.map(k => ({
    key:   k,
    label: t(`DELETE_PROFILE.REASON_${k}`),
  }))

  return (
    <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      {/* Reason list + optional text area */}
      <ScrollView
        style={s.flex1}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {reasons.map(({ key, label }) => (
          <RadioCard
            key={key}
            label={label}
            selected={selectedReason === key}
            onPress={() => setSelectedReason(key)}
          />
        ))}

        {/* Text area — visible when "Other reasons" is selected */}
        {selectedReason === '5' && (
          <View style={s.concernSection}>
            <Text style={s.concernTitle}>{t('DELETE_PROFILE.CONCERN_TITLE')}</Text>
            <TextInput
              style={s.concernInput}
              value={otherReasonText}
              onChangeText={setOtherReasonText}
              placeholder={t('DELETE_PROFILE.TYPE_CONCERN') + '...'}
              placeholderTextColor="#b0b0b0"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={140}
            />
          </View>
        )}
      </ScrollView>

      {/* Next / Submit CTA */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {submittingOther ? (
          <View style={s.loadingBtn}>
            <ActivityIndicator color={Colors.white} size="small" />
          </View>
        ) : (
          <ButtonRevamp
            label={t('DELETE_PROFILE.NEXT_CTA')}
            variant="primary"
            fullWidth
            onPress={handleNext}
          />
        )}
      </View>

      {/* ── "Want to take a break" bottom sheet ── */}
      <BreakSheet
        visible={showBreakSheet}
        onClose={() => setShowBreakSheet(false)}
        onHide={() => {
          setShowBreakSheet(false)
          navigation.navigate('DeleteProfileHide', {
            reasonName: t('DELETE_PROFILE.REASON_3'),
          })
        }}
        onDelete={handleDirectDelete}
        deleting={deleting}
      />

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
    fontSize:   16,
    fontWeight: '500',
    color:      '#333333',
    marginLeft: 6,
  },

  // ── List ──
  list: {
    paddingHorizontal: 24,
    paddingTop:        24,
    gap:               12,
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

  // ── Other reason text area ──
  concernSection: {
    marginTop: 24,
  },
  concernTitle: {
    fontSize:     18,
    fontWeight:   '600',
    color:        '#000000',
    marginBottom: 12,
  },
  concernInput: {
    minHeight:         120,
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

  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    backgroundColor:   Colors.white,
  },
  loadingBtn: {
    height:          44,
    borderRadius:    8,
    backgroundColor: PRIMARY,
    alignItems:      'center',
    justifyContent:  'center',
  },
})

// ─── BreakSheet styles ────────────────────────────────────────────────────────

const bs = StyleSheet.create({
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingTop:           12,
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.12,
    shadowRadius:         16,
    elevation:            20,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   20,
  },
  handlePill: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#d0d0d0',
  },
  closeBtn: {
    position:       'absolute',
    right:          0,
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize:   18,
    color:      '#666666',
    lineHeight: 22,
  },
  sheetTitle: {
    fontSize:     16,
    fontWeight:   '600',
    color:        '#1f1e1b',
    lineHeight:   24,
    marginBottom: 8,
  },
  title: {
    fontSize:     14,
    fontWeight:   '400',
    color:        '#333333',
    lineHeight:   22,
    marginBottom: 24,
  },
  deleteBtn: {
    marginTop:      12,
    height:         48,
    borderRadius:   8,
    borderWidth:    1,
    borderColor:    '#545454',
    alignItems:     'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize:   14,
    fontWeight: '400',
    color:      '#545454',
    lineHeight: 20,
  },
})
