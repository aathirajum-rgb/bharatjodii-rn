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
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import {
  fetchRaasiOptions,
  fetchStarOptions,
  getRegValues,
  setRegValues,
  submitHoroscopeDetails,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os } from './onboardingStyles'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'star-raasi.svg'
const FOOTER_H      = 160

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }
type ActivePanel = 'raasi' | 'star' | null

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StarRaasiScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [raasiOptions, setRaasiOptions] = useState<Option[]>([])
  const [starOptions,  setStarOptions]  = useState<Option[]>([])

  const [selectedRaasi, setSelectedRaasi] = useState<Option | null>(null)
  const [selectedStar,  setSelectedStar]  = useState<Option | null>(null)

  const [fetchingRaasi, setFetchingRaasi] = useState(true)
  const [fetchingStar,  setFetchingStar]  = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [createdBy,     setCreatedBy]     = useState('1')
  const [activePanel,   setActivePanel]   = useState<ActivePanel>(null)

  useEffect(() => {
    getRegValues().then((rv) => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)

      fetchRaasiOptions()
        .then(list => {
          setRaasiOptions(list)
          if (rv.RAASI && list.length) {
            const found = list.find(o => o.key === rv.RAASI)
            if (found) {
              setSelectedRaasi(found)
              // Restore star selection for the saved raasi
              fetchStarOptions(rv.RAASI)
                .then(stars => {
                  setStarOptions(stars)
                  if (rv.STAR && stars.length) {
                    const foundStar = stars.find(o => o.key === rv.STAR)
                    if (foundStar) setSelectedStar(foundStar)
                  }
                })
                .catch(() => {})
            }
          }
        })
        .catch(() => {})
        .finally(() => setFetchingRaasi(false))
    })
  }, [])

  async function selectRaasi(opt: Option) {
    setSelectedRaasi(opt)
    setSelectedStar(null)
    setStarOptions([])
    setFetchingStar(true)
    try {
      const stars = await fetchStarOptions(opt.key)
      setStarOptions(stars)
    } catch {
      // user can retry by reopening star picker
    } finally {
      setFetchingStar(false)
    }
  }

  async function handleNext() {
    if (!selectedRaasi || !selectedStar || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({ RAASI: selectedRaasi.key, STAR: selectedStar.key })
      await submitHoroscopeDetails(selectedStar.key, selectedRaasi.key, '')
      navigation.push('onboarding', { pageNo: '32' })
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '32' })
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.STARRASSI', 'Select your #PROFILETYPE# rassi & star')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  const canNext    = !!selectedRaasi && !!selectedStar

  useOnboardingFooter({
    nextHidden: !canNext,
    nextDisabled: !canNext,
    nextLoading: submitting,
    onNext: handleNext,
    showSkip: !canNext,
    skipLabel: t('REG.DO_LATER', "I'll do this later"),
    onSkip: handleSkip,
  }, [canNext, submitting])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.screen}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={os.title}>
          {title}
        </Text>

        {fetchingRaasi ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.fields}>
            {/* ── Raasi field ──────────────────────────────────────────── */}
            <View style={styles.fieldWrapper}>
              <View style={styles.fieldLabelBadge}>
                <Text style={styles.fieldLabelText}>{t('REGISTRATION.RAASI', 'Raasi')}</Text>
              </View>
              <Pressable
                style={styles.selectField}
                onPress={() => setActivePanel('raasi')}
                accessibilityRole="button"
                accessibilityLabel="Select raasi"
              >
                <Text
                  style={[styles.selectFieldText, !!selectedRaasi && styles.selectFieldTextActive]}
                  numberOfLines={1}
                >
                  {selectedRaasi ? selectedRaasi.label : t('REGISTRATION.SELECTRASSI', 'Select Raasi')}
                </Text>
                <Text style={styles.selectFieldArrow}>›</Text>
              </Pressable>
            </View>

            {/* ── Star field — only after raasi is selected ─────────── */}
            {selectedRaasi && (
              fetchingStar ? (
                <ActivityIndicator color={Colors.primary} size="small" style={styles.starLoader} />
              ) : (
                <View style={[styles.fieldWrapper, styles.fieldGap]}>
                  <View style={styles.fieldLabelBadge}>
                    <Text style={styles.fieldLabelText}>{t('REGISTRATION.STAR', 'Star')}</Text>
                  </View>
                  <Pressable
                    style={styles.selectField}
                    onPress={() => setActivePanel('star')}
                    accessibilityRole="button"
                    accessibilityLabel="Select star"
                  >
                    <Text
                      style={[styles.selectFieldText, !!selectedStar && styles.selectFieldTextActive]}
                      numberOfLines={1}
                    >
                      {selectedStar ? selectedStar.label : t('REGISTRATION.SELECTSTAR', 'Select Star')}
                    </Text>
                    <Text style={styles.selectFieldArrow}>›</Text>
                  </Pressable>
                </View>
              )
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer handled globally via useOnboardingFooter */}

      {/* Raasi picker */}
      <SearchablePicker
        visible={activePanel === 'raasi'}
        title={t('REGISTRATION.RAASI', 'Select Raasi')}
        placeholder={t('REGISTRATION.SEARCHRASSI', 'Search raasi...')}
        options={raasiOptions}
        selectedKey={selectedRaasi?.key ?? null}
        onSelect={opt => { selectRaasi(opt); setActivePanel(null) }}
        onClose={() => setActivePanel(null)}
      />

      {/* Star picker */}
      <SearchablePicker
        visible={activePanel === 'star'}
        title={t('REGISTRATION.STAR', 'Select Star')}
        placeholder={t('REGISTRATION.SEARCHSTAR', 'Search star...')}
        options={starOptions}
        selectedKey={selectedStar?.key ?? null}
        onSelect={opt => { setSelectedStar(opt); setActivePanel(null) }}
        onClose={() => setActivePanel(null)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader:     { marginTop: 48 },
  starLoader: { marginTop: 20, alignSelf: 'flex-start' },

  fields: { gap: 0 },

  fieldWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  fieldGap: {
    marginTop: 32,
  },
  fieldLabelBadge: {
    position:          'absolute',
    top:               -8,
    left:              12,
    zIndex:            1,
    backgroundColor:   Colors.surface,
    paddingHorizontal: 4,
  },
  // Angular .floating body3-regular-12 black-color: black, not gray
  fieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },

  selectField: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          48,
    borderWidth:     1,
    borderColor:     Colors.inputBorder,
    borderRadius:    8,
    paddingLeft:     16,
    paddingRight:    12,
    backgroundColor: Colors.surface,
  },
  // Angular's placeholder/value span is always black-color; only weight toggles
  selectFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  selectFieldTextActive: {
    fontWeight: '500',
  },
  selectFieldArrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
  },

})
