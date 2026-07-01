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
  callRegistrationAPI,
  fetchReligionOptions,
  getRegValues,
  prefetchCasteForReligion,
  setRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, scrollPaddingBottom } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'religion-updated.svg'
const FOOTER_H      = 140

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReligionScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [allOptions,    setAllOptions]    = useState<Option[]>([])
  const [fetching,      setFetching]      = useState(true)
  const [selected,      setSelected]      = useState<Option | null>(null)
  const [createdBy,     setCreatedBy]     = useState('4')
  const [mothertongue,  setMothertongue]  = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [customerCare,  setCustomerCare]  = useState('')
  const [panelVisible,  setPanelVisible]  = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValues(),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([rv, cc]) => {
      if (rv.CREATEDBY)     setCreatedBy(rv.CREATEDBY)
      if (rv.MOTHERTONGUE)  setMothertongue(rv.MOTHERTONGUE)
      if (cc) setCustomerCare(cc)

      fetchReligionOptions()
        .then(list => {
          setAllOptions(list)
          if (rv.RELIGION) {
            const found = list.find(o => o.key === rv.RELIGION)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title      = `What is ${possessive} religion?`

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('RELIGION', selected.key)
      await callRegistrationAPI({ RELIGION: selected.key })
      navigation.push('onboarding', { pageNo: '14' })
    } catch {
      // Allow retry
    } finally {
      setSubmitting(false)
    }
  }

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
        <Image
          source={{ uri: CDN_PAGE_ICON }}
          style={os.pageIcon}
          contentFit="contain"
        />

        <Text style={[os.title, { marginBottom: 24 }]}>{title}</Text>

        {fetching ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          /* "Select religion" floating-label field — opens right-side panel */
          <View style={styles.fieldWrapper}>
            {/* Floating label */}
            <View style={styles.fieldLabelBadge}>
              <Text style={styles.fieldLabelText}>Religion</Text>
            </View>
            <Pressable
              style={styles.selectField}
              onPress={() => setPanelVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select religion"
            >
              <Text
                style={[styles.selectFieldText, !!selected && styles.selectFieldTextActive]}
                numberOfLines={1}
              >
                {selected ? selected.label : 'Select religion'}
              </Text>
              <Text style={styles.selectFieldArrow}>›</Text>
            </Pressable>
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
        <ButtonRevamp
          label={t('REGISTRATION.NEXTCTA', 'Next')}
          variant="primary"
          size="standard"
          fullWidth
          disabled={!selected}
          loading={submitting}
          onPress={handleNext}
        />

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

      {/* Religion picker */}
      <SearchablePicker
        visible={panelVisible}
        title="Select religion"
        placeholder="Search religion..."
        options={allOptions}
        selectedKey={selected?.key ?? null}
        onSelect={(opt) => {
          setSelected(opt)
          // Angular APIMODULENAME['RELIGION'] = 'CASTE' — fire caste prefetch immediately
          // so CasteScreen finds the list cached when it mounts.
          prefetchCasteForReligion(opt.key, mothertongue)
        }}
        onClose={() => setPanelVisible(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────


const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  // Floating-label field wrapper
  fieldWrapper: {
    position: 'relative',
    marginTop: 8,
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
    color:      Colors.scrimSubtle,
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
