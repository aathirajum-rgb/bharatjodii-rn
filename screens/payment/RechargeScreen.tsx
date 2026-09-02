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
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import { CDN_SVG } from '../../constants/cdn'
import { handleBack } from '../../utils/navigationRef'
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

// Angular: recharge.page.html:92 — paymentPageType '1' (this port's variant)
// renders the title FIRST and a close ✕ on the RIGHT (close-light-black.svg),
// not a back arrow on the left. The back-arrow markup is the '0'/'2'/'3'
// variant (line 83), which this screen isn't.
const ICON_CLOSE     = CDN_SVG + 'close-light-black.svg'
const ICON_WHATSAPP  = CDN_SVG + 'revamp/whatsapp-revamp.svg'
const ICON_MESSAGE   = CDN_SVG + 'message-matches.svg'
const ICON_HOROSCOPE = CDN_SVG + 'viewprofile/horoscope-icon.svg'
// Angular: benefits-card.component.html:28-39 — the three benefit icons are
// deliberately NOT the same size. Rows 1/3 use .forward-icon-24 (24x24,
// global.scss:1571); row 2 uses .widheight (18x18 !important, benefits-card
// .component.scss:99) plus .ml-2 to re-centre it against the wider two.
const BENEFIT_ICON_LG = 24
const BENEFIT_ICON_SM = 18
const ICON_CALL      = CDN_SVG + 'revamp/call-blue.svg'
const ICON_FORWARD_GREY = CDN_SVG + 'forward-icon-grey.svg'

type Props = { navigation: any; route: any }

