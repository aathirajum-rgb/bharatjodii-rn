// "Do you need help?" support banner (Figma node 1034:6528) — Call + WhatsApp
// pill CTAs. Separate from mobile's HelpSection (HomeScreen.tsx) since the
// desktop card adds a WhatsApp button mobile's doesn't have.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

function WhatsAppIcon() {
  return (
    <View style={s.waIconWrap}>
      <Text style={s.waGlyph}>{'W'}</Text>
    </View>
  )
}

type Props = {
  phone: string
  whatsapp: string
  onCallPress: () => void
  onWhatsAppPress: () => void
}

export default function DesktopHelpSection({ phone, whatsapp, onCallPress, onWhatsAppPress }: Props) {
  return (
    <LinearGradient
      colors={['#ffffff', '#fff4f7']}
      start={{ x: 0.9, y: 0 }}
      end={{ x: 0.1, y: 1 }}
      style={s.card}
    >
      <View style={s.textCol}>
        <Text style={s.title}>Do you need help?</Text>
        <Text style={s.body}>
          Contact us on Call / WhatsApp{'\n'}
          Timing: <Text style={s.bold}>8 AM</Text> to <Text style={s.bold}>9 PM</Text> (all days)
        </Text>
      </View>
      <View style={s.btnRow}>
        <Pressable style={s.btn} onPress={onCallPress}>
          <Text style={s.callGlyph}>{'☎'}</Text>
          <Text style={s.btnText} numberOfLines={1}>Call us {phone}</Text>
        </Pressable>
        {!!whatsapp && (
          <Pressable style={s.btn} onPress={onWhatsAppPress}>
            <WhatsAppIcon />
            <Text style={s.btnText}>WhatsApp</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  card: {
    width:             '100%',
    borderWidth:       1,
    borderColor:       '#ffffff',
    borderRadius:      16,
    paddingVertical:   40,
    paddingHorizontal: 24,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               24,
  },
  textCol: { gap: 12, flexShrink: 1 },
  title: { fontFamily: Fonts.poppinsSemiBold, fontSize: 22, color: Colors.black },
  body:  { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, lineHeight: 20, color: Colors.black },
  bold:  { fontFamily: Fonts.poppinsSemiBold },

  btnRow: { flexDirection: 'row', gap: 16, flexShrink: 0 },
  btn: {
    width:             200,
    height:            40,
    borderWidth:       1,
    borderColor:       Colors.primaryDark,
    borderRadius:      30,
    paddingHorizontal: 16,
    paddingVertical:   4,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
  },
  btnText: { fontFamily: Fonts.poppinsRegular, fontSize: 12, color: Colors.black },

  waIconWrap: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center',
  },
  waGlyph:   { color: '#ffffff', fontSize: 10, fontFamily: Fonts.poppinsBold },
  callGlyph: { fontSize: 14, color: Colors.primaryDark },
})
