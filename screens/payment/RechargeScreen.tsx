// Angular: pages/recharge/recharge.page.html (PageType == '3' variant, close-icon
// header i.e. paymentPageType == '1') + components/benefits-card/benefits-card.component.html
// — the membership plan-selection list. Reached from the footer "Membership" tab
// (free/non-paid users) and from Matches/Explore promo banners; paid users are
// routed to a separate My Membership screen instead (not this one).
//
// "View other packages" (Angular: viewAllPacKPopUp(), recharge.page.ts:819-845)
// opens a BottomsheetComponent (action 'editPackPopUp') listing the FULL,
// unfiltered promotion.CONTENT — not just the 3-card INTERMEDIATEPACK subset —
// using the same benefits-card row. Its own footer Pay button dismisses the
// sheet and calls payNow() with whatever was selected inside it (independent
// from the main page's selection) — see recharge.page.ts:837-843.
//
// The plan-swipe/EPR/old PageType=='2' variants are intentionally not built —
// out of scope for this Figma.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_SVG, CDN_REACT } from '../../constants/cdn'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import RechargeDesktopLayout from './RechargeDesktopLayout'
import {
  checkAvailOffer, getMembershipPlans, getPaymentConfig, paymentTrack,
  type MembershipPlan, type MembershipPlansData, type SelectedPackage,
} from '../../service/paymentService'

const ICON_BACK     = CDN_REACT + '/menu_back_arrow.svg'
const ICON_WHATSAPP = CDN_SVG + 'revamp/whatsapp-revamp.svg'
const ICON_LIKE     = CDN_SVG + 'bottom-nav/like.svg'
const ICON_CALL     = CDN_SVG + 'revamp/call-blue.svg'

// Angular: benefits-card.component.html hides the second benefits row
// ("...additional matches who liked you") specifically for the weekly pack.
const WEEKLY_PACK_PRODUCT_ID = '76'

type Props = { navigation: any; route: any }

