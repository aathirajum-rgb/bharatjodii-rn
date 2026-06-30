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
  fetchPropertyOptions,
  getRegValue,
  getRegValues,
  setRegValue,
  submitPropertyDetails,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'property.svg'
const FOOTER_H = 160

const PROFILE_POSSESSIVE: Record<string, string> = {
  '4':  "son's",
  '5':  "daughter's",
  '8':  "brother's",
  '9':  "sister's",
  '10': "friend's",
  '11': "relative's",
}

const FALLBACK_OPTIONS = [
  { key: '1', label: 'Flat/Apartment' },
  { key: '2', label: 'Independent House/Villa' },
  { key: '3', label: 'Independent/Builder Floor' },
  { key: '4', label: 'Farm House' },
  { key: '5', label: 'Agricultural Land' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PropertyDetailsScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [options,      setOptions]      = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [createdBy,    setCreatedBy]    = useState('1')
  const [customerCare, setCustomerCare] = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValues(),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([regVals, cc]) => {
      if (regVals.CREATEDBY) setCreatedBy(regVals.CREATEDBY)
      if (cc) setCustomerCare(cc)

      // Restore previously selected properties (stored as array or ~-separated string)
      const existing = regVals.PROPERTIES
      if (existing) {
        const keys = Array.isArray(existing)
          ? existing
          : String(existing).split('~').filter(Boolean)
        setSelected(new Set(keys))
      }

      fetchPropertyOptions()
        .then(list => setOptions(list.length ? list : FALLBACK_OPTIONS))
        .catch(() => setOptions(FALLBACK_OPTIONS))
        .finally(() => setFetching(false))
    })
  }, [])

  const possessive = PROFILE_POSSESSIVE[createdBy]
  const title = possessive
    ? `Select your ${possessive} property details`
    : 'Select property details'

  function toggleOption(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleNext() {
    if (submitting) return
    setSubmitting(true)
    try {
      const keys = Array.from(selected)
      await setRegValue('PROPERTIES', keys as any)
      if (keys.length > 0) await submitPropertyDetails(keys)
      navigation.push('onboarding', { pageNo: '29' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '29' })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <AppHeader
        type="registration"
        showBackBtn={navigation.canGoBack()}
        onBackPress={() => navigation.goBack()}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: FOOTER_H + (Platform.OS === 'ios' ? insets.bottom : 20) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={styles.pageIcon}
          contentFit="contain"
        />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{t('REG.CHOOSEMORE', 'You can choose more than one')}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.checkList}>
            {options.map(opt => {
              const isChecked = selected.has(opt.key)
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.checkItem, isChecked && styles.checkItemSelected]}
                  onPress={() => toggleOption(opt.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={[styles.checkLabel, isChecked && styles.checkLabelSelected]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.checkbox, isChecked && styles.checkboxSelected]}>
                    {isChecked && <Text style={styles.checkmark}>✓</Text>}
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
          styles.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
        ]}
      >
        {selected.size > 0 ? (
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

const CHECKED_BG     = 'rgba(181, 0, 51, 0.02)'
const CHECKED_BORDER = 'rgba(181, 0, 51, 0.4)'

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },
  flex1: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        24,
  },

  pageIcon: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   28,
    marginBottom: 8,
  },

  subtitle: {
    fontSize:     14,
    fontWeight:   '400',
    color:        Colors.textSecondary ?? '#888',
    lineHeight:   20,
    marginBottom: 24,
  },

  loader: { marginTop: 48 },

  checkList: {
    gap: 12,
  },

  // Row: label left, checkbox right
  checkItem: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       '#d0d0d0',
    backgroundColor:   Colors.surface,
  },
  checkItemSelected: {
    borderColor:     CHECKED_BORDER,
    backgroundColor: CHECKED_BG,
  },

  checkLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '400',
    color:      Colors.textPrimary,
    lineHeight: 20,
    marginRight: 12,
  },
  checkLabelSelected: {
    fontWeight: '500',
  },

  checkbox: {
    width:           24,
    height:          24,
    borderRadius:    6,
    borderWidth:     1.5,
    borderColor:     '#8a8a8a',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  checkboxSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },

  checkmark: {
    color:      Colors.surface,
    fontSize:   13,
    fontWeight: '700',
    lineHeight: 16,
  },

  // Sticky footer
  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    paddingTop:        20,
    backgroundColor:   Colors.surface,
  },

  skipRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap:            4,
  },
  skipText: {
    fontSize:   15,
    fontWeight: '500',
    color:      'rgba(0,0,0,0.55)',
  },
  skipArrow: {
    fontSize:   18,
    color:      'rgba(0,0,0,0.55)',
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
    color:         '#29339b',
    letterSpacing: 0.42,
  },
})
