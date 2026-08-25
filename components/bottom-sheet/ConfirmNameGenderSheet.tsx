import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import BottomSheet from './BottomSheet'
import ButtonRevamp from '../button-revamp/ButtonRevamp'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts } from '../../src/theme/fonts'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'
import type { GenderOption } from '../../service/registrationService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfirmNameGenderSheetProps {
  visible:      boolean
  title:        string
  name:         string
  // Both omitted on the name-only sheet (hideGender) — nothing reads them there.
  gender?:       string | null | undefined
  genderOptions?: GenderOption[] | undefined
  /** Angular: componentData.NAME_LABEL — "Name" / "Relative's name". */
  nameLabel:    string
  /** Angular: componentData.GENDER_LABEL — "Gender" / "Friend's gender". */
  genderLabel?: string | undefined
  /** Angular: componentData.NAME_VIOLATED — red border + "enter a valid name". */
  nameViolated: boolean
  /** Angular: HIDE_GENDER — onboarding 2 edits the name only. */
  hideGender?:  boolean | undefined
  submitting?:  boolean | undefined
  onSubmit:     (name: string, gender: string) => void
}

// Angular: componentData.IMG = ImgDomain() + 'assets/images/svg/alert-circle.svg'
const ALERT_ICON = CDN_SVG + 'alert-circle.svg'

