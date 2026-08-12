// Desktop layout for the delete/hide success toast (Figma "Jodii Desktop -
// Registration", UaPAN9aG6MfZf6CRpwXf1L, node 665:107496 — "Profile deleted
// successfully!" — and node 665:112860 — "Your profile is hidden for X").
// Not wrapped in DesktopPageShell (no sidebar/nav) — DeleteProfileSuccessScreen.tsx
// clears the whole session ~2.5s after mount either way (delete AND hide both
// end it), so showing the normal signed-in chrome behind a screen that's about
// to log the user out would be misleading rather than helpful.
import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'

export interface DeleteProfileSuccessDesktopLayoutProps {
  message: string
}

export default function DeleteProfileSuccessDesktopLayout({ message }: DeleteProfileSuccessDesktopLayoutProps) {
  return (
    <View style={s.overlay}>
      <View style={s.card}>
        <View style={s.iconWrap}>
          <Text style={s.iconCheck}>✓</Text>
        </View>
        <Text style={s.message}>{message}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 360, backgroundColor: Colors.white, borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 16,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#e8f8ee',
    alignItems: 'center', justifyContent: 'center',
  },
  iconCheck: { fontSize: 28, color: '#1a9c4a', fontWeight: '700' },
  message: {
    fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black, textAlign: 'center', lineHeight: 22,
  },
})
