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
  fetchMotherTongueOptions,
  getRegValue,
  loadAndStoreStatesForMotherTongue,
  setRegValue,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, scrollPaddingBottom } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'mother-tongue.svg'
const FOOTER_H      = 140

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Strip Angular HTML from VALUE labels (e.g. <span>...</span>)
function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').trim()
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MotherTongueScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [allOptions,   setAllOptions]   = useState<Option[]>([])
  const [fetching,     setFetching]     = useState(true)
  const [selected,     setSelected]     = useState<Option | null>(null)
  const [createdBy,    setCreatedBy]    = useState('4')
  const [submitting,   setSubmitting]   = useState(false)
  const [customerCare, setCustomerCare] = useState('')
  const [panelVisible,   setPanelVisible]   = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('MOTHERTONGUE'),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([cb, savedMT, cc]) => {
      if (cb) setCreatedBy(cb)
      if (cc) setCustomerCare(cc)

      fetchMotherTongueOptions()
        .then(list => {
          const cleaned = list.map(o => ({ key: o.key, label: stripHtml(o.label) }))
          setAllOptions(cleaned)
          // Restore prior selection (back navigation)
          if (savedMT) {
            const found = cleaned.find(o => o.key === savedMT)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title      = `What is ${possessive} mother tongue?`

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('MOTHERTONGUE', selected.key)
      // Angular loadStateList(): type=MOTHERTONGUE&MOTHERTONGUE=<key> → stores STATEOBJ
      // in REGISTRATIONARRAYS so page 9 can read the state list immediately.
      await Promise.all([
        callRegistrationAPI({ MOTHERTONGUE: selected.key }),
        loadAndStoreStatesForMotherTongue(selected.key),
      ])
      navigation.push('onboarding', { pageNo: '9' })
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
          /* "Select mother tongue" field — opens right-side panel */
          <Pressable
            style={[styles.selectField, !!selected && styles.selectFieldActive]}
            onPress={() => setPanelVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select mother tongue"
          >
            <Text
              style={[styles.selectFieldText, !!selected && styles.selectFieldTextActive]}
              numberOfLines={1}
            >
              {selected ? selected.label : 'Select mother tongue'}
            </Text>
            <Text style={styles.selectFieldArrow}>›</Text>
          </Pressable>
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

      {/* Mother tongue picker */}
      <SearchablePicker
        visible={panelVisible}
        title="Select language"
        placeholder="Search language..."
        options={allOptions}
        selectedKey={selected?.key ?? null}
        onSelect={(opt) => setSelected(opt)}
        onClose={() => setPanelVisible(false)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────


const styles = StyleSheet.create({
  loader: { marginTop: 48 },

  // "Select mother tongue" outlined field — same style as exact height field
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
  selectFieldActive: {},
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
