// Home screen's "assist" / breather banner — Angular: <app-breather>, shown instead
// of (takes precedence over) the regular hero banner when PPSET's ASSISTEDFLAG=='1'
// and the user hasn't locally dismissed it this session (homeGating.ts's
// computeShowAssistBanner). Content comes from paymentService.getMenuPromo('MENU')'s
// ASSISTEDPROMO fields.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'

export interface AssistBannerContent {
  title:    string
  body:     string
  ctaLabel: string
}

export interface AssistBannerProps {
  content:   AssistBannerContent
  onPress:   () => void
  onDismiss: () => void
}

export default function AssistBanner({ content, onPress, onDismiss }: AssistBannerProps) {
  return (
    <View style={s.wrap}>
      <Pressable style={s.close} onPress={onDismiss} hitSlop={8}>
        <Text style={s.closeText}>✕</Text>
      </Pressable>
      {!!content.title && <Text style={s.title}>{content.title}</Text>}
      {!!content.body && <Text style={s.body}>{content.body}</Text>}
      <Pressable style={s.cta} onPress={onPress}>
        <Text style={s.ctaText}>{content.ctaLabel}</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor:   '#FFF6E8',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               6,
    minHeight:         120,
  },
  close: {
    position: 'absolute',
    top:      10,
    right:    12,
    zIndex:   1,
  },
  closeText: {
    fontSize: 16,
    color:    Colors.textSecondary,
  },
  title: {
    fontFamily:   'Poppins-SemiBold',
    fontSize:     15,
    color:        Colors.textPrimary,
    paddingRight: 20,
  },
  body: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      Colors.textSecondary,
  },
  cta: {
    alignSelf:         'flex-start',
    backgroundColor:   Colors.primary,
    borderRadius:      20,
    paddingVertical:   7,
    paddingHorizontal: 20,
    marginTop:         6,
  },
  ctaText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   13,
    color:      Colors.white,
  },
})
