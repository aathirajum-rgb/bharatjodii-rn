import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Colors } from '../../constants/colors'
import {
  getCheckoutDetails,
  getPaymentConfig,
  getRechargePackages,
  handlePaymentSuccess,
  initRazorpayPayment,
  recordPaymentFailure,
} from '../../service/paymentService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Package {
  PACKAGEID: string
  PACKAGENAME: string
  AMOUNT: string
  VALIDITY: string
  DESCRIPTION?: string
  POPULAR?: string
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RechargeScreen() {
  const [packages, setPackages]         = useState<Package[]>([])
  const [selectedPkg, setSelectedPkg]   = useState<Package | null>(null)
  const [payMethods, setPayMethods]     = useState<any[]>([])
  const [selectedMethod, setMethod]     = useState<string>('')
  const [loading, setLoading]           = useState(true)
  const [paying, setPaying]             = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [pkgs, config] = await Promise.all([
        getRechargePackages(),
        getPaymentConfig('CHECKOUT'),
      ])
      setPackages(pkgs)
      const methods: any[] = config.PAYMENTMETHODS ?? []
      setPayMethods(methods)
      if (methods.length > 0) setMethod(methods[0].PAYTYPE ?? '')
    } catch {
      Alert.alert('Error', 'Could not load payment options. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePay() {
    if (!selectedPkg) {
      Alert.alert('Select a plan', 'Please choose a membership plan to continue.')
      return
    }
    if (!selectedMethod) {
      Alert.alert('Select payment method', 'Please choose a payment method.')
      return
    }

    setPaying(true)
    try {
      const config   = await getPaymentConfig('CHECKOUT')
      const saltKey  = config.GPAY_SALT_KEY ?? ''
      const checkout = await getCheckoutDetails(selectedPkg.PACKAGEID, selectedMethod)

      if (!checkout) {
        Alert.alert('Error', 'Could not initiate payment. Please try again.')
        return
      }

      const result = await initRazorpayPayment(checkout, selectedMethod, saltKey)

      if (result.success) {
        await handlePaymentSuccess()
      } else {
        const errCode: number = result.response?.code ?? 0
        // code 0 = user cancelled — no error shown
        if (errCode !== 0) {
          await recordPaymentFailure(null, selectedPkg)
          Alert.alert('Payment Failed', result.response?.description ?? 'Payment could not be completed.')
        }
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading plans…</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Choose a Plan</Text>

      {/* Package list */}
      <FlatList
        data={packages}
        keyExtractor={item => item.PACKAGEID}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No plans available.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, selectedPkg?.PACKAGEID === item.PACKAGEID && styles.cardSelected]}
            onPress={() => setSelectedPkg(item)}
            activeOpacity={0.8}
          >
            {item.POPULAR === '1' && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>POPULAR</Text>
              </View>
            )}
            <Text style={styles.pkgName}>{item.PACKAGENAME}</Text>
            <Text style={styles.pkgPrice}>₹{item.AMOUNT}</Text>
            <Text style={styles.pkgValidity}>{item.VALIDITY}</Text>
            {item.DESCRIPTION ? <Text style={styles.pkgDesc}>{item.DESCRIPTION}</Text> : null}
          </TouchableOpacity>
        )}
      />

      {/* Payment method selector */}
      {payMethods.length > 0 && (
        <View style={styles.methodSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.methodRow}>
            {payMethods.map(m => (
              <TouchableOpacity
                key={m.PAYTYPE}
                style={[styles.methodBtn, selectedMethod === m.PAYTYPE && styles.methodBtnSelected]}
                onPress={() => setMethod(m.PAYTYPE)}
              >
                <Text style={[styles.methodText, selectedMethod === m.PAYTYPE && styles.methodTextSelected]}>
                  {m.PAYTYPENAME ?? m.PAYTYPE}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Pay button */}
      <TouchableOpacity
        style={[styles.payBtn, (!selectedPkg || paying) && styles.payBtnDisabled]}
        onPress={handlePay}
        disabled={!selectedPkg || paying}
        activeOpacity={0.85}
      >
        {paying
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.payBtnText}>
              {selectedPkg ? `Pay ₹${selectedPkg.AMOUNT}` : 'Select a Plan'}
            </Text>
        }
      </TouchableOpacity>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.surface },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { color: Colors.textSecondary, fontSize: 14 },
  heading:      { fontSize: 22, fontWeight: '700', color: Colors.textStrong, padding: 20, paddingBottom: 8 },
  listContent:  { paddingHorizontal: 16, paddingBottom: 8 },
  emptyText:    { textAlign: 'center', color: Colors.textPlaceholder, marginTop: 40 },

  card: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: Colors.surfaceAlt,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurfaceAlt },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pkgName:     { fontSize: 16, fontWeight: '600', color: Colors.textStrong },
  pkgPrice:    { fontSize: 22, fontWeight: '700', color: Colors.primary, marginTop: 4 },
  pkgValidity: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  pkgDesc:     { fontSize: 12, color: Colors.textTertiary, marginTop: 4 },

  methodSection: { paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle:  { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  methodRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceInput,
  },
  methodBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurfaceAlt },
  methodText:        { fontSize: 13, color: '#444' },
  methodTextSelected:{ color: Colors.primary, fontWeight: '600' },

  payBtn: {
    margin: 16,
    // Angular: recharge.page.html Pay Now button uses primaryBg (#B50033 = Colors.primaryDark),
    // not Colors.primary — same fix as ButtonRevamp's primary variant.
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnDisabled: { backgroundColor: '#e0a0a0' },
  payBtnText:     { color: '#fff', fontSize: 17, fontWeight: '700' },
})
