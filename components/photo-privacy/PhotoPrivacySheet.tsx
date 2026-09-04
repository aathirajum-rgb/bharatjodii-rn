// Ported from Angular's modalpopup.component.ts/.html — action 'profilePhotoPrivacy'
// (opened from edit-profile.page.ts's clickPhotoPrivacy() when the member already
// has at least one photo) plus its 'profileConfirmPrivacy' confirm sub-step.
//
// Three radio options, in Angular's exact order:
//  1. "Show my photo to all" (value '1') — always shown, "Highly Recommended" flag,
//     saves immediately, no confirmation.
//  2. "Show my photo only to members I like" (value '3') — FREE tier, shown only
//     for women (LOGINGENDER != 'M') — Angular gates this on gender, not membership.
//  3. Same title (value '2') but with a lock + "Paid feature" badge — shown to
//     everyone. If a free/non-paying member (ENTRYTYPE == 'F') picks it, they're
//     redirected to the paywall instead of being able to select it at all.
// Options 2 and 3 both require the same "are you sure — fewer responses" confirm
// step before saving; option 1 does not.
//
// Save: POST editprofile/privacysetting/v1 with ID/VALUE(1|2|3)/TYPE=1 — reused
// as-is via Endpoints.profile.privacySetting (already defined). Only fires the
// call when the resolved value actually differs from the cached PHOTOPRIVACY
// code (Angular's own behavior — a no-op selection just closes the sheet).
// UI radio value -> stored code mapping is Angular's `photoPrivacyArr`.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { redirectToIntermediatePage } from '../../service/paymentService'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import BottomSheet from '../bottom-sheet/BottomSheet'

type UiValue = '1' | '2' | '3'

// UI radio value -> stored PHOTOPRIVACY code (Angular: photoPrivacyArr = {"1":"0","2":"1","3":"2"})
const CODE_FOR_VALUE: Record<UiValue, string> = { '1': '0', '2': '1', '3': '2' }
// Stored code -> default UI radio selection on open
const VALUE_FOR_CODE: Record<string, UiValue> = { '0': '1', '1': '2', '2': '3' }

type Props = {
  visible: boolean
  onClose: () => void
  onSaved?: (() => void) | undefined
}

