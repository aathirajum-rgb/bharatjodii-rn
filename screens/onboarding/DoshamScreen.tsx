import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import {
  fetchDoshamOptions,
  getRegValues,
  setRegValue,
  submitHoroscopeDetails,
} from '../../service/registrationService'
import { setItem } from '../../service/storageService'
import { refreshSession } from '../../service/homeService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'dosham.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DoshamScreen({ navigation }: Props) {
  const { t } = useTranslation()

  // null = step 1 (yes/no not answered); true = step 2 (yes); false = submitted no
  const [hasDosham,    setHasDosham]    = useState<boolean | null>(null)
  const [doshamTypes,  setDoshamTypes]  = useState<Option[]>([])
  // multi-select — set of selected keys
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [fetching,     setFetching]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [createdBy,    setCreatedBy]    = useState('1')
  const [star,         setStar]         = useState('')
  const [raasi,        setRaasi]        = useState('')
  const [motherTongue, setMotherTongue] = useState('47')

  useEffect(() => {
    getRegValues().then(rv => {
      if (rv.CREATEDBY)    setCreatedBy(rv.CREATEDBY)
      if (rv.STAR)         setStar(rv.STAR)
      if (rv.RAASI)        setRaasi(rv.RAASI)
      if (rv.MOTHERTONGUE) setMotherTongue(rv.MOTHERTONGUE)
    })
  }, [])

  async function handleYes() {
    setHasDosham(true)
    setFetching(true)
    try {
      const { doshamHash } = await fetchDoshamOptions(star, raasi, motherTongue)
      setDoshamTypes(doshamHash)
    } catch {
      // stay on step 2 with empty list; user can skip
    } finally {
      setFetching(false)
    }
  }

  async function handleNo() {
    if (submitting) return
    setHasDosham(false)
    setSubmitting(true)
    try {
      await setRegValue('DOSHAM', '2')
      await submitHoroscopeDetails(star, raasi, '2')
      await refreshSession()
      await setItem('LASTAPPLOGINAT', new Date().toISOString())
      navigation.navigate('Home')
    } catch {
      setSubmitting(false)
    }
  }

  function toggleDoshamType(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleNext() {
    if (selectedKeys.size === 0 || submitting) return
    setSubmitting(true)
    const doshamValue = Array.from(selectedKeys).join('~')
    try {
      await setRegValue('DOSHAM', doshamValue)
      await submitHoroscopeDetails(star, raasi, doshamValue)
      await refreshSession()
      await setItem('LASTAPPLOGINAT', new Date().toISOString())
      navigation.navigate('Home')
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    await refreshSession()
    await setItem('LASTAPPLOGINAT', new Date().toISOString())
    navigation.navigate('Home')
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.SELECTDOSHAM', 'Does your #PROFILETYPE# have dosham?')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  useOnboardingFooter({
    nextHidden:   hasDosham !== true,
    nextDisabled: selectedKeys.size === 0,
    nextLoading:  submitting,
    onNext:       handleNext,
    showSkip:     true,
    skipLabel:    t('REG.DO_LATER', "I'll do this later"),
    onSkip:       handleSkip,
  }, [hasDosham, selectedKeys.size, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={os.title}>
          {title}
        </Text>

        {/* ── Step 1: Yes / No — standard pill-chip pattern (Figma: h40, radius50, left indicator) ── */}
        {hasDosham !== true && (
          <View style={styles.yesNoRow}>
            <Pressable
              style={[styles.yesNoBtn, hasDosham === false && styles.yesNoBtnActive]}
              onPress={handleNo}
              disabled={submitting}
              accessibilityRole="button"
            >
              {submitting && hasDosham === false ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <>
                  <View style={[styles.yesNoIcon, hasDosham === false && styles.yesNoIconActive]}>
                    {hasDosham === false && <Text style={styles.yesNoCheckmark}>✓</Text>}
                  </View>
                  <Text style={[styles.yesNoBtnText, hasDosham === false && styles.yesNoBtnTextActive]}>
                    No
                  </Text>
                </>
              )}
            </Pressable>

            {/* No active/checkmark state here (unlike the No button above) —
                handleYes() flips hasDosham to true immediately, which un-renders
                this whole step-1 block in the same tick, so an "active Yes" look
                could never actually be seen. */}
            <Pressable
              style={styles.yesNoBtn}
              onPress={handleYes}
              disabled={submitting}
              accessibilityRole="button"
            >
              <View style={styles.yesNoIcon} />
              <Text style={styles.yesNoBtnText}>
                Yes
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 2: Dosham type multi-select ── */}
        {hasDosham === true && (
          <>
            <Text style={styles.subTitle}>
              {t('DOSHAM_SUBCONTENT', 'You can choose one or more dosham')}
            </Text>

            {fetching ? (
              <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
            ) : (
              <View style={styles.checkList}>
                {doshamTypes.map(opt => {
                  const checked = selectedKeys.has(opt.key)
                  return (
                    <Pressable
                      key={opt.key}
                      style={[styles.checkRow, checked && styles.checkRowActive]}
                      onPress={() => toggleDoshamType(opt.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      <Text style={[styles.checkLabel, checked && styles.checkLabelActive]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  subTitle: {
    fontSize:     13,
    fontWeight:   '400',
    color:        Colors.textMedium,
    marginBottom: 16,
  },

  // ── Yes / No — standard pill-chip pattern (Figma: h40, radius50, border #8a8a8a) ──
  yesNoRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },
  yesNoBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          40,
    borderRadius:    50,
    borderWidth:     1,
    borderColor:     Colors.borderNeutral,
    backgroundColor: Colors.surface,
    paddingLeft:     8,
    paddingRight:    16,
    gap:             8,
  },
  yesNoBtnActive: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },
  // Figma keeps the label black in both states — only the indicator turns red
  yesNoBtnText: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  yesNoBtnTextActive: {
    fontWeight: '500',
  },
  yesNoIcon: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    1.5,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
  },
  yesNoIconActive: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  yesNoCheckmark: {
    color:      Colors.surface,
    fontSize:   11,
    fontWeight: '700',
  },

  // ── Dosham type checkboxes — flat full-width rows (Figma: no card border/radius,
  // divider #e6e6e6, full-bleed #FFF1F5 when checked) ──
  checkList: { gap: 0 },

  checkRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    marginHorizontal:  -24,
    paddingHorizontal: 24,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  checkRowActive: {
    backgroundColor: Colors.selectionBg,
  },
  checkLabel: {
    flex:        1,
    fontSize:    14,
    fontWeight:  '400',
    color:       Colors.textPrimary,
    marginRight: 12,
  },
  // Figma keeps the label black when checked — only the weight changes
  checkLabelActive: {
    fontWeight: '500',
  },
  checkbox: {
    width:          20,
    height:         20,
    borderRadius:   4,
    borderWidth:    1.5,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  checkboxChecked: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  checkmark: {
    fontSize:   13,
    fontWeight: '700',
    color:      Colors.white,
    lineHeight: 16,
  },
})
