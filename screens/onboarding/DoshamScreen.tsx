import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Linking,
  Platform,
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
  const { t }  = useTranslation()

  const [options,    setOptions]    = useState<Option[]>([])
  const [selected,   setSelected]   = useState<Option | null>(null)
  const [fetching,   setFetching]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [createdBy,  setCreatedBy]  = useState('1')

  // star + raasi are needed to submit dosham
  const [star,  setStar]  = useState('')
  const [raasi, setRaasi] = useState('')

  useEffect(() => {
    getRegValues().then((rv) => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      if (rv.STAR)  setStar(rv.STAR)
      if (rv.RAASI) setRaasi(rv.RAASI)

      fetchDoshamOptions(rv.STAR ?? '', rv.RAASI ?? '')
        .then(({ dosham }) => {
          setOptions(dosham)
          if (rv.DOSHAM && dosham.length) {
            const found = dosham.find(o => o.key === rv.DOSHAM)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('DOSHAM', selected.key)
      await submitHoroscopeDetails(star, raasi, selected.key)
      // Angular registration-revamp.component.ts:1375 — autoLogin after registration completes.
      // Upgrades weak OTP tokens to strong Level-2 tokens. Update timestamp so 1hr gate resets.
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
    nextHidden: !selected,
    nextDisabled: !selected,
    nextLoading: submitting,
    onNext: handleNext,
    showSkip: !selected,
    skipLabel: t('REG.DO_LATER', "I'll do this later"),
    onSkip: handleSkip
  }, [selected, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={[os.title, { marginBottom: 8 }]}>
          {title}
        </Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.radioList}>
            {options.map(opt => {
              const isSelected = selected?.key === opt.key
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.radioRow, isSelected && styles.radioRowSelected]}
                  onPress={() => setSelected(opt)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.radio, isSelected && styles.radioChecked]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  radioList: { gap: 12 },

  radioRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       Colors.borderSoft,
    backgroundColor:   Colors.surface,
  },
  radioRowSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },

  radioLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '400',
    color:      Colors.textPrimary,
    lineHeight: 20,
    marginRight: 12,
  },
  radioLabelSelected: {
    fontWeight: '500',
  },

  radio: {
    width:          22,
    height:         22,
    borderRadius:   11,
    borderWidth:    1.5,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  radioChecked: {
    borderColor: Colors.primaryDark,
  },
  radioDot: {
    width:           12,
    height:          12,
    borderRadius:    6,
    backgroundColor: Colors.primaryDark,
  },

  divider: {
    height:          1,
    backgroundColor: Colors.inputBorder,
    marginTop:       16,
    marginBottom:    16,
  },
  helpRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
  },
  helpText: {
    fontSize:      14,
    fontWeight:    '400',
    color:         Colors.textPrimary,
    letterSpacing: 0.42,
  },
  helpPhone: {
    fontSize:      14,
    fontWeight:    '500',
    color:         Colors.link,
    letterSpacing: 0.42,
  },
})
