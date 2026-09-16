// Full-screen connectivity gate. Neither legacy app had a single unified
// "offline screen" — Angular (network.service.ts / httpservice.service.ts)
// only showed a transient toast per failed API call, and the Android app only
// showed inline per-screen banners/dialogs (splash screen, login toast, photo
// upload retry card). This RN port intentionally blocks the whole app instead,
// as a single Modal mounted once in App.tsx (see NetworkContext.tsx), so every
// screen and action is covered without needing its own per-screen guard.
//
// No CDN illustration exists for this state (checked imgs.bharatjodii.com for the
// obvious filenames — 404 on all of them), so the icon is drawn inline with
// react-native-svg instead of CdnSvg.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'

function NoWifiIcon({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Path
        d="M14 34C27 22 40 16 48 16C56 16 69 22 82 34"
        stroke={Colors.borderNeutral} strokeWidth={4} strokeLinecap="round" fill="none"
      />
      <Path
        d="M26 48C33 41 41 38 48 38C55 38 63 41 70 48"
        stroke={Colors.borderNeutral} strokeWidth={4} strokeLinecap="round" fill="none"
      />
      <Path
        d="M38 62C41 58 44 56 48 56C52 56 55 58 58 62"
        stroke={Colors.borderNeutral} strokeWidth={4} strokeLinecap="round" fill="none"
      />
      <Circle cx={48} cy={74} r={4} fill={Colors.borderNeutral} />
      <Line x1={14} y1={16} x2={82} y2={78} stroke={Colors.primaryDark} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  )
}

type Props = {
  visible:  boolean
  onRetry:  () => void
}

export default function OfflineScreen({ visible, onRetry }: Props) {
  const { t } = useTranslation()
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    if (retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        <NoWifiIcon size={96} />
        <Text style={styles.title}>{t('GENERAL.OFFLINE_TITLE')}</Text>
        <Text style={styles.message}>{t('GENERAL.NOINTERNET')}</Text>
        <Pressable style={styles.btn} onPress={handleRetry} disabled={retrying} accessibilityRole="button">
          <Text style={styles.btnLabel}>{t('GENERAL.TRY_AGAIN')}</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    backgroundColor:   Colors.surface,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    gap:               16,
  },
  title: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   FontSize.font18,
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  message: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font14,
    color:      Colors.textSecondary,
    textAlign:  'center',
  },
  btn: {
    marginTop:         8,
    borderWidth:       1,
    borderColor:       Colors.primaryDark,
    borderRadius:      8,
    paddingHorizontal: 32,
    paddingVertical:   12,
  },
  btnLabel: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium,
    fontSize:   FontSize.font14,
    color:      Colors.textDark,
  },
})
