// Desktop "Photo privacy" popup for Edit Profile (Figma "Jodii Desktop -
// Registration", UaPAN9aG6MfZf6CRpwXf1L, node 647:10277) — same real content/
// logic as the mobile PhotoPrivacySheet.tsx (a BottomSheet), just re-chromed
// as a centered desktop modal instead of a slide-up sheet, matching this
// session's own established desktop-popup convention (see
// LogoutConfirmModal.tsx/DeletePhotoConfirmModal.tsx).
//
// Figma node 647:10277 only resolves to a bare 1336×800 dark scrim rectangle
// — the exact same dead end hit for the delete-photo confirm popup earlier.
// Extensive metadata sweeps around it (and the surrounding id ranges) only
// ever turned up an unrelated "Edit Preferences" page's content sharing
// nearby ids, not a discoverable Photo Privacy modal card — genuinely
// unlocatable through the Figma MCP tools available this session, not
// skipped for convenience. Content/copy/logic instead reused verbatim from
// PhotoPrivacySheet.tsx (itself already ported from Angular's
// modalpopup.component.ts's 'profilePhotoPrivacy'/'profileConfirmPrivacy'
// actions) — see that file's own header comment for the full real-behavior
// trace (3 radio options, female-only free tier, paid-feature lock +
// paywall redirect, "fewer responses" confirm step for options 2/3).
//
// Deliberately NOT reusing <BottomSheet> — that component's own slide-up-
// from-bottom animation and mobile-width-hugging card only make sense on a
// narrow viewport. This is a fresh, standalone component (state duplicated,
// not shared) so mobile's EditProfileScreen.tsx / PhotoPrivacySheet.tsx stay
// completely untouched — same split this session already used for
// IgnoredProfilesDesktopScreen.tsx, ViewLaterDesktopLayout.tsx, etc.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { redirectToIntermediatePage } from '../../service/paymentService'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

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

export default function PhotoPrivacyDesktopModal({ visible, onClose, onSaved }: Props) {
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
    setStep('options')
    setLoading(true)
    Promise.all([
      getItem(SK.User.LOGIN_GENDER),
      getItem(SK.Auth.ENTRY_TYPE),
      getItem(SK.Profile.PHOTO_PRIVACY),
    ]).then(([gender, entryType, code]) => {
      setIsFemale(gender === '0')
      setIsFreeMember(entryType === 'F')
      const c = code ?? '0'
      setStoredCode(c)
      setSelected(VALUE_FOR_CODE[c] ?? '1')
      setLoading(false)
    })
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          {step === 'options' && (
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={s.closeIcon}>{'✕'}</Text>
            </Pressable>
          )}

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
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 480, backgroundColor: Colors.white, borderRadius: 24,
    padding: 32, position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  closeIcon: { fontSize: 16, color: Colors.textDark },

  loadingBox: { paddingVertical: 32, alignItems: 'center' },

  title: { fontSize: 20, fontFamily: Fonts.poppinsSemiBold, color: Colors.textPrimary, marginBottom: 8, marginRight: 32 },
  subtitle: { fontSize: 14, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },

  option: { paddingVertical: 16 },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider },

  recommendedFlag: {
    alignSelf: 'flex-start', backgroundColor: Colors.primarySurface,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 8,
  },
  recommendedFlagText: { fontSize: 11, fontFamily: Fonts.poppinsSemiBold, color: Colors.primaryDark },

  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  optionText: { flex: 1, gap: 4 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optionTitle: { fontSize: 14, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: Colors.textPrimary },
  optionContent: { fontSize: 13, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.textSecondary, lineHeight: 18 },

  paidBadge: { backgroundColor: Colors.badgePaidBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  paidBadgeText: { fontSize: 10, fontFamily: Fonts.poppinsSemiBold, color: Colors.badgePaidText },

  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  confirmText: { fontSize: 14, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.textPrimary, lineHeight: 20 },
  confirmTextSpaced: { marginTop: 12, fontFamily: SemanticFontsEnglish.headingEnglishMedium },
  confirmRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  confirmBtn: { flex: 1 },
})
