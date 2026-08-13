// Desktop/laptop layout for the Payment Options screen (Figma "Jodii Desktop
// - Registration", nodes 533:2467 -> 536:14130 — one screen with a left
// payment-method tab-switcher across 5 methods). Consolidates what mobile
// splits across six separate screens/navigations: PaymentOptionsScreen's own
// inline UPI-app rows, UpiAddressScreen (manual VPA) + MorePaymentOptionsScreen
// (QR share) for UPI, CardPaymentScreen, NetBankingScreen, NeftRtgsScreen, and
// PayAtStoreScreen — into one page with a tab per method instead of a
// navigation stack.
//
// Unlike most *DesktopLayout.tsx files in this codebase, this component owns
// its own per-tab data loading (bank lists, card-form state, store lists, QR
// data) rather than being purely presentational — those are genuinely new
// concerns the mobile PaymentOptionsScreen never loads today, since mobile
// only ever shows ONE of these at a time via a full screen navigation. Only
// the shared bits (selectedPackage, order-summary numbers, back handler,
// language selector) come down as props from the parent screen.

import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../../components/cdn-svg/CdnSvg'
import { Colors } from '../../../constants/colors'
import { CDN, CDN_REACT, CDN_SVG } from '../../../constants/cdn'
import {
  formatAmount, getQRPaymentData, getRechargeHelpline,
  type QRPaymentData, type SelectedPackage,
} from '../../../service/paymentService'
import UpiTab from './UpiTab'
import CardTab from './CardTab'
import NetBankingTab from './NetBankingTab'
import NeftRtgsTab from './NeftRtgsTab'
import PayAtStoreTab from './PayAtStoreTab'

const ICON_BACK        = CDN_REACT + '/menu_back_arrow.svg'
const ICON_EDIT_PENCIL = CDN_SVG + 'revamp/primary-edit-pencil.svg'
const ICON_CALL        = CDN_SVG + 'revamp/call-blue.svg'
const ICON_WHATSAPP    = CDN + 'assets/images/svg/whatsapp-green-icon.svg'

// Angular: <img [src]="common.ImgDomain() + item.IMG"> — backend-driven icon
// paths (PAYMENTMETHODS[].IMG, bank list ImagePathOn/Off) come back relative
// to the CDN root, not as absolute URLs. Shared by every tab in this folder.
export function resolveIcon(path?: string): string {
  if (!path) return ''
  return /^https?:\/\//.test(path) ? path : CDN + path
}

type TabKey = 'upi' | 'card' | 'netbanking' | 'neft' | 'store'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upi',        label: 'UPI' },
  { key: 'card',       label: 'Debit/Credit cards' },
  { key: 'netbanking', label: 'Net banking' },
  { key: 'neft',       label: 'NEFT/RTGS/Pay at bank' },
  { key: 'store',      label: 'Pay at store' },
]

export interface PaymentOptionsDesktopLayoutProps {
  selectedPackage:    SelectedPackage
  amountLabel:        string
  planName:           string
  planDuration?:      string | undefined
  priceNum:           number
  discountAmountNum:  number
  finalTotalNum:      number
  onClose:            () => void
  onEditPlan:         () => void
  langCode:           string
  onLanguagePress?:   (() => void) | undefined
}

