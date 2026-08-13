// Pay at store tab (Figma "Jodii Desktop - Registration", nodes 536:12496
// collapsed / 536:14130 expanded) — same state -> city -> store drill-down as
// mobile PayAtStoreScreen.tsx (getPaymentStateList/getPaymentCityList/
// getPaymentStoreList, unchanged), same select-then-edit-row interaction
// standing in for Figma's dropdown inputs, and the same single-expand
// accordion behavior for store cards. No submit/CTA button — informational,
// matches both the mobile screen and the Figma design.
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../../components/cdn-svg/CdnSvg'
import { Colors } from '../../../constants/colors'
import { CDN } from '../../../constants/cdn'
import {
  getPaymentCityList, getPaymentStateList, getPaymentStoreList,
  type PaymentCityItem, type PaymentStateItem, type PaymentStoreItem,
} from '../../../service/paymentService'

const ICON_EDIT         = CDN + 'assets/images/svg/edit-icon.svg'
const ICON_EXPAND_PLUS  = CDN + 'assets/images/svg/expand-plus-icon.svg'
const ICON_EXPAND_MINUS = CDN + 'assets/images/svg/expand-minus-icon.svg'

export default function PayAtStoreTab() {
  const [states, setStates]               = useState<PaymentStateItem[] | null>(null)
  const [selectedState, setSelectedState] = useState<PaymentStateItem | null>(null)
  const [pickingState, setPickingState]   = useState(true)

  const [cities, setCities]               = useState<PaymentCityItem[]>([])
  const [selectedCity, setSelectedCity]   = useState<PaymentCityItem | null>(null)
  const [pickingCity, setPickingCity]     = useState(true)
  const [loadingCities, setLoadingCities] = useState(false)

  const [stores, setStores]               = useState<PaymentStoreItem[]>([])
  const [expandedIdx, setExpandedIdx]     = useState<number | null>(null)
  const [loadingStores, setLoadingStores] = useState(false)

  useEffect(() => {
    getPaymentStateList().then(setStates)
  }, [])

  if (states === null) {
    return <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
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

  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Pay at our stores</Text>

      {/* State */}
      {!!selectedState && !pickingState && (
        <Pressable style={s.selectedRow} onPress={() => setPickingState(true)}>
          <View style={s.selectedTextBlock}>
            <Text style={s.selectedLabel}>Select state</Text>
            <Text style={s.selectedValue}>{selectedState.STATE}</Text>
          </View>
          <CdnSvg uri={ICON_EDIT} width={20} height={20} />
        </Pressable>
      )}

      {pickingState && (
        <View style={s.dropdownCard}>
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
      )}

      {/* City */}
      {!!selectedCity && !pickingCity && (
        <Pressable style={s.selectedRow} onPress={() => setPickingCity(true)}>
          <View style={s.selectedTextBlock}>
            <Text style={s.selectedLabel}>Select city</Text>
            <Text style={s.selectedValue}>{selectedCity.CITY}</Text>
          </View>
          <CdnSvg uri={ICON_EDIT} width={20} height={20} />
        </Pressable>
      )}

      {loadingCities && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 8 }} />}

      {!loadingCities && !pickingState && pickingCity && cities.length > 0 && (
        <View style={s.dropdownCard}>
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
      )}

      {/* Stores */}
      {loadingStores && <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 8 }} />}

      {!loadingStores && !pickingCity && stores.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Our Stores in {selectedCity?.CITY}</Text>
          {stores.map((store, idx) => {
            const expanded = expandedIdx === idx
            return (
              <View key={store.Title + idx} style={s.storeCard}>
                <Pressable
                  style={s.storeHeader}
                  onPress={() => stores.length > 1 && setExpandedIdx(prev => (prev === idx ? null : idx))}
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
                    {!!store.OfficeTime && <Text style={s.storeText}>Office timing: {store.OfficeTime}</Text>}
                  </View>
                )}
              </View>
            )
          })}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 16 },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black },
  sectionLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black },

  selectedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.borderNeutral, borderRadius: 8, padding: 12, height: 48,
  },
  selectedTextBlock: { flexShrink: 1, gap: 2 },
  selectedLabel: { fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.textSecondary },
  selectedValue: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.black },

  dropdownCard: {
    backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle,
    paddingHorizontal: 16, maxHeight: 260,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.black, flexShrink: 1 },

  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryDark },

  storeCard: { borderRadius: 12, borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden' },
  storeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: Colors.background,
  },
  storeTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black, flexShrink: 1 },
  storeBody: { padding: 16, paddingTop: 0, gap: 8 },
  storeText: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  storeLink: { color: Colors.link, fontFamily: 'Poppins-Medium' },
})
