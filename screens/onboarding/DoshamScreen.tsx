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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../../components/app-header/AppHeader'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import {
  fetchDoshamOptions,
  getRegValues,
  setRegValue,
  submitHoroscopeDetails,
} from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'
import { refreshSession } from '../../service/homeService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, scrollPaddingBottom } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'dosham.svg'
const FOOTER_H      = 160

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DoshamScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [options,      setOptions]      = useState<Option[]>([])
  const [selected,     setSelected]     = useState<Option | null>(null)
  const [fetching,     setFetching]     = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [customerCare, setCustomerCare] = useState('')
  const [createdBy,    setCreatedBy]    = useState('1')

  // star + raasi are needed to submit dosham
  const [star,  setStar]  = useState('')
  const [raasi, setRaasi] = useState('')

  useEffect(() => {
    Promise.all([getRegValues(), getItem(SK.App.CUSTOMER_CARE)]).then(([rv, cc]) => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      if (cc) setCustomerCare(cc)
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

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={os.flex1}
        contentContainerStyle={[
          os.scrollContent,
          { paddingBottom: scrollPaddingBottom(insets.bottom, FOOTER_H) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={[os.title, { marginBottom: 8 }]}>
          {t('REGISTRATION.SELECTDOSHAM', `Select ${possessive} dosham`)}
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

      {/* Sticky footer */}
      <View
        style={[
          os.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
        ]}
      >
        {selected ? (
          <ButtonRevamp
            label={t('REGISTRATION.NEXTCTA', 'Next')}
            variant="primary"
            size="standard"
            fullWidth
            loading={submitting}
            onPress={handleNext}
          />
        ) : (
          <Pressable style={styles.skipRow} onPress={handleSkip}>
            <Text style={styles.skipText}>{t('REG.DO_LATER', "I'll do this later")}</Text>
            <Text style={styles.skipArrow}>›</Text>
          </Pressable>
        )}

        {!!customerCare && (
          <>
            <View style={styles.divider} />
            <Pressable
              style={styles.helpRow}
              onPress={() => Linking.openURL(`tel:${customerCare}`)}
            >
              <Text style={styles.helpText}>Need help?  Call</Text>
              <Text style={styles.helpPhone}>{customerCare}</Text>
            </Pressable>
          </>
        )}
      </View>
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

  skipRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 14,
    gap:             4,
  },
  skipText: {
    fontSize:   15,
    fontWeight: '500',
    color:      Colors.scrim,
  },
  skipArrow: {
    fontSize:   18,
    color:      Colors.scrim,
    lineHeight: 22,
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
