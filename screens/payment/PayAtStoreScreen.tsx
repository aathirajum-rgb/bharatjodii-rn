// Angular: pages/recharge/branch-locator/branch-locator.page.html + .ts —
// reached by tapping "Pay at our stores" on the More Payment Options screen
// (MorePaymentOptionsScreen). State → City → Store drill-down, no Razorpay/
// checkout call at all: pick a state, pick a city (auto-picked if there's
// only one), then browse store cards (address/phone/office-time), expanding
// one at a time — auto-expanded if there's only one store.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import {
  getPaymentCityList, getPaymentStateList, getPaymentStoreList,
  type PaymentCityItem, type PaymentStateItem, type PaymentStoreItem,
} from '../../service/paymentService'

const ICON_BACK        = CDN_REACT + '/menu_back_arrow.svg'
const ICON_EDIT         = CDN + 'assets/images/svg/edit-icon.svg'
const ICON_EXPAND_PLUS  = CDN + 'assets/images/svg/expand-plus-icon.svg'
const ICON_EXPAND_MINUS = CDN + 'assets/images/svg/expand-minus-icon.svg'

type Props = { navigation: any; route: any }

export default function PayAtStoreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  const [states, setStates]           = useState<PaymentStateItem[]>([])
  const [selectedState, setSelectedState] = useState<PaymentStateItem | null>(null)
  const [pickingState, setPickingState] = useState(true)
  const [loadingStates, setLoadingStates] = useState(true)

  const [cities, setCities]           = useState<PaymentCityItem[]>([])
  const [selectedCity, setSelectedCity] = useState<PaymentCityItem | null>(null)
  const [pickingCity, setPickingCity] = useState(true)
  const [loadingCities, setLoadingCities] = useState(false)

  const [stores, setStores]           = useState<PaymentStoreItem[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [loadingStores, setLoadingStores] = useState(false)

  useEffect(() => {
    getPaymentStateList().then(list => {
      setStates(list)
      setLoadingStates(false)
    })
  }, [])

  function handleBack() {
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  async function handleSelectState(state: PaymentStateItem) {
    setSelectedState(state)
    setPickingState(false)
    setCities([])
    setSelectedCity(null)
    setPickingCity(true)
    setStores([])
    setExpandedIdx(null)
    setLoadingCities(true)

    const list = await getPaymentCityList(String(state.STATEID))
    const sorted = [...list].sort((a, b) => a.CITY.localeCompare(b.CITY))
    setCities(sorted)
    setLoadingCities(false)

    if (sorted.length === 1) await handleSelectCity(sorted[0]!, state)
  }

  async function handleSelectCity(city: PaymentCityItem, stateOverride?: PaymentStateItem) {
    const state = stateOverride ?? selectedState
    setSelectedCity(city)
    setPickingCity(false)
    if (!state) return

    setStores([])
    setExpandedIdx(null)
    setLoadingStores(true)
    const list = await getPaymentStoreList(String(state.STATEID), String(city.CITYID))
    setStores(list)
    setExpandedIdx(list.length === 1 ? 0 : null)
    setLoadingStores(false)
  }

  function toggleStore(idx: number) {
    setExpandedIdx(prev => (prev === idx ? null : idx))
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Pay at our stores</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* ── State ── */}
        {!!selectedState && !pickingState && (
          <Pressable style={s.selectedRow} onPress={() => setPickingState(true)}>
            <View style={s.selectedTextBlock}>
              <Text style={s.selectedLabel}>State</Text>
              <Text style={s.selectedValue}>{selectedState.STATE}</Text>
            </View>
            <CdnSvg uri={ICON_EDIT} width={20} height={20} />
          </Pressable>
        )}

        {loadingStates && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 24 }} />}

        {!loadingStates && pickingState && (
          <>
            <Text style={s.sectionLabel}>Select your state</Text>
            <View style={s.card}>
              {states.map((state, idx) => (
                <Pressable
                  key={state.STATEID}
                  style={[s.row, idx === states.length - 1 && s.rowLast]}
                  onPress={() => handleSelectState(state)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedState?.STATEID === state.STATEID }}
                >
                  <Text style={s.rowLabel}>{state.STATE}</Text>
                  <View style={[s.radioCircle, selectedState?.STATEID === state.STATEID && s.radioCircleSelected]}>
                    {selectedState?.STATEID === state.STATEID && <View style={s.radioDot} />}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ── City ── */}
        {!!selectedCity && !pickingCity && (
          <Pressable style={s.selectedRow} onPress={() => setPickingCity(true)}>
            <View style={s.selectedTextBlock}>
              <Text style={s.selectedLabel}>City/District</Text>
              <Text style={s.selectedValue}>{selectedCity.CITY}</Text>
            </View>
            <CdnSvg uri={ICON_EDIT} width={20} height={20} />
          </Pressable>
        )}

        {loadingCities && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 24 }} />}

        {!loadingCities && !pickingState && pickingCity && cities.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Select city/district</Text>
            <View style={s.card}>
              {cities.map((city, idx) => (
                <Pressable
                  key={String(city.CITYID)}
                  style={[s.row, idx === cities.length - 1 && s.rowLast]}
                  onPress={() => handleSelectCity(city)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedCity?.CITYID === city.CITYID }}
                >
                  <Text style={s.rowLabel}>{city.CITY}</Text>
                  <View style={[s.radioCircle, selectedCity?.CITYID === city.CITYID && s.radioCircleSelected]}>
                    {selectedCity?.CITYID === city.CITYID && <View style={s.radioDot} />}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ── Stores ── */}
        {loadingStores && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 24 }} />}

        {!loadingStores && !pickingCity && stores.map((store, idx) => {
          const expanded = expandedIdx === idx
          return (
            <View key={store.Title + idx} style={s.storeCard}>
              <Pressable
                style={s.storeHeader}
                onPress={() => stores.length > 1 && toggleStore(idx)}
              >
                <Text style={s.storeTitle}>{store.Title}</Text>
                {stores.length > 1 && (
                  <CdnSvg uri={expanded ? ICON_EXPAND_MINUS : ICON_EXPAND_PLUS} width={20} height={20} />
                )}
              </Pressable>

              {expanded && (
                <View style={s.storeBody}>
                  <Text style={s.storeText}>Location: {store.Address}</Text>

                  {!!store.Phone?.length && (
                    <Text style={s.storeText}>
                      Telephone:{' '}
                      {store.Phone.map((tele, i) => (
                        <Text key={tele.value + i}>
                          <Text style={s.storeLink} onPress={() => Linking.openURL(`tel:${tele.value}`)}>
                            {tele.value}
                          </Text>
                          {i < store.Phone!.length - 1 ? ' | ' : ''}
                        </Text>
                      ))}
                    </Text>
                  )}

                  {!!store.OfficeTime && (
                    <Text style={s.storeText}>Office Time: {store.OfficeTime}</Text>
                  )}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, marginLeft: 16, flex: 1 },

  content: { padding: 16, gap: 16 },
  sectionLabel: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },

  selectedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 8, padding: 12,
  },
  selectedTextBlock: { flexShrink: 1, gap: 2 },
  selectedLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 11, color: Colors.textSecondary },
  selectedValue: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },

  card: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle, paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, flexShrink: 1 },

  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  storeCard: {
    borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden',
  },
  storeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: Colors.background,
  },
  storeTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black, flexShrink: 1 },
  storeBody: { padding: 16, paddingTop: 0, gap: 8 },
  storeText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  storeLink: { color: Colors.link, fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium },
})