// Angular: common.formatFirstWordFirstLetter() — the label keys are stored
// lowercase ("relative's name"), the sheet renders them sentence-cased.
function capitalizeFirst(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

// Removes the browser's default black focus outline on web — TextInput renders
// as <input> there, and the outline would sit on top of our custom borderColor.
const webOutlineReset = { outlineStyle: 'none', outlineWidth: 0 } as any

// ─── ConfirmNameGenderSheet ───────────────────────────────────────────────────
// Angular: registration-modal-popup.component.html's SHOWONBOARDING3EDITFORM
// block, opened by showOnboarding3EditSheet() when the AIGENDERVALIDATION API
// flags the typed name (or its gender match) as invalid. The sheet is not
// dismissible — Angular passes cssClass:'restrict-back' and hides the close
// button, so the user must submit a corrected name to continue.

export default function ConfirmNameGenderSheet({
  visible,
  title,
  name,
  gender = null,
  genderOptions = [],
  nameLabel,
  genderLabel,
  nameViolated,
  hideGender = false,
  submitting = false,
  onSubmit,
}: ConfirmNameGenderSheetProps) {
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  // Seeded by the effect below, not here: this component stays mounted while the
  // sheet is closed, so the initial props are always stale by the time it opens.
  const [nameValue,   setNameValue]   = useState('')
  const [genderValue, setGenderValue] = useState('')
  const [isFocused,   setIsFocused]   = useState(false)
  // Angular: onNameInputChange() clears the violation flag as soon as the user
  // edits, so the red border doesn't persist while they're fixing it.
  const [showViolation, setShowViolation] = useState(false)

  // Re-seed whenever the sheet is (re)opened — a failed re-validation reopens it
  // with the values the user just submitted, not the originals.
  useEffect(() => {
    if (!visible) return
    setNameValue(name)
    setGenderValue(gender ?? '')
    setShowViolation(nameViolated)
  }, [visible, name, gender, nameViolated])

  // Angular: componentData.GENDER_TEXT = selectedGender?.TEXT — the helper line
  // under the pills, re-resolved whenever the user switches pill.
  const selectedText = genderOptions.find(o => o.key === genderValue)?.text ?? ''

  // Angular: form validators — required, minLength(2), letters/marks/spaces only.
  const isValid = /^[\p{L}\p{M}\s]{2,}$/u.test(nameValue.trim())
    && (hideGender || !!genderValue)

  // Same border rule as the onboarding Name field: focus wins, then red for a
  // flagged or empty name, else the default grey.
  const borderColor = isFocused
    ? Colors.inputFocus
    : (showViolation || nameValue.length === 0)
      ? Colors.inputError
      : Colors.inputBorder

  return (
    <BottomSheet visible={visible} showClose={false}>
      <View style={styles.body}>
        {/* Angular: componentData.IMG — .top-left-modal-img, 48x48, mb-24 */}
        <CdnSvg uri={ALERT_ICON} width={48} height={48} style={styles.alertIcon} />

        <Text style={[styles.title, { fontFamily: langFonts.semiBold }]}>{title}</Text>

        {/* Name field — Angular: ion-input bound to nameValue, .name-violation on error */}
        <View style={styles.inputOuter}>
          <TextInput
            style={[styles.inputBox, { borderColor }, webOutlineReset]}
            value={nameValue}
            onChangeText={text => { setNameValue(text); setShowViolation(false) }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            cursorColor={Colors.textPrimary}
            selectionColor={Colors.textPrimary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
          {/* Angular: .floating bound to componentData.NAME_LABEL */}
          <View style={styles.labelWrap} pointerEvents="none">
            <Text style={[styles.labelText, { fontFamily: langFonts.regular }]}>{capitalizeFirst(nameLabel)}</Text>
          </View>
        </View>

        {/* Angular: REGISTRATION.VIOLATED_NAME under the input */}
        {showViolation && (
          <Text style={[styles.violationText, { fontFamily: langFonts.regular }]}>
            {t('REGISTRATION.VIOLATED_NAME', 'Please enter a valid name')}
          </Text>
        )}

        {/* Gender section — hidden for onboarding 2 (name-only edit) */}
        {!hideGender && (
          <>
            {/* Angular: font-14-semibold black-color, mt-24 */}
            {!!genderLabel && (
              <Text style={[styles.genderLabel, { fontFamily: langFonts.semiBold }]}>{capitalizeFirst(genderLabel)}</Text>
            )}

            {/* Angular: .gender-pill-group — inline pills, not the full-width
                avatar cards used on the onboarding gender page */}
            {!!genderOptions.length && (
              <View style={styles.pillGroup}>
                {genderOptions.map(opt => {
                  const isSelected = genderValue === opt.key
                  return (
                    <Pressable
                      key={opt.key}
                      style={[styles.pill, isSelected && styles.pillSelected]}
                      onPress={() => setGenderValue(opt.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={opt.label}
                    >
                      {/* Angular: .gender-pill-radio — grey ring, filled red with
                          a white tick (::after) once selected */}
                      <View style={[styles.pillRadio, isSelected && styles.pillRadioSelected]}>
                        {isSelected && <View style={styles.pillTick} />}
                      </View>
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected, { fontFamily: isSelected ? langFonts.medium : langFonts.regular }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {/* Angular: componentData.GENDER_TEXT — the selected option's TEXT */}
            {!!selectedText && <Text style={[styles.genderText, { fontFamily: langFonts.medium }]}>{selectedText}</Text>}
          </>
        )}

        {/* Angular: CTA 'REGISTRATION.BTM_SUBMIT', ISHSOWSECONDARYCTA:false */}
        <ButtonRevamp
          label={t('REGISTRATION.BTM_SUBMIT', 'Submit')}
          variant="primary"
          size="standard"
          fullWidth
          disabled={!isValid}
          loading={submitting}
          style={styles.submitBtn}
          onPress={() => onSubmit(nameValue.trim(), genderValue)}
        />
      </View>
    </BottomSheet>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  body: {
    width: '100%',
  },
  // Angular .top-left-modal-img: 48x48, left-aligned, mb-24
  alertIcon: {
    marginBottom: 24,
  },
  title: {
    fontSize:     18,
    color:        Colors.textPrimary,
    lineHeight:   24,
  },

  // Name input — same outlined + floating-label treatment as NameScreen.
  // Angular: the form column carries mt-24 below the title.
  inputOuter: {
    position:  'relative',
    marginTop: 24,
  },
  inputBox: {
    height:            48,
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   0,
    fontFamily:        Fonts.poppinsMedium,
    fontSize:          14,
    fontWeight:        '500',
    color:             Colors.textPrimary,
  },
  labelWrap: {
    position:          'absolute',
    top:               -8,
    left:              16,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
  },
  labelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  violationText: {
    marginTop:  8,
    fontSize:   12,
    color:      Colors.inputError,
    lineHeight: 16,
  },

  // Section heading above the pills — Angular: font-14-semibold black-color, mt-24
  genderLabel: {
    marginTop:  24,
    fontSize:   14,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },

  // Angular .gender-pill-group: flex row, gap 16, wraps, mt-12
  pillGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           16,
    marginTop:     12,
  },
  // Angular .gender-pill: 40px tall, 28px radius, 1px #8a8a8a, padding 8px 16px 8px 8px
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    height:          40,
    borderWidth:     1,
    borderColor:     Colors.borderNeutral,
    borderRadius:    28,
    backgroundColor: Colors.white,
    paddingLeft:     8,
    paddingRight:    16,
  },
  // Angular .gender-pill.selected: 50px radius, rgba(181,0,51,.40) border on a
  // rgba(181,0,51,.02) tint — still a 1px border, so the pill doesn't shift.
  pillSelected: {
    borderRadius:    50,
    borderColor:     'rgba(181, 0, 51, 0.40)',
    backgroundColor: 'rgba(181, 0, 51, 0.02)',
  },

  // Angular .gender-pill-radio: 20x20 ring, 2px #8a8a8a, 8px right gap
  pillRadio: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    2,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    8,
  },
  // Selected: ring fills solid red so the white tick reads against it
  pillRadioSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  // Angular ::after — a rotated ⌐ made from two white borders forms the tick
  pillTick: {
    width:                 8,
    height:                3,
    borderLeftWidth:       2,
    borderBottomWidth:     2,
    borderLeftColor:       Colors.white,
    borderBottomColor:     Colors.white,
    transform:             [{ rotate: '-50deg' }],
    marginTop:             -3,
  },

  // Angular body2-regular-14 line-height-16, switching to Medium once selected
  pillText: {
    fontSize:   14,
    fontWeight: '400',
    lineHeight: 16,
    color:      Colors.textPrimary,
  },
  pillTextSelected: {
    fontWeight: '500',
  },

  // Helper line under the pills — Angular body1-medium-14-all black-color, mt-8
  genderText: {
    marginTop:  8,
    fontSize:   14,
    fontWeight: '500',
    lineHeight: 20,
    color:      Colors.textPrimary,
  },

  submitBtn: {
    marginTop: 32,
  },
})
