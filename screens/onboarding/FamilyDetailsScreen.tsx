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
  fetchFamilyOptions,
  getRegValue,
  setRegValues,
  submitFamilyDetails,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'family-details.svg'
const FOOTER_H = 160

const PROFILE_POSSESSIVE: Record<string, string> = {
  '4':  "son's",
  '5':  "daughter's",
  '8':  "brother's",
  '9':  "sister's",
  '10': "friend's",
  '11': "relative's",
}

const FALLBACK_BROTHERS = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: 'More than 5' },
  { key: '6', label: 'No brothers' },
]

const FALLBACK_SISTERS = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: 'More than 5' },
  { key: '6', label: 'No sisters' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FamilyDetailsScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [brotherOptions, setBrotherOptions] = useState<Option[]>([])
  const [sisterOptions,  setSisterOptions]  = useState<Option[]>([])
  const [fetching,       setFetching]       = useState(true)

  const [selBrothers,  setSelBrothers]  = useState<string | null>(null)
  const [selSisters,   setSelSisters]   = useState<string | null>(null)
  const [createdBy,    setCreatedBy]    = useState('1')
  const [customerCare, setCustomerCare] = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('BROTHERS'),
      getRegValue('SISTERS'),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([cb, br, si, cc]) => {
      if (cb) setCreatedBy(cb)
      if (br) setSelBrothers(br)
      if (si) setSelSisters(si)
      if (cc) setCustomerCare(cc)

      fetchFamilyOptions()
        .then(({ brothers, sisters }) => {
          setBrotherOptions(brothers.length ? brothers : FALLBACK_BROTHERS)
          setSisterOptions(sisters.length  ? sisters  : FALLBACK_SISTERS)
        })
        .catch(() => {
          setBrotherOptions(FALLBACK_BROTHERS)
          setSisterOptions(FALLBACK_SISTERS)
        })
        .finally(() => setFetching(false))
    })
  }, [])

  const possessive = PROFILE_POSSESSIVE[createdBy]
  const title = possessive
    ? `Add your ${possessive} family details`
    : 'Add family details'

  const isReady = !!(selBrothers && selSisters)

  async function handleNext() {
    if (!isReady || submitting) return
    setSubmitting(true)
    try {
      await setRegValues({ BROTHERS: selBrothers!, SISTERS: selSisters! })
      await submitFamilyDetails(selBrothers!, selSisters!)
      navigation.push('onboarding', { pageNo: '28' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '28' })
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

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <>
            {/* Brothers section */}
            <Text style={styles.sectionLabel}>No of brothers</Text>
            <View style={styles.chipGrid}>
              {brotherOptions.map(opt => {
                const isSelected = selBrothers === opt.key
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelBrothers(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt.label}
                  >
                    <View style={[styles.chipIcon, isSelected && styles.chipIconSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Sisters section */}
            <Text style={[styles.sectionLabel, styles.sectionLabelSpacing]}>No of sisters</Text>
            <View style={styles.chipGrid}>
              {sisterOptions.map(opt => {
                const isSelected = selSisters === opt.key
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelSisters(opt.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={opt.label}
                  >
                    <View style={[styles.chipIcon, isSelected && styles.chipIconSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
        ]}
      >
        <ButtonRevamp
          label={t('REGISTRATION.NEXTCTA', 'Next')}
          variant="primary"
          size="standard"
          fullWidth
          disabled={!isReady}
          loading={submitting}
          onPress={handleNext}
        />

        <Pressable style={styles.skipRow} onPress={handleSkip}>
          <Text style={styles.skipText}>{"I'll do this later"}</Text>
          <Text style={styles.skipArrow}>›</Text>
        </Pressable>

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
    marginBottom: 24,
  },

  loader: { marginTop: 48 },

  sectionLabel: {
    fontSize:     16,
    fontWeight:   '500',
    color:        Colors.textPrimary,
    marginBottom: 16,
  },
  sectionLabelSpacing: {
    marginTop: 28,
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },

  chip: {
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
  chipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },

  chipIcon: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     Colors.borderNeutral,
    alignItems:      'center',
    justifyContent:  'center',
  },
  chipIconSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },

  checkmark: {
    color:      Colors.surface,
    fontSize:   11,
    fontWeight: '700',
    lineHeight: 13,
  },

  chipLabel: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
    lineHeight: 16,
  },
  chipLabelSelected: {
    fontWeight: '500',
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
    marginTop:      12,
    gap:            2,
  },
  skipText: {
    fontSize:   14,
    fontWeight: '400',
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
