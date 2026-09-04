// Survey popup — Angular: components/middlepopup/middlepopup.component (action:'surveyPopup'),
// middlepopup.component.html:196-236.
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { submitSurvey, type SurveyPopupData } from '../../service/surveyService'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

export default function SurveyPopup({
  visible, data, onClose,
}: {
  visible: boolean
  data:    SurveyPopupData | null
  onClose: () => void
}) {
  async function handleTakeSurvey() {
    if (!data) return
    if (data.link) {
      Linking.openURL(data.link).catch(e => {
        if (__DEV__) console.error('[SurveyPopup] open link error:', e)
      })
    }
    if (data.surveyId) await submitSurvey(data.surveyId)
    onClose()
  }

  if (!data) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.card}>
          <Pressable style={s.close} onPress={onClose} hitSlop={8}>
            <Text style={s.closeText}>✕</Text>
          </Pressable>
          <Text style={s.title}>{data.title}</Text>
          {!!data.subtitle1 && <Text style={s.subtitle}>{data.subtitle1}</Text>}
          {!!data.subtitle2 && <Text style={s.subtitle}>{data.subtitle2}</Text>}
          <Pressable style={s.cta} onPress={handleTakeSurvey}>
            <Text style={s.ctaText}>{data.cta}</Text>
          </Pressable>
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
    width:           '100%',
    maxWidth:        360,
    backgroundColor: Colors.surface,
    borderRadius:    16,
    padding:         24,
    alignItems:      'center',
    gap:             12,
  },
  close: {
    position: 'absolute',
    top:      12,
    right:    12,
  },
  closeText: {
    fontSize: 16,
    color:    Colors.textMedium,
  },
  title: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   17,
    color:      Colors.textDark,
    textAlign:  'center',
    marginTop:  8,
  },
  subtitle: {
    fontFamily: SemanticFontsEnglish.subheadingEnglishRegular,
    fontSize:   13,
    color:      Colors.textSecondary,
    textAlign:  'center',
  },
  cta: {
    backgroundColor:   Colors.primary,
    borderRadius:      8,
    paddingVertical:   12,
    paddingHorizontal: 24,
    alignSelf:         'stretch',
    alignItems:        'center',
    marginTop:         8,
  },
  ctaText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   14,
    color:      Colors.white,
  },
})
