// Angular: pages/recharge/netbanking/netbanking.page.html + .ts — reached by
// tapping "Net Banking" on payment-mode (PaymentOptionsScreen). The heading
// ("Pay using Net Banking") lives BELOW the plain back-button bar, not in the
// header row itself. Below the popular-bank grid there's an "or" divider,
// then an "All banks" section that starts COLLAPSED — a single "Select from
// other banks" row (other-banks-selection-block) that expands into a
// checklist (.custom-radio) on tap (showBankList()/showList), not an
// always-expanded flat list.
//
// Figma: Jodii - Master File English, node 3650:10435 (popular-bank grid) +
// node 2792:9267 (the NEFT/RTGS screen, sharing the same bank-selector grid —
// its HDFC card shows the confirmed selected-state treatment: border
// rgba(181,0,51,0.4) + background rgba(249,230,235,0.2), reused here for the
// popular grid's selected state).

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import PaymentRestrictedSheet from '../../components/payment/PaymentRestrictedSheet'
import { handleBack as handleRootBack } from '../../utils/navigationRef'
import { SemanticFontsEnglish } from '../../src/theme/fonts'
import {
  getFinalAmount, getNetBankingList, getRetryRemainingMs,
  type NetBankingItem, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK = CDN_REACT + '/menu_back_arrow.svg'
// Angular: <ion-button class="edit-icon"><img src="{{nbcommon.ImgDomain() +
// 'assets/images/svg/edit-icon.svg'}}" /></ion-button> on the collapsed
// other-banks row.
const ICON_EDIT = CDN + 'assets/images/svg/edit-icon.svg'

const POPULAR_COUNT = 4

type Props = { navigation: any; route: any }

export default function NetBankingScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const selectedPackage: SelectedPackage | undefined = route.params?.selectedPackage
  const amountLabel: string | undefined = route.params?.amountLabel

  const [banks, setBanks]         = useState<NetBankingItem[]>([])
  const [selectedKey, setSelected] = useState('')
  const [loading, setLoading]     = useState(true)
  const [paying, setPaying]       = useState(false)
  const [restrictedMinutes, setRestrictedMinutes] = useState<number | null>(null)
  // Angular: showList — the "All banks" section starts collapsed as a single
  // "Select from other banks" row and expands into a checklist on tap.
  const [showOtherBanks, setShowOtherBanks] = useState(false)

  useEffect(() => {
    loadBanks()
  }, [])

  async function loadBanks() {
    setLoading(true)
    try {
      setBanks(await getNetBankingList())
    } catch {
      Alert.alert('Error', 'Could not load bank list. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const popularBanks = banks.slice(0, POPULAR_COUNT)
  const otherBanks    = banks.slice(POPULAR_COUNT)

  function handleBack() {
    if (navigation.canGoBack()) handleRootBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  // Netbanking is a hosted-webview flow, not a native-SDK order submission —
  // see HostedCheckoutWebViewScreen.tsx. Real device trace confirmed
  // nbpaymentcheckout returns raw HTML + a JS-bridge callback for this
  // method (matching the old native Android app's PaymentWebviewActivity
  // design exactly), not a Razorpay order — so the checkout call, native
  // submission, and verification all happen on that screen instead.
  async function handlePay() {
    if (!selectedKey || !selectedPackage) return

    setPaying(true)
    try {
      const remainingMs = await getRetryRemainingMs()
      if (remainingMs > 0) {
        setRestrictedMinutes(Math.ceil(remainingMs / 60000))
        return
      }

      navigation.navigate('hosted-checkout', {
        selectedPackage,
        amountLabel,
        method:   'netbanking',
        bank:     selectedKey,
        amount:   getFinalAmount(selectedPackage),
        retryRoute:  'net-banking',
        retryParams: route.params,
      })
    } finally {
      setPaying(false)
    }
  }

  // Angular: bankChanged(i) — picking a bank from the expanded "All banks"
  // checklist also sets selectedBankDirect (the same selection the popular
  // grid uses) and closes the list back to its collapsed row.
  function handleOtherBankPick(bank: NetBankingItem) {
    setSelected(bank.key)
    setShowOtherBanks(false)
  }

  const selectedOtherBank = otherBanks.find(b => b.key === selectedKey)

  // Angular: pageContent?.PAY?.replace('#price', originalPrice) — PAY is
  // "Pay ₹#price", and amountLabel already carries its own "₹" (formatAmount
  // in PaymentOptionsScreen), so strip the key's literal ₹ to avoid doubling it.
  const payLabel = t('RECHARGE.PAY').replace('₹#price', amountLabel ?? '')

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Angular: the back button sits alone in the toolbar row; the page
          heading is a separate row below it, not the header bar's title. */}
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
      </View>
      <Text style={s.pageTitle}>{t('RECHARGE.PAYUSINGNET')}</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {popularBanks.length > 0 && (
            <>
              <Text style={s.sectionLabel}>{t('RECHARGE.POPULARBANK')}</Text>
              <View style={s.popularGrid}>
                {popularBanks.map(bank => (
                  <Pressable
                    key={bank.key}
                    style={s.popularItem}
                    onPress={() => setSelected(bank.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selectedKey === bank.key }}
                  >
                    <View style={[s.popularIconBox, selectedKey === bank.key && s.selectedTint]}>
                      {!!(bank.ImagePathOn || bank.ImagePathOff) && (
                        <CdnSvg
                          uri={bank.ImagePathOn ?? bank.ImagePathOff ?? ''}
                          width={24}
                          height={24}
                        />
                      )}
                    </View>
                    <Text style={s.popularLabel} numberOfLines={1}>{bank.bankName}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {otherBanks.length > 0 && (
            <>
              {/* Angular: .or-text — a circular "or" chip centered between the
                  popular grid and the other-banks selector. */}
              <View style={s.orRow}>
                <Text style={s.orText}>{t('RECHARGE.ORTEXT')}</Text>
              </View>

              {!showOtherBanks ? (
                // Angular: .other-banks-selection-block — collapsed single
                // row, shows the selected bank name once picked, else the
                // "Select from other banks" placeholder.
                <Pressable
                  style={s.collapsedRow}
                  onPress={() => setShowOtherBanks(true)}
                  accessibilityRole="button"
                >
                  <Text style={s.collapsedRowText} numberOfLines={1}>
                    {selectedOtherBank ? selectedOtherBank.bankName : t('RECHARGE.OTHERBANKS')}
                  </Text>
                  <CdnSvg uri={ICON_EDIT} width={20} height={20} />
                </Pressable>
              ) : (
                <>
                  <Text style={s.sectionLabel}>{t('RECHARGE.SELECTBANK')}</Text>
                  <View style={s.otherList}>
                    {otherBanks.map(bank => (
                      <Pressable
                        key={bank.key}
                        style={[s.otherRow, selectedKey === bank.key && s.otherRowChecked]}
                        onPress={() => handleOtherBankPick(bank)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selectedKey === bank.key }}
                      >
                        <Text
                          style={[s.otherLabel, selectedKey === bank.key && s.otherLabelChecked]}
                          numberOfLines={1}
                        >
                          {bank.bankName}
                        </Text>
                        <View style={[s.radioOuter, selectedKey === bank.key && s.radioOuterChecked]}>
                          {selectedKey === bank.key && <View style={s.radioInner} />}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Angular: <ion-footer *ngIf="selectedBankDirect >= 0"> — the footer
          only renders once a bank is picked, not always-visible-but-disabled. */}
      {!!selectedKey && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <ButtonRevamp
            label={payLabel}
            variant="primary"
            size="large"
            fullWidth
            loading={paying}
            style={{ backgroundColor: Colors.primaryDark }}
            onPress={handlePay}
          />
        </View>
      )}

      <PaymentRestrictedSheet
        visible={restrictedMinutes != null}
        remainingMinutes={restrictedMinutes ?? 0}
        onClose={() => setRestrictedMinutes(null)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  // Angular: .hide-header-bar.header-md::after { height: 0 } — this page
  // zeroes Ionic's default header shadow, so no shadow here either.
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    backgroundColor: Colors.white,
  },
  // Angular: ion-col.heading-03-bold-20.color-1f1e1b — the page heading is a
  // separate row below the back-button bar, not the header bar's own title.
  pageTitle: {
    fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 20, color: '#1f1e1b',
    paddingLeft: 16, paddingRight: 16, paddingTop: 4, paddingBottom: 8,
  },

  content: { padding: 16, gap: 16 },
  sectionLabel: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontSize: 14, color: Colors.black, marginBottom: 8 },

  popularGrid: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  popularItem: { width: 58, alignItems: 'center', gap: 6 },
  popularIconBox: {
    width: 58, height: 58, borderRadius: 8, borderWidth: 1, borderColor: '#E6E6E6',
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  popularLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, textAlign: 'center' },

  // Angular: .or-text — a circular white "or" chip, no visible connecting
  // line rendered (the ::before divider line is commented out in source).
  orRow: { alignItems: 'center' },
  orText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.black,
    backgroundColor: Colors.white, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 15,
  },

  // Angular: .other-banks-selection-block — 1px #E5E5E5 border, 4px radius,
  // 40px min-height, 12px start padding.
  collapsedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 40, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 4,
    paddingHorizontal: 12,
  },
  collapsedRowText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 16, color: Colors.black, flexShrink: 1 },

  otherList: { gap: 8 },
  // Angular: .custom-radio ion-item — 1px #F1F1F1 border, 4px radius, 40px
  // min-height, 8px bottom margin (gap here instead).
  otherRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 40, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#F1F1F1', borderRadius: 4,
  },
  otherLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black, flexShrink: 1 },
  // Angular: .custom-radio ion-item.item-radio-checked — solid #de2a68
  // background, white bold label.
  otherRowChecked: { backgroundColor: '#de2a68', borderColor: '#de2a68' },
  otherLabelChecked: { color: Colors.white, fontFamily: SemanticFontsEnglish.headingEnglishMedium },

  // Angular: ion-radio — 18px circle, 51%-opacity black border unchecked;
  // checked shows a white tick (approximated here with a filled white dot,
  // matching the checked row's white-on-pink treatment).
  radioOuter: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.51)', alignItems: 'center', justifyContent: 'center',
  },
  radioOuterChecked: { borderColor: Colors.white },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },

  // Figma (NEFT/RTGS screen's selected HDFC card, node 2792:9267): the one
  // confirmed selected-state treatment, used for the popular grid's selected
  // icon box.
  selectedTint: {
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     'rgba(181, 0, 51, 0.40)',
    backgroundColor: 'rgba(249, 230, 235, 0.20)',
  },

  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