export default function PaymentOptionsDesktopLayout({
  selectedPackage, amountLabel, planName, planDuration,
  priceNum, discountAmountNum, finalTotalNum,
  onClose, onEditPlan, langCode, onLanguagePress,
}: PaymentOptionsDesktopLayoutProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('upi')
  const [helpline, setHelpline]   = useState('')
  const [qrData, setQrData]       = useState<QRPaymentData | null>(null)

  const hasDiscount = discountAmountNum > 0

  useEffect(() => {
    getRechargeHelpline().then(setHelpline)
    getQRPaymentData(selectedPackage.PACKAGEID).then(data => {
      if (data.qrValue) setQrData(data)
    })
  }, [selectedPackage.PACKAGEID])

  function shareQrOnWhatsApp() {
    if (!qrData?.whatsappMsg) return
    // react-native-share (used on Android for this same share) has no web
    // build — the standard WhatsApp web-share link is the browser equivalent.
    Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(qrData.whatsappMsg)}`)
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Payment options</Text>
        <Pressable style={s.langBtn} onPress={onLanguagePress}>
          <Text style={s.langText}>{langCode?.toLowerCase() === 'en' ? 'English' : langCode}</Text>
        </Pressable>
      </View>

      <View style={s.body}>
        <View style={s.sidebarTabs}>
          {TABS.map(tab => (
            <Pressable
              key={tab.key}
              style={[s.tabRow, activeTab === tab.key && s.tabRowActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
            >
              <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.content}>
          {activeTab === 'upi' && (
            <UpiTab selectedPackage={selectedPackage} amountLabel={amountLabel} qrData={qrData} />
          )}
          {activeTab === 'card' && (
            <CardTab selectedPackage={selectedPackage} amountLabel={amountLabel} />
          )}
          {activeTab === 'netbanking' && (
            <NetBankingTab selectedPackage={selectedPackage} amountLabel={amountLabel} />
          )}
          {activeTab === 'neft' && <NeftRtgsTab />}
          {activeTab === 'store' && <PayAtStoreTab />}
        </View>

        <View style={s.sidebar}>
          <View style={s.summaryCard}>
            <View style={s.summaryTopRow}>
              <View style={s.planNameRow}>
                <Text style={s.planName} numberOfLines={1}>{planName}</Text>
                {!!planDuration && <Text style={s.planDuration}>{planDuration}</Text>}
                <Pressable onPress={onEditPlan} hitSlop={8}>
                  <CdnSvg uri={ICON_EDIT_PENCIL} width={16} height={16} />
                </Pressable>
              </View>
              <Text style={s.planPrice}>{formatAmount(priceNum)}</Text>
            </View>

            {hasDiscount && (
              <View style={s.discountRow}>
                <Text style={s.discountLabel}>Special discount</Text>
                <Text style={s.discountValue}>- {formatAmount(discountAmountNum)}</Text>
              </View>
            )}

            <View style={s.summaryDivider} />

            <View style={s.totalRow}>
              <Text style={s.totalLabel}>To Pay</Text>
              <View style={s.totalValues}>
                {hasDiscount && <Text style={s.strikeThrough}>{formatAmount(priceNum)}</Text>}
                <Text style={s.totalValue}>{formatAmount(finalTotalNum)}</Text>
              </View>
            </View>
          </View>

          {!!qrData?.whatsappMsg && (
            <View style={s.qrCard}>
              <Text style={s.qrTitle}>Want a family member or friend to pay for you?</Text>
              <Text style={s.qrNote}>
                Share the QR code with your family/friends to pay for your Jodii membership
              </Text>
              <Pressable style={s.whatsappBtn} onPress={shareQrOnWhatsApp}>
                <CdnSvg uri={ICON_WHATSAPP} width={18} height={18} />
                <Text style={s.whatsappLabel}>Share via WhatsApp</Text>
              </Pressable>
            </View>
          )}

          {!!helpline && (
            <View style={s.needHelpCard}>
              <Text style={s.needHelpTitle}>Need help in making payment?</Text>
              <Pressable style={s.needHelpRow} onPress={() => Linking.openURL(`tel:${helpline}`)}>
                <CdnSvg uri={ICON_CALL} width={16} height={16} />
                <Text style={s.needHelpNumber}>{helpline}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDF8F8' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black, flex: 1, marginLeft: 16 },
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.borderNeutral, borderRadius: 8,
  },
  langText: { fontFamily: 'Poppins-Medium', fontSize: 12, color: Colors.black },

  body: { flex: 1, flexDirection: 'row', paddingHorizontal: 32, paddingVertical: 32, gap: 24 },

  sidebarTabs: {
    width: 216, backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    alignSelf: 'flex-start',
  },
  tabRow: { height: 48, justifyContent: 'center', paddingHorizontal: 16 },
  tabRowActive: { backgroundColor: '#FFF5F7' },
  tabLabel: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.black },
  tabLabelActive: { fontFamily: 'Poppins-Medium', color: Colors.primaryDark },

  content: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 16, padding: 24,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    alignSelf: 'flex-start',
  },

  sidebar: { width: 352, gap: 16, alignSelf: 'flex-start' },

  summaryCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  planName:     { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black },
  planDuration: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary },
  planPrice:    { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },

  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  discountLabel: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.black },
  discountValue: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.discountGreen },

  summaryDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 16 },

  totalRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel:  { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black },
  totalValues: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strikeThrough: { fontSize: 12, color: Colors.borderNeutral, textDecorationLine: 'line-through' },
  totalValue: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black },

  qrCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, gap: 12,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  qrTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black },
  qrNote:  { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: 24, paddingVertical: 10,
  },
  whatsappLabel: { fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.primaryDark },

  needHelpCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, gap: 8, alignItems: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  needHelpTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: Colors.black, textAlign: 'center' },
  needHelpRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  needHelpNumber: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link },
})
