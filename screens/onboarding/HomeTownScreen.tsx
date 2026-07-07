import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import {
  callPartialRegistrationAPI,
  getRegValues,
  setRegValues,
} from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_PAGE_ICON = CDN_REG + 'location.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type YesNo = 'yes' | 'no' | null

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeTownScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const [createdBy,       setCreatedBy]       = useState('4')
  const [homeTownSame,    setHomeTownSame]    = useState<YesNo>(null)
  const [currentStateKey, setCurrentStateKey] = useState('')
  const [currentCityKey,  setCurrentCityKey]  = useState('')
  const [submitting,      setSubmitting]      = useState(false)

  useEffect(() => {
    getRegValues().then(rv => {
      if (rv.CREATEDBY) setCreatedBy(rv.CREATEDBY)
      setCurrentStateKey(rv.STATE ?? '')
      setCurrentCityKey(rv.CITY ?? '')
      if (rv.HOMETOWN === '1') setHomeTownSame('yes')
      else if (rv.HOMETOWN === '2') setHomeTownSame('no')
    })
  }, [])

  async function handleNext() {
    if (!homeTownSame || submitting) return
    setSubmitting(true)
    try {
      if (homeTownSame === 'yes') {
        await setRegValues({ HOMETOWN: '1', HOMESTATE: currentStateKey, HOMECITY: currentCityKey })
        navigation.push('onboarding', { pageNo: '10' })
        callPartialRegistrationAPI()
      } else {
        await setRegValues({ HOMETOWN: '2', HOMESTATE: '', HOMECITY: '' })
        navigation.push('onboarding', { pageNo: '44' })
      }
    } catch {
      // allow retry
    } finally {
      setSubmitting(false)
    }
  }

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.HOMETOWN', 'Select your #PROFILETYPE# hometown')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  useOnboardingFooter(
    { nextDisabled: !homeTownSame, nextLoading: submitting, onNext: handleNext },
    [homeTownSame, submitting],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: CDN_PAGE_ICON }} style={os.pageIcon} contentFit="contain" />
        <Text style={[os.title, { marginBottom: 32 }]}>{title}</Text>

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
})