export default function RechargeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()
  const { t, i18n } = useTranslation()
  // The "View other packages" sheet's height is driven by how tall its card
  // list may grow. A fixed pixel cap (this was 480) can't track screen size,
  // so on a tall screen the sheet stopped well short of where Angular's sits.
  // ADJUSTABLE — raise the fraction to bring the sheet further up; the
  // BottomSheet itself caps at 95% of the screen.
  const { height: winH } = useWindowDimensions()
  const sheetListMaxH = Math.round(winH * 0.66)

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
    if (navigation.canGoBack()) handleBack()
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
        <Text style={s.headerTitle} numberOfLines={1}>{data?.title ?? ''}</Text>
        {/* Angular: recharge.page.html:88-93 — the close ✕ sits AFTER the
            title (margin-left-auto ml-12), and JODII-415 hides it entirely
            when the page is opened from the bottom nav bar. */}
        {!fromTab && (
          <Pressable style={s.headerClose} onPress={handleClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <CdnSvg uri={ICON_CLOSE} width={32} height={32} />
          </Pressable>
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
          {/* Angular renders these lists inside ion-content, which hides the
              scrollbar on mobile; RN's ScrollView shows one by default, which
              is the grey vertical line running down the right edge. */}
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {data.plans.map(plan => (
              <PlanCard
                key={plan.productid}
                plan={plan}
                topSellText={data?.topSellText}
                selected={selectedId === plan.productid}
                onPress={() => setSelected(plan.productid)}
              />
            ))}

            {/* Angular: recharge.page.html:151 — the Aadi offer note and the
                "View other packages" link are mutually exclusive siblings
                (PROMOTYPE == '20' vs != '20'), both sitting INSIDE the
                scrolling content directly under the cards with mt-8. */}
            {!!data.offerBannerText ? (
              <View style={s.offerBanner}>
                <Text style={s.offerBannerText}>{data.offerBannerText}</Text>
              </View>
            ) : !!data.viewAllText && (
              <Pressable style={s.viewAllRow} onPress={openAllPlans}>
                <Text style={s.viewAllText}>{data.viewAllText}</Text>
                <CdnSvg uri={ICON_FORWARD_GREY} width={16} height={16} />
              </Pressable>
            )}
          </ScrollView>

          {/* Angular: <ion-footer> holds only the Pay CTA and, below it, the
              sticky "Need help?" row (JODII-415). "View other packages" is
              NOT here — it scrolls with the cards above. */}
          <View style={[s.footer, { paddingBottom: fromTab ? 12 : insets.bottom + 12 }]}>
            {/* Angular: recharge.page.html:190-197 — buttonSize 'standard'
                (height 44, radius 8), background primaryBg (#B50033). */}
            <ButtonRevamp
              label={payLabel}
              variant="primary"
              size="standard"
              fullWidth
              icon="forward-icon-white"
              iconPosition="end"
              style={{ backgroundColor: Colors.primaryDark }}
              onPress={() => proceedWithPlan(selectedPlan)}
            />
            {!!data.helpline && (
              <View style={s.needHelpRow}>
                <Text style={s.needHelpText}>{t('REGISTRATION.NEEDHELPCALL')}</Text>
                <Pressable style={s.needHelpContact} onPress={() => Linking.openURL(`tel:${data.helpline}`)} hitSlop={8}>
                  <CdnSvg uri={ICON_CALL} width={16} height={16} />
                  <Text style={s.needHelpNumber}>{data.helpline}</Text>
                </Pressable>
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
          <ScrollView style={[s.sheetList, { maxHeight: sheetListMaxH }]} contentContainerStyle={s.sheetListContent}>
            {data?.allPlans.map(plan => (
              <PlanCard
                key={plan.productid}
                plan={plan}
                topSellText={data?.topSellText}
                selected={sheetSelectedId === plan.productid}
                onPress={() => setSheetSelected(plan.productid)}
              />
            ))}
          </ScrollView>
          <ButtonRevamp
            label={payLabelFor(sheetSelectedPlan)}
            variant="primary"
            size="standard"
            fullWidth
            icon="forward-icon-white"
            iconPosition="end"
            style={{ backgroundColor: Colors.primaryDark, marginTop: 16 }}
            onPress={() => proceedWithPlan(sheetSelectedPlan)}
          />
        </View>
      </BottomSheet>
    </View>
  )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
// Angular: components/benefits-card/benefits-card.component.html

export function PlanCard({
  plan, selected, onPress, topSellText,
}: { plan: MembershipPlan; selected: boolean; onPress: () => void; topSellText?: string | undefined }) {
  const { t } = useTranslation()
  const hasStrike  = !!plan.offerprice

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
          <Text style={s.onlyForYouText}>{t('RECHARGE.ONLY_FOR_YOU')}</Text>
        </LinearGradient>
      )}

      <Pressable
        style={[s.card, selected ? s.cardSelected : s.cardUnselected]}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
      >
        {/* Angular: .most-popular is a child of .intermediate-item-block (the
            card) — NOT a sibling above it — so its top:-1.4rem is measured
            from the card's own top edge, leaving the badge straddling the
            border rather than floating clear above it. */}
        {plan.tag === '1' && !!topSellText && (
          <LinearGradient
            colors={['#5564EC', '#7347CB', '#A822A3']}
            locations={[0, 0.48, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.mostSoldBadge}
          >
            <Text style={s.mostSoldText}>{topSellText}</Text>
          </LinearGradient>
        )}

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

        {/* Angular: benefits-card.component.html:28-39 — every row is mt-12
            (12px), and the middle icon is 18px vs 24px for the outer two. */}
        <View style={s.benefitRow}>
          <CdnSvg uri={ICON_WHATSAPP} width={BENEFIT_ICON_LG} height={BENEFIT_ICON_LG} />
          <Text style={s.benefitText}>{renderBenefitText(plan.benefits[0]?.value)}</Text>
        </View>
        {!!plan.benefits[1] && (
          <View style={s.benefitRow}>
            <CdnSvg uri={ICON_MESSAGE} width={BENEFIT_ICON_SM} height={BENEFIT_ICON_SM} style={s.benefitIconSm} />
            <Text style={s.benefitText}>{renderBenefitText(plan.benefits[1].value)}</Text>
          </View>
        )}
        {!!plan.benefits[2] && (
          <View style={s.benefitRow}>
            <CdnSvg uri={ICON_HOROSCOPE} width={BENEFIT_ICON_LG} height={BENEFIT_ICON_LG} />
            <Text style={s.benefitText}>{renderBenefitText(plan.benefits[2].value)}</Text>
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

  // Angular: .pl-24 .pr-24 .pt-16 .pb-16 (--ion-cust-padding = 24px) — padding
  // only, no fixed height, so the row grows with its content rather than
  // clipping at a hardcoded 56.
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  // Angular: .heading3-semibold-16 (global.scss:2204) — 16px, Poppins SemiBold,
  // weight 600 — plus .flex-1 .text-align-left .black-color.
  headerTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, flex: 1, textAlign: 'left' },
  // Angular: .ml-12 (global.scss:1226) — 12px, not 16.
  headerClose: { marginLeft: 12 },

  // Angular: the list wrapper (recharge.page.html:138-139) is .pl-24-rem
  // .pr-24-rem .pb-12 — 24px each side, 12px BELOW, and NO top padding at
  // all; the gap under the header is entirely the header's own pb-16.
  // .benefit-card-gap (recharge.page.scss:380) is a flex column with
  // gap: 1.25rem = 20px. Cards themselves carry no margin.
  //
  // ADJUSTABLE — paddingTop is the header-to-first-card gap. Going much below
  // ~23 starts clipping the "Most Sold" badge, which overhangs its card's top
  // edge by 22.4px: Angular lets that bleed up into the header's padding, but
  // RN's ScrollView clips at the content box instead.
  content: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 12, gap: 20 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary },

  cardWrap: { marginTop: 20 },

  onlyForYouTab: {
    position: 'absolute', top: -20, left: 0, height: 40, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  onlyForYouText: { fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium, fontSize: 10, color: Colors.white },

  // Angular: .most-popular (benefits-card.component.scss:58-66) — a child of
  // the card, top:-1.4rem (-22.4px), left:27px, padding 4px 8px, radius 20.
  // Both RN and CSS measure an absolutely-positioned child from the parent's
  // padding box, so these are used as-is — an earlier version subtracted the
  // card's 12px padding from each, which lifted the badge a full 34px and
  // parked it against the PREVIOUS card instead of its own.
  // ADJUSTABLE — `top` more negative lifts the badge clear of the card; less
  // negative sinks it further in. At -11 it straddles the border half-and-half.
  mostSoldBadge: {
    position: 'absolute', top: -14, left: 30, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  // Angular: .font-10-medium (global.scss:2291) — 10px, weight 500, white.
  // No line-height class is applied there, so it falls to the browser's
  // ~1.5 default (15px). RN's own default differs per platform/font, so it's
  // pinned here to keep the badge the same ~23px tall (15 + 4px padding x2)
  // that the -22.4px top offset is calibrated against.
  mostSoldText: { fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium, fontSize: 10, lineHeight: 15, color: Colors.white },

  // Angular: .intermediate-item-block (benefits-card.component.scss:1-13) —
  // 12px padding all round, radius 16, white, 1px #8A8A8A border and NO
  // shadow. The shadow belongs to the selected state only (:52-56), so it
  // moved out of here.
  card: {
    borderRadius: 16, padding: 12, backgroundColor: Colors.white,
  },
  // Angular: .intermediate-item-block.item-radio-checked (:52-56) — 2px
  // #B50033 plus box-shadow 0 3px 8px rgba(0,0,0,.12) (blur 8, not 4).
  cardSelected: {
    borderWidth: 2, borderColor: Colors.primaryDark,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  cardUnselected: { borderWidth: 1, borderColor: Colors.borderNeutral },

  cardTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTopLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  // Angular: ion-radio::part(container) 20x20, ::part(mark) 12x12
  // (benefits-card.component.scss:68-76) — the outer ring is 20, not 24.
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.borderNeutral,
    // ADJUSTABLE — vertical position of the radio circle. Increase to push it
    // further down, decrease (or 0) to pull it up toward the card's top edge.
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  radioCircleSelected: { borderColor: Colors.primaryDark },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark },

  // Angular: .mt-4 .font-14-semibold .mb-4 .black-color — 14px Poppins
  // SemiBold with 4px above AND below.
  durationText: { fontFamily: Fonts.poppinsSemiBold, fontSize: 14, color: Colors.black, marginTop: 4, marginBottom: 4 },
  // Angular: .color-222222 .body2-regular-14 .pl-2 — the 2px is padding-LEFT,
  // not a top margin (the 4px gap above comes from durationText's own mb-4).
  typeText:     { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: '#222222', paddingLeft: 2 },

  cardTopRight: { alignItems: 'flex-end' },
  // Angular: .d-flex .align-center-item .mb-4 — the 4px gap between the two
  // prices is the final price's own .ml-4, and both carry .mt-4.
  priceRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  // Angular: <del> .body3-regular-12 .mt-4 .color-999999 — 12px, #999999,
  // line-through from the <del> element itself.
  strikePrice:  { fontSize: 12, color: Colors.textPlaceholder, textDecorationLine: 'line-through', marginTop: 4 },
  // Angular: .heading3-semibold-16 .mt-4 .ml-4 .black-color — 16px SemiBold.
  // Angular: .heading3-semibold-16 .poppins-family — 16px semibold. Kept
  // semibold here (the .poppins-family override only swaps the FAMILY to
  // Roboto, which RN has no equivalent for) and the SIZE trimmed instead, so
  // it stops reading larger than Angular's.
  // ADJUSTABLE — fontSize is the price's size.
  finalPrice:   { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: Colors.black, marginTop: 4, marginLeft: 4 },
  // Angular: .textcta-medium-12 + .font-10-nav both apply; .font-10-nav sits
  // later in global.scss so 10px wins the size, while .textcta-medium-12's
  // !important weight:500 wins the weight. Plus .pr-2 (padding-right 2px) —
  // there is no top margin on this element.
  saveText:     { fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium, fontSize: 10, color: '#00A650', paddingRight: 2 },

  // Angular: .hr-line-payment (benefits-card.component.scss:45-50) — a 1px
  // #e6e6e6 filled div inset 5px each side, with .mt-12/.mb-12 around it.
  divider: { height: 1, backgroundColor: '#e6e6e6', marginHorizontal: 5, marginVertical: 12 },

  // Angular: each benefit row is .mt-12 (12px above), with the gap to the
  // text being .ml-4 + .pl-4 = 8px total.
  benefitRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  // Angular: row 2's icon carries .ml-2 to re-centre the narrower 18px glyph.
  benefitIconSm: { marginLeft: 2 },
  // Angular: .body3-regular-12 .line-height-16 — 12px, line-height 16.
  benefitText: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, lineHeight: 16 },
  // Angular: the emphasis is server-supplied <b> markup, so it renders at the
  // UA-default weight 700 at the SAME 12px size — it is not bumped to 14px.
  benefitBold: { fontFamily: Fonts.poppinsSemiBold, fontWeight: '700' },

  // Angular: app-button-revamp buttonSize=linkmedium (button-revamp.component
  // .scss:213) — padding 6px top/bottom, 0 left/right, height auto, and NO
  // underline anywhere in that class (RN previously drew one). iconPosition
  // 'end' puts the grey forward chevron after the label.
  // Angular's .benefit-card-gap gap:20px applies only BETWEEN the cards, but
  // RN's content container puts its gap between every child — including this
  // link — so the 20 is cancelled here and replaced with Angular's own mt-8.
  // ADJUSTABLE — marginTop is the card-to-link gap (-20 cancels the container
  // gap, so -12 nets out to the 8px Angular specifies).
  viewAllRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, marginTop: -12 },
  // Angular: ctaFontSize regular14 + linkmedium's own span{font-weight:500},
  // textColor greyColor = --ion-color-grey-color (#545454, variables.scss:179).
  viewAllText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: '#545454', lineHeight: 20 },

  offerBanner: {
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: Colors.membershipCardBg, alignItems: 'center',
  },
  offerBannerText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#7A1739', textAlign: 'center', lineHeight: 16 },

  // Angular: <ion-footer class="footer-shadow"> (recharge.page.scss:391) —
  // box-shadow 0 -3px 16px rgba(0,0,0,.08); the inner row is .pl-24 .pr-24
  // .pb-24, and the Pay button's own column carries .mt-8.
  footer: {
    paddingHorizontal: 24, paddingTop: 12,
    backgroundColor: Colors.white,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 8,
  },

  // "View other packages" sheet
  sheetInner:       { maxHeight: '100%' },
  // The BottomSheet applies paddingHorizontal: 24, which would inset this
  // list and leave its scrollbar floating 24px in from the screen edge. The
  // negative margins cancel that so the list spans the sheet's full width and
  // the scrollbar rides the right edge; the 24px is re-applied to the content
  // instead, so the cards themselves stay where they were.
  sheetList:        { marginHorizontal: -24 },
  // paddingTop replaces the space the removed sheet heading's marginBottom
  // used to provide, and gives the first card's "Most Sold" badge (which
  // overhangs its card by 22.4px) room so it isn't clipped by the ScrollView.
  // paddingHorizontal restores the 24px the negative margin above cancelled.
  // ADJUSTABLE — raise paddingTop for more space above the first card.
  sheetListContent: { gap: 20, paddingTop: 24, paddingBottom: 8, paddingHorizontal: 24 },

  // Angular: link-cta.component.html — the wrapper is .mt-12 (12px above),
  // "Need help?" is .body3-regular-12 .line-height-18 .black-color .mr-8
  // (8px gap, not 4), and the number is .body1-medium-14-all .line-height-18
  // .color-29339B with .ml-4 from the phone icon.
  needHelpRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  needHelpText:    { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black, lineHeight: 18, marginRight: 8 },
  needHelpContact: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  needHelpNumber:  { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.link, lineHeight: 18, marginLeft: 4 },
})
