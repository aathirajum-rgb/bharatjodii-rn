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
import RegistrationSuccessSheet from '../../components/registration-success-sheet/RegistrationSuccessSheet'
import {
  callRegistrationAPI,
  fetchGothraOptions,
  getRegValue,
  setRegValue,
} from '../../service/registrationService'
import { getItem, setItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, scrollPaddingBottom } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'gothra.svg'
const FOOTER_H      = 140

// ─── Types ────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string }

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GothraScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [allOptions,    setAllOptions]    = useState<Option[]>([])
  const [fetching,      setFetching]      = useState(true)
  const [selected,      setSelected]      = useState<Option | null>(null)
  const [createdBy,     setCreatedBy]     = useState('4')
  const [submitting,    setSubmitting]    = useState(false)
  const [customerCare,  setCustomerCare]  = useState('')
  const [panelVisible,   setPanelVisible]   = useState(false)
  const [successVisible, setSuccessVisible] = useState(false)

  useEffect(() => {
    Promise.all([
      getRegValue('CREATEDBY'),
      getRegValue('GOTHRA'),
      getItem(SK.App.CUSTOMER_CARE),
    ]).then(([cb, savedGothra, cc]) => {
      if (cb) setCreatedBy(cb)
      if (cc) setCustomerCare(cc)

      fetchGothraOptions()
        .then(list => {
          setAllOptions(list)
          if (savedGothra) {
            const found = list.find(o => o.key === savedGothra)
            if (found) setSelected(found)
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false))
    })
  }, [])

  // ─── Derived ──────────────────────────────────────────────────────────────

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title      = `Select ${possessive} gothram`

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await setRegValue('GOTHRA', selected.key)
      const res = await callRegistrationAPI({ GOTHRA: selected.key })
      const matriId = res?.RESPONSE?.MATRIID
      if (matriId) {
        await setItem(SK.Auth.USER_ID, String(matriId))
        setSuccessVisible(true)
      } else {
        navigation.push('onboarding', { pageNo: '20' })
      }
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
          <Pressable
            style={styles.selectField}
            onPress={() => setPanelVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select gothram"
          >
            <Text
              style={[styles.selectFieldText, !!selected && styles.selectFieldTextActive]}
              numberOfLines={1}
            >
              {selected ? selected.label : 'Select Gothram'}
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

      <RegistrationSuccessSheet
        visible={successVisible}
        onContinue={() => {
          setSuccessVisible(false)
          navigation.push('onboarding', { pageNo: '20' })
        }}
      />

      {/* Gothram picker */}
      <SearchablePicker
        visible={panelVisible}
        title="Select gothram"
        placeholder="Search gothram..."
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
