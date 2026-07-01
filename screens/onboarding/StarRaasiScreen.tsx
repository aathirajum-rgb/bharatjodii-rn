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
import SearchablePicker from '../../components/searchable-picker/SearchablePicker'
import { Colors } from '../../constants/colors'
import { StorageKeys as SK } from '../../constants/storage.keys'
import {
  fetchRaasiOptions,
  fetchStarOptions,
  getRegValues,
  setRegValues,
  submitHoroscopeDetails,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, scrollPaddingBottom } from './onboardingStyles'

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
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [raasiOptions, setRaasiOptions] = useState<Option[]>([])
  const [starOptions,  setStarOptions]  = useState<Option[]>([])

  const [selectedRaasi, setSelectedRaasi] = useState<Option | null>(null)
  const [selectedStar,  setSelectedStar]  = useState<Option | null>(null)

  const [fetchingRaasi, setFetchingRaasi] = useState(true)
  const [fetchingStar,  setFetchingStar]  = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [customerCare,  setCustomerCare]  = useState('')
  const [createdBy,     setCreatedBy]     = useState('1')
  const [activePanel,   setActivePanel]   = useState<ActivePanel>(null)

  useEffect(() => {
    Promise.all([getRegValues(), getItem(SK.App.CUSTOMER_CARE)]).then(([rv, cc]) => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      if (cc) setCustomerCare(cc)

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

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const canNext    = !!selectedRaasi && !!selectedStar

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
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />

        <Text style={[os.title, { marginBottom: 24 }]}>
          {t('REG.SELECT_STAR_RAASI', `Select ${possessive} star & raasi`)}
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

      {/* Sticky footer */}
      <View
        style={[
          os.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
        ]}
      >
        {canNext ? (
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
  fieldLabelText: {
    fontSize:   12,
    fontWeight: '400',
    color:      Colors.textSecondary,
    lineHeight: 16,
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
  selectFieldText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textSecondary,
  },
  selectFieldTextActive: {
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  selectFieldArrow: {
    fontSize:   22,
    color:      Colors.textPrimary,
    lineHeight: 26,
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
