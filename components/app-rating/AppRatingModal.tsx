// "Rate our app" popup — Angular: components/app-rating/app-rating.component.
// Star picker → Play Store redirect (>=4 stars) or a feedback form (<4 stars) → thanks.
import Constants from 'expo-constants'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Linking, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { submitRating } from '../../service/appRatingService'
import { Colors } from '../../constants/colors'

const DEFAULT_PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=jodii.app'

type Step = 'rate' | 'playstore' | 'feedback' | 'thanks'

export default function AppRatingModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [step,     setStep]     = useState<Step>('rate')
  const [stars,    setStars]    = useState(0)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (visible) {
      setStep('rate')
      setStars(0)
      setFeedback('')
    }
  }, [visible])

  async function handleSubmitStars() {
    if (stars === 0) return
    if (stars >= 4) {
      await submitRating(stars)
      setStep('playstore')
    } else {
      setStep('feedback')
    }
  }

  async function handleSubmitFeedback() {
    await submitRating(stars, feedback)
    setStep('thanks')
    setTimeout(onClose, 1200)
  }

  function handleRateUs() {
    const url = String(Constants.expoConfig?.extra?.['playStoreUrl'] ?? DEFAULT_PLAYSTORE_URL)
    Linking.openURL(url)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.card}>
          {step === 'rate' && (
            <>
              <Text style={s.title}>{t('STAR_RATING.HDR_RATING')}</Text>
              <View style={s.starRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Pressable key={n} onPress={() => setStars(n)} hitSlop={4}>
                    <Text style={[s.star, n <= stars && s.starFilled]}>★</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[s.primaryBtn, stars === 0 && s.primaryBtnDisabled]}
                onPress={handleSubmitStars}
                disabled={stars === 0}
              >
                <Text style={s.primaryBtnText}>{t('STAR_RATING.SUBMIT')}</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={s.link}>{t('STAR_RATING.SKIP')}</Text>
              </Pressable>
            </>
          )}

          {step === 'playstore' && (
            <>
              <Text style={s.title}>{t('STAR_RATING.THANK_YOU')}</Text>
              <Text style={s.note}>{t('STAR_RATING.PLAY_STORE_CNT')}</Text>
              <Pressable style={s.primaryBtn} onPress={handleRateUs}>
                <Text style={s.primaryBtnText}>{t('STAR_RATING.RATE_US')}</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={s.link}>{t('STAR_RATING.SKIP')}</Text>
              </Pressable>
            </>
          )}

          {step === 'feedback' && (
            <>
              <Text style={s.title}>{t('STAR_RATING.FEEDBACK_TITLE')}</Text>
              <TextInput
                style={s.textArea}
                placeholder={t('STAR_RATING.TEXTAREA')}
                placeholderTextColor={Colors.textPlaceholder}
                value={feedback}
                onChangeText={setFeedback}
                multiline
              />
              <Pressable style={s.primaryBtn} onPress={handleSubmitFeedback}>
                <Text style={s.primaryBtnText}>{t('STAR_RATING.SUBMIT')}</Text>
              </Pressable>
            </>
          )}

          {step === 'thanks' && (
            <>
              <Text style={s.title}>{t('STAR_RATING.RATING_THANK')}</Text>
              <Text style={s.note}>{t('STAR_RATING.THANK_NOTE')}</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: {
    flex:            1,
    backgroundColor: Colors.scrim,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  card: {
    width:             '100%',
    maxWidth:          360,
    backgroundColor:   Colors.surface,
    borderRadius:      16,
    padding:           24,
    alignItems:        'center',
    gap:               16,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   17,
    color:      Colors.textDark,
    textAlign:  'center',
  },
  note: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.textSecondary,
    textAlign:  'center',
  },
  starRow: {
    flexDirection: 'row',
    gap:           8,
  },
  star: {
    fontSize: 32,
    color:    Colors.borderSoft,
  },
  starFilled: {
    color: Colors.primary,
  },
  primaryBtn: {
    backgroundColor:   Colors.primary,
    borderRadius:      8,
    paddingVertical:   12,
    paddingHorizontal: 24,
    alignSelf:         'stretch',
    alignItems:        'center',
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  primaryBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   14,
    color:      Colors.white,
  },
  link: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.textSecondary,
  },
  textArea: {
    alignSelf:         'stretch',
    minHeight:         80,
    borderWidth:       1,
    borderColor:       Colors.borderSoft,
    borderRadius:      8,
    padding:           12,
    fontFamily:        'Poppins-Regular',
    fontSize:          13,
    color:             Colors.textDark,
    textAlignVertical: 'top',
  },
})
