// Ported from Angular's modalpopup.component.ts/.html — action 'profilePhotoPrivacy'
// (opened from edit-profile.page.ts's clickPhotoPrivacy() when the member already
// has at least one photo) plus its 'profileConfirmPrivacy' confirm sub-step.
//
// Three radio options, in Angular's exact order:
//  1. "Show my photo to all" (value '1') — always shown, "Highly recommended" tag.
//  2. "Show my photo only to members I like" (value '3') — FREE tier, shown only
//     for women (LOGINGENDER != 'M') — Angular gates this on gender, not membership.
//  3. Same title (value '2') with the "Paid feature" tag — shown to everyone.
//
// Flow — Angular selectPrivacy()/confirmPrivacy(), applied on "Submit" (new
// design) instead of on radio tap:
//  - value '2' by a free member (ENTRYTYPE == 'F') → paywall immediately on tap
//    (Angular: dismissModal + redirectToIntermediatePage('edit-profile')).
//  - value '1' → save.
//  - value '2' by a paying man → save directly (Angular confirmPrivacy()).
//  - value '2' by a paying woman, or value '3' → "are you sure" confirm step.
//
// Save: POST editprofile/privacysetting/v1 with ID/VALUE(1|2|3)/TYPE=1 — reused
// as-is via Endpoints.profile.privacySetting. Only fires the call when the
// resolved value actually differs from the cached PHOTOPRIVACY code (Angular's
// own behavior — a no-op selection just closes the sheet).
// UI radio value -> stored code mapping is Angular's `photoPrivacyArr`.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { CDN_REACT, CDN_SVG } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import { getItem, setItem } from '../../service/storageService'
import { apiCall } from '../../service/apiClient'
import { Endpoints } from '../../service/api.endpoints'
import { redirectToIntermediatePage } from '../../service/paymentService'
import { getSessionValue } from '../../service/registrationService'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import BottomSheet from '../bottom-sheet/BottomSheet'
import Badge from '../badge/Badge'
import CdnSvg, { CdnSvgBackground } from '../cdn-svg/CdnSvg'
import { FontSize } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// Blue shield-tick next to the "We assure 100% safety…" line.
const ICON_ASSURE  = CDN_REACT + '/photo_privacy_tick.svg'
// "Highly recommended" tag — Angular phone-privacy .highly-recommended-block:
// badge-bg.svg ribbon background + .star-bg (#C70038 circle) with privacy-star.svg.
const RECOMMENDED_BG   = CDN_SVG + 'badge-bg.svg'
const RECOMMENDED_STAR = CDN_SVG + 'privacy-star.svg'
// "Paid feature" tag — the app's existing paid Badge (green ribbon + crown).
const PAID_CROWN = CDN_SVG + 'revamp/paid-tag-revamp.svg'
// "Show my photo only to matches I like" confirm-step illustration.
const ICON_CONFIRM = CDN_SVG + 'photo-only-matches-popup.svg'

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
  const langFonts = useLanguageFonts()

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
      // ENTRYTYPE lives in the login session blob (same source chatService /
      // communicationService read) — the flat SK.Auth.ENTRY_TYPE key is never
      // written anywhere, so reading it always gave null and every member was
      // treated as paid (the paid option could be saved without paying).
      getSessionValue('ENTRYTYPE'),
      getItem(SK.Profile.PHOTO_PRIVACY),
    ]).then(([gender, entryType, code]) => {
      if (cancelled) return
      // LOGIN_GENDER is stored as 'F'/'M' (older writes used '0'/'1').
      setIsFemale(gender === 'F' || gender === '0')
      // Angular: memberShipType == 'F' → free. Unknown → treat as free, same
      // default communicationService uses, so a paid feature is never unlocked
      // by a missing value.
      setIsFreeMember(String(entryType ?? 'F') === 'F')
      const c = code ?? '0'
      setStoredCode(c)
      setSelected(VALUE_FOR_CODE[c] ?? '1')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [visible])

  function handleSelect(value: UiValue) {
    if (value === '2' && isFreeMember) {
      // Paid "members I like" tier — free members go to the recharge page, not
      // the picker. Angular: dismissModal(0); setPaymentPageType('3');
      // redirectToIntermediatePage('edit-profile').
      onClose()
      setItem('PAYMENTPAGETYPE', '3').finally(() => redirectToIntermediatePage('edit-profile'))
      return
    }
    setSelected(value)
  }

  function handleSubmit() {
    if (selected === '1' || (selected === '2' && !isFemale)) {
      save(selected)
      return
    }
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
          {/* Illustration top-left, then the question first, the consequence
              second, and Yes (primary) before No (secondary) — new design. */}
          <CdnSvg uri={ICON_CONFIRM} width={48} height={48} style={s.confirmIcon} />
          <Text style={[s.confirmQuestion, { fontFamily: langFonts.semiBold }]}>{t('PRIVACY.PAID_POPUP_TXT_2')}</Text>
          <Text style={[s.confirmText, s.confirmTextSpaced, { fontFamily: langFonts.regular }]}>{t('PRIVACY.PAID_POPUP_TXT_1')}</Text>
          <View style={s.confirmRow}>
            <View style={s.confirmBtn}>
              <ButtonRevamp
                label={t('PRIVACY.PAID_POPUP_YES_CTA')} variant="primary" size="standard" fullWidth
                loading={saving} onPress={() => save(selected)} disabled={saving}
              />
            </View>
            <View style={s.confirmBtn}>
              <ButtonRevamp
                label={t('PRIVACY.PAID_POPUP_NO_CTA')} variant="secondary" size="standard" fullWidth
                onPress={() => save('1')} disabled={saving}
              />
            </View>
          </View>
        </View>
      ) : (
        <View>
          <Text style={[s.title, { fontFamily: langFonts.semiBold }]}>{t('PRIVACY.POPUP_HEADER')}</Text>

          <View style={s.assureRow}>
            <CdnSvg uri={ICON_ASSURE} width={32} height={32} />
            <Text style={[s.assureText, { fontFamily: langFonts.regular }]}>{t('PRIVACY.POPUP_SUB_HEADER')}</Text>
          </View>

          {options.map((opt, i) => {
            const isSelected = selected === opt.value
            return (
              <Pressable
                key={opt.value}
                style={[s.option, i > 0 && s.optionDivider]}
                onPress={() => handleSelect(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                {opt.badge === 'recommended' && (
                  <CdnSvgBackground uri={RECOMMENDED_BG} style={s.recommendedTag}>
                    <View style={s.starBg}>
                      <CdnSvg uri={RECOMMENDED_STAR} width={12} height={12} />
                    </View>
                    <Text style={[s.recommendedText, { fontFamily: langFonts.medium }]} numberOfLines={1}>{t('PRIVACY.POPUP_SHOW_ALL_PHOTO_HR_TXT')}</Text>
                  </CdnSvgBackground>
                )}
                {opt.badge === 'paid' && (
                  <Badge variant="paid" text={t('PRIVACY.POPUP_PAID_FEATURE_BADGE')} imageUrl={PAID_CROWN} style={s.paidTag} />
                )}
                <View style={s.optionRow}>
                  <View style={s.optionText}>
                    <Text style={[s.optionTitle, { fontFamily: langFonts.semiBold }]}>{opt.title}</Text>
                    <Text style={[s.optionContent, { fontFamily: langFonts.regular }]}>{opt.content}</Text>
                  </View>
                  <View style={[s.radio, isSelected && s.radioSelected]}>
                    {isSelected && <View style={s.radioDot} />}
                  </View>
                </View>
              </Pressable>
            )
          })}

          <View style={s.submitWrap}>
            <ButtonRevamp
              label={t('GENERAL.SUBMIT', 'Submit')} variant="primary" size="standard" fullWidth
              loading={saving} onPress={handleSubmit} disabled={saving}
            />
          </View>
        </View>
      )}
    </BottomSheet>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loadingBox: { paddingVertical: 32, alignItems: 'center' },

  // Figma: 20 / SemiBold / black
  title: { fontSize: FontSize.font20, lineHeight: 28, color: Colors.black },

  // Figma: 32px blue shield-tick, 12 gap, 14/Regular black copy
  assureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 24, marginBottom: 12 },
  assureText: { flex: 1, fontSize: FontSize.font14, fontWeight: '400', lineHeight: 22, color: Colors.black },

  option: { paddingVertical: 16 },
  optionDivider: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle },

  // Angular .highly-recommended-block (phone-privacy.component.scss): ribbon bg,
  // padding 4/20/4/0, min-width 116; .star-bg #C70038 circle, 6 padding; label
  // `textcta-medium-12 color-C70038` with pl-8. Circle sits flush with the
  // option's left edge (inside the content column), per Figma.
  recommendedTag: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingVertical: 0, paddingLeft: 0, paddingRight: 20, minWidth: 116, borderRadius: 5, marginBottom: 8,
  },
  starBg: { backgroundColor: '#C70038', padding: 6, borderRadius: 999 },
  recommendedText: { paddingLeft: 8, fontSize: FontSize.font12, lineHeight: 16, color: '#C70038' },

  // The shared paid Badge overhangs its crown 10px to the LEFT (marginLeft -10,
  // Matches-card styling). Here the crown must sit inside the column, aligned
  // with the star circle and the option text — so cancel the overhang.
  paidTag: { marginLeft: 0, marginBottom: 8 },

  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  optionText: { flex: 1, gap: 4 },
  // Figma: 14 / SemiBold / black title, 12 / Regular / #333 description
  optionTitle: { fontSize: FontSize.font14, lineHeight: 20, color: Colors.black },
  optionContent: { fontSize: FontSize.font12, lineHeight: 18, color: Colors.textDark },

  // Figma radio: 22px circle, 2px ring (grey off / red on), 12px red dot when on.
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#8A8A8A',
    alignItems: 'center', justifyContent: 'center', marginTop: 0,
  },
  radioSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },

  submitWrap: { marginTop: 16 },

  confirmText: { fontSize: FontSize.font14, color: Colors.textPrimary, lineHeight: 20 },
  confirmTextSpaced: { marginTop: 8 },
  confirmIcon: { alignSelf: 'flex-start', marginBottom: 16 },
  confirmQuestion: { fontSize: FontSize.font16, lineHeight: 24, color: Colors.black },
  confirmRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  confirmBtn: { flex: 1 },
})
