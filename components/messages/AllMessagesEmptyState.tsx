// "All Messages" tab content — Angular: messager-list.component.ts's
// updateEmptyState() (JODII-499). Free members get the same paywall promo
// regardless of section (icon mobile_no_viewed_by_you.svg, MESSAGE_TEXT,
// BECOME_PAID CTA — Figma node 5:445, exact copy). Paid members with no
// conversations yet get a plain headline, no CTA (Angular clears both
// sub-content and CTA for this branch) — this is a placeholder until the
// real conversation list (Phase 4/5) replaces it for paid members.
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

interface Props {
  variant:    'paywall' | 'empty'
  onCtaPress?: (() => void) | undefined
  iconSize?:   number
}

export default function AllMessagesEmptyState({ variant, onCtaPress, iconSize = 140 }: Props) {
  const { t } = useTranslation()
  const isPaywall = variant === 'paywall'

  return (
    <View style={styles.container}>
      <CdnSvg
        uri={CDN_SVG + (isPaywall ? 'mobile_no_viewed_by_you.svg' : 'empty_msg_icon.svg')}
        width={iconSize}
        height={iconSize}
      />
      <Text style={styles.title}>
        {t(isPaywall ? 'MESSAGES.MESSAGE_TEXT' : 'MESSAGES.CONVERSATION_EMPTY')}
      </Text>
      {isPaywall && (
        <Pressable style={styles.btn} onPress={onCtaPress}>
          <Text style={styles.btnLabel}>{t('GENERAL.BECOME_PAID')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
    paddingTop:        40,
    gap:               16,
  },
  title: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   16,
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  btn: {
    marginTop:         8,
    borderWidth:       1,
    borderColor:       Colors.primaryDark,
    borderRadius:      8,
    paddingHorizontal: 24,
    paddingVertical:   12,
  },
  btnLabel: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      Colors.textDark,
  },
})