export default function RechargeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()
  const { i18n } = useTranslation()

  // Reached two different ways: tapping the footer "Membership" tab (shows
  // as tab content — no back arrow, bottom tab bar visible), or from a
  // promo banner/paywall elsewhere in the app (full-screen push — back
  // arrow, no tab bar). The caller distinguishes these via this param —
  // see handleTabPress() in every screen with an AppFooter.
  const fromTab = !!route?.params?.fromTab

  function handleTabPress(tab: FooterTab) {
    switch (tab) {
      case 0: navigation.navigate('Home');     break
      case 1: navigation.navigate('Matches');  break
      case 2: navigation.navigate('Activity'); break
      case 4: navigation.navigate('MessagerList'); break
      // case 3 (Membership) — already here, no-op.
    }
  }

  const [data, setData]           = useState<MembershipPlansData | null>(null)
  const [selectedId, setSelected] = useState('')
  const [loading, setLoading]     = useState(true)

  // "View other packages" sheet — its own independent selection, seeded from
  // the main page's current selection when opened (matches Angular: the
  // popup's BottomsheetComponent keeps local state, separate from
  // recharge.page.ts's selectedPackId until the sheet's own Pay is tapped).
  const [showAllPlans, setShowAllPlans]   = useState(false)
  const [sheetSelectedId, setSheetSelected] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Angular: recharge.page.ts constructor/ngOnInit — getPayConfig(1) and
      // checkAvailOffer() fire alongside the plan-list fetch; paymentTrack('0')
      // is the page-view analytics beacon. None of these three block or feed
      // the plan list itself (matches Angular's own fire-and-forget usage),
      // so they run alongside getMembershipPlans() rather than before it.
      const [result] = await Promise.all([
        getMembershipPlans(),
        getPaymentConfig(),
        checkAvailOffer(),
        paymentTrack('0'),
      ])
      setData(result)
      if (result) setSelected(result.defaultProductId)
    } catch {
      Alert.alert('Error', 'Could not load membership plans. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlan      = data?.plans.find(p => p.productid === selectedId)
  const sheetSelectedPlan = data?.allPlans.find(p => p.productid === sheetSelectedId)

  // This screen can now be the app's initial route (free/unpaid users land
  // here straight from login — see AuthContext's initialRoute), in which
  // case there's no back-stack and goBack() silently no-ops. Angular's
  // closeIntermediatePage() has an equivalent fallback rather than assuming
  // a previous page always exists.
  function handleClose() {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.reset({ index: 0, routes: [{ name: 'Matches' }] })
  }

  function openAllPlans() {
    setSheetSelected(selectedId)
    setShowAllPlans(true)
  }

  // Payment method selection + checkout happen on PaymentOptionsScreen —
  // this screen (and the "View other packages" sheet) only hand off the
  // chosen plan. Angular: payNow(data) — same target regardless of which of
  // the two selection surfaces the plan came from.
  function proceedWithPlan(plan?: MembershipPlan) {
    if (!plan) return
    const selectedPackage: SelectedPackage = {
      PACKAGEID:      plan.productid,
      value:          plan.value1[0],
      value1:         plan.value1,
      price:          plan.price,
      paidamt:        plan.paidamt,
      discountamount: plan.discountamount,
      autopayflag:    plan.autopayflag,
    }
    setShowAllPlans(false)
    navigation.navigate('payment-options', { selectedPackage })
  }

  // Angular: promotion.CTA3.replace('₹<367>', offerprice || price). Both
  // fields already carry the ₹ symbol, so no re-formatting is needed.
  function payLabelFor(plan?: MembershipPlan): string {
    return data ? data.payCtaTemplate.replace('₹<367>', plan?.offerprice || plan?.price || '') : ''
  }
  const payLabel = payLabelFor(selectedPlan)

  // ── Desktop web layout (Figma "Jodii Desktop - Registration", 969:2785) ──
  // Wide browser window only — mobile/native/narrow-web keep the JSX below,
  // untouched, sharing all the same state/handlers defined above.
  if (isDesktop) {
    return (
      <RechargeDesktopLayout
        data={data}
        loading={loading}
        selectedId={selectedId}
        onSelect={setSelected}
        onViewAllPlans={openAllPlans}
        showAllPlans={showAllPlans}
        onCloseAllPlans={() => setShowAllPlans(false)}
        sheetSelectedId={sheetSelectedId}
        onSheetSelect={setSheetSelected}
        payLabel={payLabel}
        onPay={() => proceedWithPlan(selectedPlan)}
        sheetPayLabel={payLabelFor(sheetSelectedPlan)}
        onSheetPay={() => proceedWithPlan(sheetSelectedPlan)}
        langCode={i18n.language}
        onTabPress={handleTabPress}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
      />
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        {fromTab ? (
          <Text style={s.headerTitle} numberOfLines={1}>{data?.title ?? 'Membership plans'}</Text>
        ) : (
          <>
            <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
              <CdnSvg uri={ICON_BACK} width={24} height={24} />
            </Pressable>
            <Text style={[s.headerTitle, s.headerTitleWithBack]} numberOfLines={1}>{data?.title ?? 'Membership plans'}</Text>
          </>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
      ) : !data || data.plans.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No plans available.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={s.content}>
            {data.plans.map(plan => (
              <PlanCard
                key={plan.productid}
                plan={plan}
                selected={selectedId === plan.productid}
                onPress={() => setSelected(plan.productid)}
              />
            ))}

            {!!data.offerBannerText && (
              <View style={s.offerBanner}>
                <Text style={s.offerBannerText}>{data.offerBannerText}</Text>
              </View>
            )}
          </ScrollView>

          {/* "View other packages" + Pay + Need help are all sticky here —
              only the plan list above scrolls. */}
          <View style={[s.footer, { paddingBottom: fromTab ? 12 : insets.bottom + 12 }]}>
            {!!data.viewAllText && (
              <Pressable style={s.viewAllRow} onPress={openAllPlans}>
                <Text style={s.viewAllText}>{data.viewAllText}</Text>
              </Pressable>
            )}
            <ButtonRevamp
              label={payLabel}
              variant="primary"
              size="large"
              fullWidth
              icon="forward-icon-white"
              iconPosition="end"
              style={{ backgroundColor: Colors.primaryDark }}
              onPress={() => proceedWithPlan(selectedPlan)}
            />
            {!!data.helpline && (
              <View style={s.needHelpRow}>
                <Text style={s.needHelpText}>Need help? </Text>
                <CdnSvg uri={ICON_CALL} width={16} height={16} />
                <Text style={s.needHelpNumber}>{data.helpline}</Text>
              </View>
            )}
          </View>

          {fromTab && (
            <AppFooter activeTab={3} upgradeTag="₹300 OFF" onTabPress={handleTabPress} />
          )}
        </>
      )}

      <BottomSheet
        visible={showAllPlans}
        onClose={() => setShowAllPlans(false)}
      >
        <View style={s.sheetInner}>
          <Text style={s.sheetTitle}>{data?.viewAllText ?? 'All packages'}</Text>
          <ScrollView style={s.sheetList} contentContainerStyle={s.sheetListContent}>
            {data?.allPlans.map(plan => (
              <PlanCard
                key={plan.productid}
                plan={plan}
                selected={sheetSelectedId === plan.productid}
                onPress={() => setSheetSelected(plan.productid)}
              />
            ))}
          </ScrollView>
          <ButtonRevamp
            label={payLabelFor(sheetSelectedPlan)}
            variant="primary"
            size="large"
            fullWidth
            icon="forward-icon-white"
            iconPosition="end"
            style={{ backgroundColor: Colors.primaryDark, marginTop: 16 }}
            onPress={() => proceedWithPlan(sheetSelectedPlan)}
          />
          {!!data?.helpline && (
            <View style={[s.needHelpRow, { marginTop: 8 }]}>
              <Text style={s.needHelpText}>Need help? </Text>
              <CdnSvg uri={ICON_CALL} width={16} height={16} />
              <Text style={s.needHelpNumber}>{data.helpline}</Text>
            </View>
          )}
        </View>
      </BottomSheet>
    </View>
  )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
// Angular: components/benefits-card/benefits-card.component.html

export function PlanCard({
  plan, selected, onPress,
}: { plan: MembershipPlan; selected: boolean; onPress: () => void }) {
  const hasStrike  = !!plan.offerprice
  const showSecondBenefit = plan.productid !== WEEKLY_PACK_PRODUCT_ID && !!plan.benefits[1]

  return (
    <View style={plan.splprodflag === '1' ? s.cardWrap : undefined}>
      {plan.splprodflag === '1' && (
        <LinearGradient
          colors={['#00858C', '#004179', '#004179', '#00858C']}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.onlyForYouTab}
        >
          <Text style={s.onlyForYouText}>Only for you</Text>
        </LinearGradient>
      )}

      {plan.tag === '1' && (
        <LinearGradient
          colors={['#5564EC', '#7347CB', '#A822A3']}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.mostSoldBadge}
        >
          <Text style={s.mostSoldText}>Most Sold</Text>
        </LinearGradient>
      )}

      <Pressable
        style={[s.card, selected ? s.cardSelected : s.cardUnselected]}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
      >
        <View style={s.cardTopRow}>
          <View style={s.cardTopLeft}>
            <View style={[s.radioCircle, selected && s.radioCircleSelected]}>
              {selected && <View style={s.radioDot} />}
            </View>
            <View>
              <Text style={s.durationText}>{plan.value1[1]}</Text>
              <Text style={s.typeText}>{plan.value1[0]}</Text>
            </View>
          </View>

          <View style={s.cardTopRight}>
            {/* Angular: displayAmt() renders these pre-formatted amount strings
                (already carrying their own ₹ symbol) as-is — no re-formatting. */}
            <View style={s.priceRow}>
              {hasStrike && <Text style={s.strikePrice}>{plan.price}</Text>}
              <Text style={s.finalPrice}>{plan.paidamt}</Text>
            </View>
            {!!plan.discounttitle && <Text style={s.saveText}>{plan.discounttitle}</Text>}
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.benefitRow}>
          <CdnSvg uri={ICON_WHATSAPP} width={16} height={16} style={s.benefitIcon} />
          <Text style={s.benefitText}>{renderBenefitText(plan.benefits[0]?.value)}</Text>
        </View>
        {showSecondBenefit && (
          <View style={s.benefitRow}>
            <CdnSvg uri={ICON_LIKE} width={16} height={16} style={s.benefitIcon} />
            <Text style={s.benefitText}>{renderBenefitText(plan.benefits[1].value)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

// ─── renderBenefitText ────────────────────────────────────────────────────────
// The API sends benefit copy as light HTML — e.g. `Call/WhatsApp <span
// class="font-14-semibold">10</span> matches`. There's no HTML renderer in
// this codebase, so this pulls out just the <span>...</span> wrapped segment
// and renders it as bold nested Text (RN supports nesting Text for inline
// styling); everything else renders as plain text, matching Angular's visual
// result without needing a full HTML parser.

export function renderBenefitText(html?: string) {
  if (!html) return null
  const parts = html.split(/(<span[^>]*>.*?<\/span>)/g)
  return parts.map((part, i) => {
    const match = part.match(/<span[^>]*>(.*?)<\/span>/)
    return match
      ? <Text key={i} style={s.benefitBold}>{match[1]}</Text>
      : part
  })
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, flex: 1 },
  headerTitleWithBack: { marginLeft: 16 },

  content: { padding: 24, paddingTop: 20, gap: 20 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary },

  cardWrap: { marginTop: 20 },

  onlyForYouTab: {
    position: 'absolute', top: -20, left: 0, height: 40, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  onlyForYouText: { fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium, fontSize: 10, color: Colors.white },

  mostSoldBadge: {
    position: 'absolute', top: -11, left: 43, height: 20, borderRadius: 20,
    paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  mostSoldText: { fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium, fontSize: 10, color: Colors.white },

  card: {
    borderRadius: 16, padding: 12, backgroundColor: Colors.white,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  cardSelected:   { borderWidth: 2, borderColor: Colors.primaryDark },
  cardUnselected: { borderWidth: 1, borderColor: Colors.borderNeutral },

  cardTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTopLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  radioCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.borderNeutral,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },

  durationText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black },
  typeText:     { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: '#222222', marginTop: 2 },

  cardTopRight: { alignItems: 'flex-end' },
  priceRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strikePrice:  { fontSize: 12, color: Colors.textPlaceholder, textDecorationLine: 'line-through' },
  finalPrice:   { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black },
  saveText:     { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 10, color: '#00A650', marginTop: 4 },

  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },

  benefitRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  benefitIcon: { marginTop: 1, marginRight: 4 },
  benefitText: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, lineHeight: 16 },
  benefitBold: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14 },

  viewAllRow:  { alignItems: 'center', paddingVertical: 4 },
  viewAllText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },

  offerBanner: {
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: Colors.membershipCardBg, alignItems: 'center',
  },
  offerBannerText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#7A1739', textAlign: 'center', lineHeight: 16 },

  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 8 },

  // "View other packages" sheet
  sheetInner:       { maxHeight: '100%' },
  sheetTitle:       { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, textAlign: 'center', marginBottom: 16 },
  sheetList:        { maxHeight: 480 },
  sheetListContent: { gap: 20, paddingBottom: 8 },

  needHelpRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  needHelpText:   { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black },
  needHelpNumber: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.link, marginLeft: 4 },
})
