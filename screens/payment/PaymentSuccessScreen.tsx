import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { navigate } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import { Colors } from '../../constants/colors'

export default function PaymentSuccessScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.subtitle}>Your membership is now active.</Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigate(ENavigation.MATCHES)}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>View Matches</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, padding: 32, gap: 16 },
  icon:      { fontSize: 64 },
  title:     { fontSize: 24, fontWeight: '700', color: Colors.textStrong, textAlign: 'center' },
  subtitle:  { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  btn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
