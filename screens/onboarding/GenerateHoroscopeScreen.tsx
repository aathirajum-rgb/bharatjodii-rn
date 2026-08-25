import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Colors } from '../../constants/colors'
import { getRegValue } from '../../service/registrationService'
import { CDN_REG } from '../../constants/cdn'
import { PROFILE_POSSESSIVE } from '../../constants/registration.constants'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────
// Angular pageType 29 — "Generate Horoscope" prompt. The Figma illustration is a
// large zodiac wheel (not the standard small 48×48 top-left page icon every
// other onboarding screen uses).
const CDN_ILLUSTRATION = CDN_REG + 'horoscope-generate.svg'

type Props = {
  navigation: any
  route: { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenerateHoroscopeScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation()

  const [createdBy, setCreatedBy] = useState('4')

  useEffect(() => {
    getRegValue('CREATEDBY').then(cb => { if (cb) setCreatedBy(cb) })
  }, [])

  const possessiveKey = PROFILE_POSSESSIVE[createdBy]?.toUpperCase()
  const translatedProfileType = possessiveKey ? t(`REGISTRATION.${possessiveKey}`) : ''
  const title = t('REGISTRATION.GENERATEHOROSCOPE', 'Generate #PROFILETYPE# horoscope')
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()
  const subtitle = t(
    'REGISTRATION.GENERATEHOROSCOPESUBTITLE',
    'Please give your #PROFILETYPE# time of birth and location to generate free horoscope',
  )
    .replace('#PROFILETYPE#', translatedProfileType)
    .replace('  ', ' ')
    .trim()

  // Primary CTA → birth-details step (30). Skip → straight to Dosham (32),
  // matching Angular's onBoardingSkip['29'] exactly (the whole horoscope
  // sub-flow, including Star/Raasi, is skippable as one unit).
  function handleNext() {
    navigation.push('onboarding', { pageNo: '30' })
  }

  function handleSkip() {
    navigation.push('onboarding', { pageNo: '32' })
  }

  useOnboardingFooter({
    nextLabel: t('REGISTRATION.GENERATEHOROSCOPECTA', 'Generate horoscope for FREE'),
    onNext:    handleNext,
    showSkip:  true,
    skipLabel: t('REG.DO_LATER', "I'll do this later"),
    onSkip:    handleSkip,
    // i18n.language: both labels are translated, so re-push footer state on a
    // language change — otherwise the CTA keeps the wording from mount time.
  }, [i18n.language])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={os.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: CDN_ILLUSTRATION }}
          style={styles.illustration}
          contentFit="contain"
        />

        <Text style={os.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  illustration: {
    width:        264,
    height:       264,
    alignSelf:    'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textPrimary,
  },
})
