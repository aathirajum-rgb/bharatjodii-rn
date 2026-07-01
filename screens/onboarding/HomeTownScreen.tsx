import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
  callRegistrationAPI,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { getItem } from '../../service/storageService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { os, scrollPaddingBottom } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'location.svg'
const FOOTER_H      = 160

// ─── Types ────────────────────────────────────────────────────────────────────

type YesNo = 'yes' | 'no' | null

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeTownScreen({ navigation }: Props) {
  const { t }  = useTranslation()
  const insets = useSafeAreaInsets()

  const [createdBy,       setCreatedBy]       = useState('4')
  const [customerCare,    setCustomerCare]    = useState('')
  const [homeTownSame,    setHomeTownSame]    = useState<YesNo>(null)
  const [currentStateKey, setCurrentStateKey] = useState('')
  const [currentCityKey,  setCurrentCityKey]  = useState('')
  const [submitting,      setSubmitting]      = useState(false)

  useEffect(() => {
    Promise.all([getRegValues(), getItem(SK.App.CUSTOMER_CARE)]).then(([rv, cc]) => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      if (cc) setCustomerCare(cc)
      setCurrentStateKey(rv.STATE ?? '')
      setCurrentCityKey(rv.CITY ?? '')
      // Restore previous selection when user navigates back
      if (rv.HOMETOWN === '1') setHomeTownSame('yes')
      else if (rv.HOMETOWN === '2') setHomeTownSame('no')
    })
  }, [])

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!homeTownSame || submitting) return
    setSubmitting(true)
    try {
      if (homeTownSame === 'yes') {
        // Hometown = current location → pre-fill HOMESTATE/HOMECITY and go to Qualification
        await setRegValues({ HOMETOWN: '1', HOMESTATE: currentStateKey, HOMECITY: currentCityKey })
        await callRegistrationAPI({ HOMESTATE: currentStateKey, HOMECITY: currentCityKey })
        navigation.push('onboarding', { pageNo: '10' })
      } else {
        // Hometown is different → clear and go to state/district picker (page 44)
        await setRegValues({ HOMETOWN: '2', HOMESTATE: '', HOMECITY: '' })
        navigation.push('onboarding', { pageNo: '44' })
      }
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const possessive = PROFILE_POSSESSIVE[createdBy] ?? 'their'
  const title      = t('REGISTRATION.HOME_TOWN_TXT', `Is ${possessive} home town same as current location?`)

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
        <Text style={[os.title, { marginBottom: 32 }]}>{title}</Text>

        {/* Yes / No chips */}
        <View style={styles.yesNoRow}>
          <Pressable
            style={[styles.yesNoChip, homeTownSame === 'yes' && styles.yesNoChipSelected]}
            onPress={() => setHomeTownSame('yes')}
            accessibilityRole="radio"
            accessibilityState={{ selected: homeTownSame === 'yes' }}
          >
            <View style={[styles.chipRadio, homeTownSame === 'yes' && styles.chipRadioSelected]}>
              {homeTownSame === 'yes' && <Text style={styles.chipRadioTick}>✓</Text>}
            </View>
            <Text style={[styles.yesNoLabel, homeTownSame === 'yes' && styles.yesNoLabelSelected]}>
              {t('GENERAL.YES', 'Yes')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.yesNoChip, homeTownSame === 'no' && styles.yesNoChipSelected]}
            onPress={() => setHomeTownSame('no')}
            accessibilityRole="radio"
            accessibilityState={{ selected: homeTownSame === 'no' }}
          >
            <View style={[styles.chipRadio, homeTownSame === 'no' && styles.chipRadioSelected]}>
              {homeTownSame === 'no' && <Text style={styles.chipRadioTick}>✓</Text>}
            </View>
            <Text style={[styles.yesNoLabel, homeTownSame === 'no' && styles.yesNoLabelSelected]}>
              {t('GENERAL.NO', 'No')}
            </Text>
          </Pressable>
        </View>
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
          disabled={!homeTownSame}
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
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  yesNoRow: {
    flexDirection: 'row',
    gap:           16,
    marginBottom:  28,
  },

  yesNoChip: {
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
  yesNoChipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.radioCheckedBg,
  },

  chipRadio: {
    width:          20,
    height:         20,
    borderRadius:   10,
    borderWidth:    1.5,
    borderColor:    Colors.borderNeutral,
    alignItems:     'center',
    justifyContent: 'center',
  },
  chipRadioSelected: {
    borderColor:     Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  chipRadioTick: {
    color:      Colors.surface,
    fontSize:   11,
    fontWeight: '700',
    lineHeight: 13,
  },

  yesNoLabel: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
  yesNoLabelSelected: {
    fontWeight: '500',
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