export default function PhotoPrivacySheet({ visible, onClose, onSaved }: Props) {
  const { t } = useTranslation()

  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [isFemale, setIsFemale]   = useState(false)
  const [isFreeMember, setIsFreeMember] = useState(false)
  const [storedCode, setStoredCode]     = useState('0')
  const [selected, setSelected]         = useState<UiValue>('1')
  const [step, setStep]                 = useState<'options' | 'confirm'>('options')

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setStep('options')
    setLoading(true)
    Promise.all([
      getItem(SK.User.LOGIN_GENDER),
      getItem(SK.Auth.ENTRY_TYPE),
      getItem(SK.Profile.PHOTO_PRIVACY),
    ]).then(([gender, entryType, code]) => {
      if (cancelled) return
      setIsFemale(gender === '0')
      setIsFreeMember(entryType === 'F')
      const c = code ?? '0'
      setStoredCode(c)
      setSelected(VALUE_FOR_CODE[c] ?? '1')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [visible])

  function handleSelect(value: UiValue) {
    if (value === '2' && isFreeMember) {
      // Paid "members I like" tier — free members hit the paywall, not the picker.
      onClose()
      redirectToIntermediatePage('edit-profile')
      return
    }
    if (value === '1') {
      setSelected(value)
      save(value)
      return
    }
    setSelected(value)
    setStep('confirm')
  }

  async function save(value: UiValue) {
    const newCode = CODE_FOR_VALUE[value]
    if (newCode === storedCode) {
      onClose()
      return
    }

    setSaving(true)
    try {
      const userId = await getItem(SK.Auth.USER_ID)
      const res = await apiCall(Endpoints.profile.privacySetting, 'POST', `ID=${userId ?? ''}&VALUE=${value}&TYPE=1`)
      setSaving(false)

      if (res?.RESPONSECODE == 1 && res?.ERRCODE == 0) {
        await setItem(SK.Profile.PHOTO_PRIVACY, newCode)
        Alert.alert('', t('PRIVACY.SUCCESS_TOAST'))
        onSaved?.()
      } else {
        Alert.alert('', res?.RESPONSE?.MSG || 'Something went wrong. Please try again.')
      }
    } catch {
      setSaving(false)
      Alert.alert('', 'Something went wrong. Please try again.')
    }
    onClose()
  }

  const options: Array<{ value: UiValue; title: string; content: string; badge?: 'recommended' | 'paid' }> = [
    {
      value: '1',
      title: t('PRIVACY.POPUP_SHOW_ALL_PHOTO'),
      content: t('PRIVACY.POPUP_SHOW_ALL_PHOTO_TXT_1'),
      badge: 'recommended',
    },
    ...(isFemale ? [{
      value: '3' as UiValue,
      title: t('PRIVACY.POPUP_SHOW_LIKE_PHOTO'),
      content: t('PRIVACY.POPUP_SHOW_LIKE_PHOTO_TXT'),
    }] : []),
    {
      value: '2' as UiValue,
      title: t('PRIVACY.POPUP_SHOW_LIKE_PHOTO'),
      content: t('PRIVACY.POPUP_SHOW_LIKE_PHOTO_TXT'),
      badge: 'paid',
    },
  ]

  return (
    <BottomSheet visible={visible} type="photoPrivacy" onClose={onClose} showClose={step === 'options'}>
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.primaryDark} />
        </View>
      ) : step === 'confirm' ? (
        <View>
          <Text style={s.confirmText}>{t('PRIVACY.PAID_POPUP_TXT_1')}</Text>
          <Text style={[s.confirmText, s.confirmTextSpaced]}>{t('PRIVACY.PAID_POPUP_TXT_2')}</Text>
          <View style={s.confirmRow}>
            <View style={s.confirmBtn}>
              <ButtonRevamp
                label={t('PRIVACY.PAID_POPUP_NO_CTA')} variant="secondary" size="standard" fullWidth
                onPress={() => save('1')} disabled={saving}
              />
            </View>
            <View style={s.confirmBtn}>
              <ButtonRevamp
                label={t('PRIVACY.PAID_POPUP_YES_CTA')} variant="primary" size="standard" fullWidth
                loading={saving} onPress={() => save(selected)} disabled={saving}
              />
            </View>
          </View>
        </View>
      ) : (
        <View>
          <Text style={s.title}>{t('PRIVACY.POPUP_HEADER')}</Text>
          <Text style={s.subtitle}>{t('PRIVACY.POPUP_SUB_HEADER')}</Text>

          {options.map((opt, i) => {
            const isSelected = selected === opt.value
            return (
              <Pressable
                key={opt.value}
                style={[s.option, i > 0 && s.optionDivider]}
                onPress={() => handleSelect(opt.value)}
              >
                {opt.badge === 'recommended' && (
                  <View style={s.recommendedFlag}>
                    <Text style={s.recommendedFlagText}>{t('PRIVACY.POPUP_SHOW_ALL_PHOTO_HR_TXT')}</Text>
                  </View>
                )}
                <View style={s.optionRow}>
                  <View style={s.optionText}>
                    <View style={s.optionTitleRow}>
                      <Text style={s.optionTitle}>{opt.title}</Text>
                      {opt.badge === 'paid' && (
                        <View style={s.paidBadge}>
                          <Text style={s.paidBadgeText}>{t('PRIVACY.POPUP_PAID_FEATURE_BADGE')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.optionContent}>{opt.content}</Text>
                  </View>
                  <View style={[s.radio, isSelected && s.radioSelected]}>
                    {isSelected && <View style={s.radioDot} />}
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </BottomSheet>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loadingBox: { paddingVertical: 32, alignItems: 'center' },

  title: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 16 },

  option: { paddingVertical: 16 },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider },

  recommendedFlag: {
    alignSelf: 'flex-start', backgroundColor: Colors.primarySurface,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 8,
  },
  recommendedFlagText: { fontSize: 11, fontWeight: '600', color: Colors.primaryDark },

  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  optionText: { flex: 1, gap: 4 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optionTitle: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  optionContent: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  paidBadge: { backgroundColor: Colors.badgePaidBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  paidBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.badgePaidText },

  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  confirmText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  confirmTextSpaced: { marginTop: 12, fontWeight: '500' },
  confirmRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  confirmBtn: { flex: 1 },
})
