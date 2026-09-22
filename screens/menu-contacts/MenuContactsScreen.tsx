// Angular: pages/menu-contacts/menu-contacts.page.ts(+.html) — despite the
// folder name (and this screen's earlier stub comment), the LIVE content of
// that file is the "My Membership" page (package usage, auto-renewal,
// pending-payment/EMI status, transaction history, refund) — served at both
// '/menu-contacts' and '/my-membership'. Its own commented-out
// callApiForContactList()/viewedByYouList code, and the separate
// menu-contacts/list/list.page.ts, are DEAD Angular code — that "who viewed/
// shared your number" feature was superseded long ago by activity.component.ts
// and messager-list.component.ts, both already fully ported here as
// ActivityScreen.tsx / MessagerListScreen.tsx. This screen's one real entry
// point is HomeScreen.tsx's autopay-renewal sticky banner.
//
// Restyled to match Figma "Jodii Desktop - Registration" nodes 551:89 ->
// 555:8499 (desktop) and "Jodii Auto-Renewal" nodes 24:680 -> 135:8293
// (mobile) — see membershipTierTheme.ts for the tier-color mapping this pulls
// in, and MenuContactsDesktopLayout.tsx for the desktop presentational split.
//
// Deliberately out of scope (documented rather than silently dropped):
//   - RENEWALENABLEKEY localStorage gate on Renew Plan — not tracked
//     client-side anywhere in this port; gating on emicomplete alone stands in.
//   - reDirectRecharePage()'s real target (an untraced "Super pack
//     intermediate page") — routes to the already-built 'recharge' screen.
//   - The auto-triggered first-visit attention popover (1.9s timer) — the
//     popover still works on tap, just without the automatic trigger.
//   - Refund-decline's used-contacts count via a separate activity API call —
//     uses CONTACT_DETAIL.phoneNumbersUsed directly if present.
//   - The Figma "Super pack upgrade upsell" card (rocket icon, "pay extra
//     ₹250", offer countdown) — confirmed dead/disabled code in the old
//     Angular app too (`*ngIf="false"`, hardcoded placeholder copy), with no
//     real backend field ever built to drive it. Not building fake numbers.
import { useEffect, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Toggle from '../../components/toggle/Toggle'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import BottomSheet, { type BottomSheetData } from '../../components/bottom-sheet/BottomSheet'
import Popover from '../../components/popover/Popover'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT, CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import { fetchContactDetails } from '../../service/communicationService'
import { getJson } from '../../service/storageService'
import { getPPSetData } from '../../service/profileService'
import { handleBack } from '../../utils/navigationRef'
import { getSessionValue } from '../../service/registrationService'
import { updateAutoRenewal, requestAutopayRefund, stripHtml, getMenuPromo } from '../../service/paymentService'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import { getMembershipTierTheme } from './membershipTierTheme'
import MenuContactsDesktopLayout from './MenuContactsDesktopLayout'
import AppFooter, { type FooterTab } from '../../components/app-footer/AppFooter'
import { handleFooterTabPress } from '../../utils/footerTabPress'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

const ICONS = {
  back:      CDN_REACT + '/menu_back_arrow.svg',
  // Angular: menu-contacts.page.html:556 — common.ImgDomain() + 'assets/images/svg/attention-black-img.svg'.
  info:      CDN + 'assets/images/svg/attention-black-img.svg',
  lostBenefit: CDN + 'revamp/close-icon.svg',
  crown:     CDN_SVG + 'revamp/crown-white.svg',
  // Both already proven in this exact app: alert-circle via
  // PaymentRestrictedSheet.tsx, green_tick via paymentService.ts's
  // AUTO_RENEWAL_BENEFITS_FALLBACK — reused instead of sourcing new assets.
  alert:     CDN + 'assets/images/svg/alert-circle.svg',
  success:   CDN_SVG + 'green_tick.svg',
}

type UsageRow = {
  icon?: string
  title?: string
  balance?: string | number
  value?: string | number
  total?: string | number
  warningcnt?: string | number
  subcontent?: string
  type?: string
}

type EmiStep = { icon?: string; key?: string; cta?: string; value?: string }

type TxnRow = { packname?: string; packduration?: string; amount?: string; paydate?: string }

type MissingBenefit = { icon?: string; value?: string }

export default function MenuContactsScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()
  const { height: winH } = useWindowDimensions()
  // Angular: .membership-payment-successful-img { width: 4vh } — 4% of the
  // VIEWPORT HEIGHT (menu-contacts.page.scss:175), an unusual unit for an
  // icon but that is what ships. RN has no vh, so it is computed here.
  const paymentIconSize = Math.round(winH * 0.04)

  // Angular: menu-contacts.page.ts:95 — router state header 1/3 (i.e. arrived
  // from the bottom nav) sets BACK_ICON:'0', and the template's
  // *ngIf="[1,3].includes(header)" is what renders <app-footer>. So the back
  // arrow and the tab bar are two faces of the same flag, never both shown.
  const fromTab = !!route?.params?.fromTab

  // Membership tap is a no-op here — already on the Membership destination,
  // and re-firing openMembershipTab()'s own navigate() would push a
  // duplicate instance of this screen on top of itself.
  const handleTabPress = (tab: FooterTab) => handleFooterTabPress(navigation, tab, null)

  // Angular: footer.component.ts:97-100 — upgradeTag = getMenuPromo()'s
  // MENUDISCOUNT ('' when absent), the "₹1200 OFF" chip over the Membership
  // tab. It is server-rendered copy (symbol, amount and "OFF" all come from
  // nbmenu), so it is never built or translated client-side. getMenuPromo
  // caches, so fetching it here costs nothing extra.
  const [upgradeTag, setUpgradeTag] = useState('')
  useEffect(() => {
    if (!fromTab) return
    let cancelled = false
    getMenuPromo().then(promo => {
      if (!cancelled) setUpgradeTag(String(promo?.MENUDISCOUNT ?? ''))
    })
    return () => { cancelled = true }
  }, [fromTab])

  const [loading, setLoading] = useState(true)
  const [contactDetail, setContactDetail] = useState<Record<string, any> | null>(null)
  const [autoRenewOn, setAutoRenewOn] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showCancelSuccess, setShowCancelSuccess] = useState(false)
  const [showRefundConfirm, setShowRefundConfirm] = useState(false)
  const [refundResult, setRefundResult] = useState<'success' | 'decline' | null>(null)
  const [refundUsedContacts, setRefundUsedContacts] = useState<string | undefined>(undefined)

  const [attentionInfo, setAttentionInfo] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [, ppSetData, entryType] = await Promise.all([
        // Angular menu-contacts.page.ts:164 — the one page-load caller that
        // passes Flag=1: this screen exists to SHOW the quota, so it always
        // refetches rather than trusting the cache.
        fetchContactDetails(true),
        getPPSetData(),
        getSessionValue('ENTRYTYPE'),
      ])
      if (cancelled) return
      const detail = await getJson<Record<string, any>>('CONTACT_DETAIL')
      if (cancelled) return
      setContactDetail(detail)
      setAutoRenewOn(String(detail?.MEMBERSHIPDETAILS?.autorenewalstatus) === '1')
      // Angular: getPPSETData()'s membershipExpiry = NUMBEROFPAYMENTS > 0,
      // combined with ENTRYTYPE=='F' (HomeScreen.tsx's footer-badge uses the
      // same two-part formula) — a fully-lapsed membership, distinct from the
      // "expiring soon" urgency badge below (which is still an ACTIVE plan).
      setIsExpired(Number(ppSetData?.NUMBEROFPAYMENTS ?? 0) > 0 && String(entryType) === 'F')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const membership   = contactDetail?.MEMBERSHIPDETAILS ?? null
  const paymentInfo  = contactDetail?.PAYMENTDETAILS ?? null
  const transactions = contactDetail?.PAYMENTTRANSACTION ?? null

  const [planTitle, planDuration] = String(membership?.packageName ?? '')
    .split('-')
    .map((part: string) => part.trim())

  const expiryDays = Number(contactDetail?.membershipExpiryDays ?? 99)
  const isExpiring = !isExpired && expiryDays <= 5

  const tierTheme = getMembershipTierTheme(membership?.packagetype)

  // Angular: menu-contacts.page.ts, JODII-499 "the chats left row of the usage
  // details is shown again" — this used to filter it out (JODII-383), which
  // JODII-499 reverted as part of the message relaunch. No filter here anymore.
  const usageRows: UsageRow[] = Array.isArray(membership?.CONACTDETAILS)
    ? membership.CONACTDETAILS
    : []

  const missingBenefits: MissingBenefit[] = Array.isArray(membership?.benefits) ? membership.benefits : []

  const emiSteps: EmiStep[] = Array.isArray(paymentInfo?.emidetails) ? paymentInfo.emidetails : []
  const txnRows: TxnRow[] = Array.isArray(transactions?.DATA) ? transactions.DATA : []

  // Angular: menu-contacts.page.ts:325-328 showRenewalButton() — BOTH
  // emicomplete == '0' AND RENEWALENABLEKEY == '1'. The renewal key is read
  // from session storage the same way getMenuPromo()/getPromotionDetails()
  // already do, so the second half of the gate no longer has to be skipped.
  const [renewalEnabled, setRenewalEnabled] = useState(false)
  useEffect(() => {
    getSessionValue('RENEWALENABLEKEY').then(v => setRenewalEnabled(String(v ?? '0') === '1'))
  }, [])
  const showRenewalButton = String(paymentInfo?.emicomplete ?? '1') === '0' && renewalEnabled
  const showRenewPlan = showRenewalButton

  function rowIsWarning(row: UsageRow): boolean {
    const balance = Number(row.balance ?? row.value ?? 0)
    const warn = Number(row.warningcnt ?? NaN)
    return Number.isFinite(warn) && balance <= warn
  }

  // Angular: presentPopover() — the chat row gets its own attention copy
  // (MEMBERSHIP_CHAT); keyed off the row's actual type now that the chat row
  // is no longer filtered out, rather than a hardcoded index that only ever
  // matched by accident.
  function handleAttentionPress(row: UsageRow) {
    setAttentionInfo({
      title: t('GENERAL.ATTENTION', 'Attention!'),
      content: row.type === 'chat'
        ? t('GENERAL.MEMBERSHIP_CHAT', 'BharatJodii chat messages sent to members who have deleted their profiles afterwards are also included in this count')
        : t('GENERAL.MEMBERSHIP_ATTENTION', 'Phone numbers viewed of members who have deleted their profiles afterwards are also included in this count'),
    })
  }

  function handleToggleAutoRenew(next: boolean) {
    if (next) {
      setAutoRenewOn(true)
      updateAutoRenewal('1')
    } else {
      // Optimistic: flip off immediately, then confirm — matches Angular's
      // toggleAutoRenewal() (sets the checkbox false right away, before the
      // confirmation sheet even resolves).
      setAutoRenewOn(false)
      setShowCancelConfirm(true)
    }
  }

  async function confirmCancelAutoRenew() {
    setShowCancelConfirm(false)
    await updateAutoRenewal('2')
    setShowCancelSuccess(true)
  }

  function declineCancelAutoRenew() {
    setShowCancelConfirm(false)
    setAutoRenewOn(true)
  }

  async function confirmRefund() {
    setShowRefundConfirm(false)
    const result = await requestAutopayRefund()
    setRefundUsedContacts(result.usedContacts ?? contactDetail?.['phoneNumbersUsed'])
    setRefundResult(result.accepted ? 'success' : 'decline')
  }

  function goToRecharge() {
    navigation.navigate('recharge')
  }

  // ── Sheet content ────────────────────────────────────────────────────────

  const cancelData = contactDetail?.CANCELAUTORENEWAL
  const cancelSheet: BottomSheetData = {
    image: ICONS.alert,
    title: cancelData?.TITLE ?? 'Are you sure you want to cancel auto-renewal?',
    content: cancelData?.CONTENT ?? "Your auto-renewal will be cancelled and you won't be charged any more",
    benefits: (Array.isArray(cancelData?.DISABLEBENEFITS) ? cancelData.DISABLEBENEFITS : [
      "You can't Call/WhatsApp matches",
      "You can't view horoscope of matches",
    ]).map((b: any) => ({ icon: ICONS.lostBenefit, value: typeof b === 'string' ? b : b?.value ?? '' })),
    ctaLabel: cancelData?.CTA ?? 'Yes, cancel',
    secondaryCtaLabel: cancelData?.CTA1 ?? "Don't cancel",
    showSecondaryCta: true,
  }

  const cancelSuccessSheet: BottomSheetData = {
    lottie: CDN_LOTTIE + 'success-new.json',
    title: cancelData?.SUCCESS?.TITLE ?? 'Auto-renewal cancelled successfully!',
    content: cancelData?.SUCCESS?.CONTENT
      ?? `You can use your membership benefits till ${membership?.expiryTextVal ?? ''} and after that you won't be charged any more`,
    ctaLabel: cancelData?.SUCCESS?.CTA ?? 'Got it',
  }

  const refundData = contactDetail?.REFUNDDET
  const refundConfirmSheet: BottomSheetData = {
    image: ICONS.alert,
    title: refundData?.TITLE ?? 'Request a Refund?',
    content: refundData?.CONTENT ?? 'This will cancel your current plan and you will lose access to all premium features immediately.',
    ctaLabel: refundData?.CTA ?? 'Request refund',
    secondaryCtaLabel: refundData?.CTA1 ?? 'Go back',
    showSecondaryCta: true,
  }
  const refundSuccessSheet: BottomSheetData = {
    lottie: CDN_LOTTIE + 'success-new.json',
    title: refundData?.SUCCESS?.TITLE ?? 'Refund initiated!',
    content: refundData?.SUCCESS?.CONTENT ?? 'Your amount will be credited into your bank account within 3-7 business days.',
    ctaLabel: refundData?.SUCCESS?.CTA ?? 'Got it',
  }
  const refundDeclineSheet: BottomSheetData = {
    title: refundData?.CANCEL?.TITLE ?? 'Refund declined!',
    content: refundData?.CANCEL?.CONTENT
      ?? `You have viewed ${refundUsedContacts ?? '0'} contacts. As per policy refund is not applicable.`,
    ctaLabel: refundData?.CANCEL?.CTA ?? 'Got it',
  }

  // ── Desktop web layout (Figma "Jodii Desktop - Registration", nodes
  // 551:89 -> 555:8499) — wide browser window only; this screen still owns
  // all state/handlers, passed down as props (same split as RechargeScreen/
  // PaymentOptionsScreen). The 4 BottomSheet flows below are shared as-is —
  // BottomSheet already renders as a centered dialog on desktop internally.
  if (isDesktop) {
    return (
      <MenuContactsDesktopLayout
        loading={loading}
        membership={membership}
        paymentInfo={paymentInfo}
        planTitle={planTitle}
        planDuration={planDuration}
        isExpired={isExpired}
        isExpiring={isExpiring}
        tierTheme={tierTheme}
        usageRows={usageRows}
        missingBenefits={missingBenefits}
        emiSteps={emiSteps}
        txnRows={txnRows}
        showRenewPlan={showRenewPlan}
        autoRenewOn={autoRenewOn}
        onToggleAutoRenew={handleToggleAutoRenew}
        onRequestRefund={() => setShowRefundConfirm(true)}
        onGoToRecharge={goToRecharge}
        onAttentionPress={handleAttentionPress}
        rowIsWarning={rowIsWarning}
        langCode={i18n.language}
        onTabPress={handleTabPress}
        onLanguagePress={() => navigation.navigate('LanguageSelection')}
        cancelSheet={cancelSheet}
        cancelSuccessSheet={cancelSuccessSheet}
        refundConfirmSheet={refundConfirmSheet}
        refundSuccessSheet={refundSuccessSheet}
        refundDeclineSheet={refundDeclineSheet}
        showCancelConfirm={showCancelConfirm}
        showCancelSuccess={showCancelSuccess}
        showRefundConfirm={showRefundConfirm}
        refundResult={refundResult}
        attentionInfo={attentionInfo}
        onConfirmCancelAutoRenew={confirmCancelAutoRenew}
        onDeclineCancelAutoRenew={declineCancelAutoRenew}
        onCloseCancelSuccess={() => setShowCancelSuccess(false)}
        onConfirmRefund={confirmRefund}
        onCloseRefundConfirm={() => setShowRefundConfirm(false)}
        onCloseRefundResult={() => setRefundResult(null)}
        onCloseAttentionInfo={() => setAttentionInfo(null)}
      />
    )
  }

  return (
    <View style={s.screen}>
      <ScreenTopInset />
      {/* Angular: header.component.html:107-120 (the TYPE 'header2' branch) —
          the back button is hidden (BACK_ICON '0') whenever the page was
          reached from the bottom nav, leaving the title flush at the row's
          own pl-16. */}
      <View style={s.header}>
        {!fromTab && (
          <Pressable style={s.backBtn} onPress={() => handleBack()} accessibilityRole="button" accessibilityLabel="Back">
            <CdnSvg uri={ICONS.back} width={24} height={24} />
          </Pressable>
        )}
        <Text style={[s.headerTitle, fromTab && s.headerTitleNoBack]} numberOfLines={1}>{t('GENERAL.MEMBERSHIP_HEADER', 'My Membership')}</Text>
      </View>

      {loading ? (
        <View style={s.loaderContainer}>
          <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
        </View>
      ) : !membership ? (
        <View style={s.loaderContainer}>
          <Text style={s.emptyText}>
            {t('GENERAL.NOINTERNET', "We couldn't load your membership details. Please check your connection and try again.")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>

          {/* ── Membership hero card ── */}
          <View style={s.card}>
            <LinearGradient
              colors={tierTheme.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={s.heroTop}
            >
              {/* Angular: menu-contacts.page.html:12 — the label is bound
                  straight from MEMBERSHIPDETAILS.membershipStatus and rendered
                  only when that field is present; membershipExpiryDays <= 5
                  picks the styling class alone, never the wording. RN was
                  building this string client-side in English ("Expiring in 3
                  days" / "Membership Expired" / "Active"), which every
                  non-English user would have seen untranslated. */}
              {!!membership.membershipStatus && (
                <View style={[s.statusBadge, isExpired || isExpiring ? s.statusBadgeWarn : s.statusBadgeActive]}>
                  <Text style={[s.statusBadgeText, isExpired || isExpiring ? s.statusBadgeTextWarn : s.statusBadgeTextActive]} numberOfLines={1}>
                    {stripHtml(membership.membershipStatus)}
                  </Text>
                </View>
              )}

              <View style={s.heroRow}>
                <View style={s.heroTextCol}>
                  {/* Angular: menu-contacts.page.html:303 — the expired-state
                      heading is bound straight to packageName, which the API
                      already returns as the full sentence ("Your Basic
                      Membership has expired!"). RN was assembling that
                      sentence in English around the plan name instead. */}
                  {/* Angular: menu-contacts.page.html:673-674 — the expired
                      heading is heading4-medium-16 (Poppins-Medium, not the
                      active state's heading3-semibold-16), and its date line
                      is body3-regular-12 (12px), not body2-regular-14 (14px). */}
                  <Text style={isExpired ? s.planTitleExpired : s.planTitle} numberOfLines={2}>
                    {isExpired
                      ? stripHtml(String(membership.packageName ?? ''))
                      : (planTitle || membership.packageName || '')}
                  </Text>
                  {isExpired
                    ? !!membership.packexpirytext && <Text style={s.planDurationExpired}>{stripHtml(membership.packexpirytext)}</Text>
                    : !!planDuration && <Text style={s.planDuration}>{planDuration}</Text>}
                </View>
                {/* Angular: menu-contacts.page.html:19 and :307 — both hero
                    states render MEMBERSHIPDETAILS.headericon as a bare
                    <ion-img> with NO circular wrapper; the coloured disc is
                    baked into the API-supplied artwork itself. RN was drawing
                    its own tinted circle around a local crown/alert asset,
                    which double-draws the disc and ignores whatever icon the
                    backend picked for the tier. Falls back to the local pair
                    only if the API omits the field. */}
                {membership.headericon ? (
                  <CdnSvg uri={String(membership.headericon)} width={48} height={48} />
                ) : (
                  <View style={[s.crownBadge, { backgroundColor: isExpired ? Colors.primaryDark : tierTheme.crownBadgeBg }]}>
                    <CdnSvg uri={isExpired ? ICONS.alert : ICONS.crown} width={28} height={28} />
                  </View>
                )}
              </View>
            </LinearGradient>

            {isExpired ? (
              <View style={s.expiredBody}>
                {/* Angular: menu-contacts.page.html:682 — [innerHTML]="MEMBERSHIPDETAILS?.content"
                    (same API field the active state's "Package Usage Details" heading reads),
                    class "semibold-14-font black-color" — semibold-14-font has no English
                    definition (Gurmukhi-only), so it falls back to the same inherited
                    Poppins-Regular/black usageTitle already reproduces. */}
                {!!membership.content && <Text style={s.usageTitle}>{stripHtml(String(membership.content))}</Text>}
                {missingBenefits.map((b, idx) => (
                  <View key={idx} style={s.usageRow}>
                    {/* Angular: .package-usage-details-block ion-img { width:24px; height:24px } */}
                    {!!b.icon && <CdnSvg uri={b.icon} width={24} height={24} />}
                    <Text style={s.usageTitle}>{b.value}</Text>
                  </View>
                ))}
                <ButtonRevamp
                  label={t('MENU.RENEW_PLAN', 'Renew plan')}
                  variant="primary" size="standard" fullWidth
                  icon="forward-icon-white" iconPosition="end"
                  onPress={goToRecharge}
                  style={s.renewPlanBtn}
                />
              </View>
            ) : (
              <>
                {/* Auto-renewal toggle */}
                {String(membership.autorenewalsection) === '1' && (
                  <View style={s.renewRow}>
                    <View style={s.renewTextCol}>
                      <Text style={s.renewLabel}>{t('RECHARGE.AUTORENEWAL', 'Auto renewal')}</Text>
                      {!!membership.expiryTextVal && <Text style={s.renewSub}>{membership.expiryTextVal}</Text>}
                    </View>
                    <Toggle
                      value={autoRenewOn}
                      onValueChange={handleToggleAutoRenew}
                    />
                  </View>
                )}

                {/* Refund note — Angular: menu-contacts.page.html:515-524, a
                    bordered white box (.auto-renewal-refund-box), not plain
                    inline text. */}
                {String(membership.payrefundsection) === '1' && (
                  <View style={s.refundNoteBox}>
                    <Text style={s.refundNoteText}>
                      {t('RECHARGE.AUTORENEWAL_NOTE', 'Get full refund even after renewal, if no paid benefits are used')}{'  '}
                      <Text style={s.refundLink} onPress={() => setShowRefundConfirm(true)}>
                        {t('RECHARGE.TAP_HERE', 'Tap here')}
                      </Text>
                    </Text>
                  </View>
                )}

                {/* Angular: menu-contacts.page.html:48-56 — the strip leads
                    with MEMBERSHIPDETAILS.timericon (an API URL), which RN
                    omitted, and its background is hardcoded to the -basic
                    variant rather than following packagetype. */}
                {!!membership.packexpirytext && (
                  <View style={s.footerStrip}>
                    {!!membership.timericon && (
                      <CdnSvg uri={String(membership.timericon)} width={12} height={12} />
                    )}
                    <Text style={s.expiryText}>{stripHtml(membership.packexpirytext)}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Package usage details ──
              Angular: menu-contacts.page.html:61-62 — the heading is a SIBLING
              ABOVE the card (mt-40), not a row inside it, and it uses
              font-14-semibold (14px) while the two headings further down use
              heading3-semibold-16 (16px). The three section headings are
              genuinely inconsistent in Angular; this reproduces that. */}
          {!isExpired && usageRows.length > 0 && (
            <>
              <Text style={s.sectionTitleUsage}>{membership.content ?? ''}</Text>
              <View style={s.usageCard}>
                {usageRows.map((row, idx) => {
                  const warning = rowIsWarning(row)
                  // Angular: .bottom-border-e5e5e5 on every row, suppressed by
                  // :last-child — but the Renew Plan row, when present, IS the
                  // real last child, so the final usage row keeps its divider.
                  const isLast = idx === usageRows.length - 1 && !showRenewalButton
                  return (
                    // Angular: menu-contacts.page.html:547-569 — icon(1)+title(6)+
                    // balance(5) already fill all 12 grid columns, so subcontent's
                    // ion-col (no size) wraps to its OWN full-width line below,
                    // starting flush left — not indented under the title.
                    <View key={idx} style={[s.usageRowOuter, !isLast && s.usageRowDivided]}>
                      <View style={s.usageRowInner}>
                        {!!row.icon && <CdnSvg uri={row.icon} width={24} height={24} />}
                        <Text style={s.usageTitle}>{row.title}</Text>
                        {warning && (
                          <Pressable onPress={() => handleAttentionPress(row)} hitSlop={8} style={s.infoBtn}>
                            <CdnSvg uri={ICONS.info} width={16} height={16} />
                          </Pressable>
                        )}
                        {/* Angular: menu-contacts.page.html:81-82 — two spans at
                            DIFFERENT sizes: the count is heading3-semibold-16
                            (16px/600) and the "/total" is body1-medium-14
                            (14px/500), with the slash prepended in the template.
                            RN rendered the whole thing at one size. */}
                        <Text style={[s.usageBalance, warning && s.usageBalanceWarn]}>
                          {row.balance ?? row.value ?? 0}
                          {row.total != null && (
                            <Text style={[s.usageTotal, warning && s.usageBalanceWarn]}>{`/${row.total}`}</Text>
                          )}
                        </Text>
                      </View>
                      {!!row.subcontent && <Text style={s.usageSub}>{row.subcontent}</Text>}
                    </View>
                  )
                })}

                {/* Angular: menu-contacts.page.html:91-103 — the Renew Plan CTA
                    is the LAST ROW INSIDE this card (mt-16 mb-8), gated on
                    showRenewalButton() = emicomplete === '0' && RENEWALENABLEKEY
                    === '1'. This is Angular's only active-state Renew Plan; the
                    one this port previously had in the hero card had no
                    equivalent there. */}
                {showRenewalButton && (
                  <View style={s.renewRowInCard}>
                    <ButtonRevamp
                      label={t('MENU.RENEW_PLAN', 'Renew Plan')}
                      variant="primary" size="standard" fullWidth
                      icon="forward-icon-white" iconPosition="end"
                      onPress={goToRecharge}
                    />
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── Payment / EMI status ──
              Angular: menu-contacts.page.html:114-183 — heading OUTSIDE the
              card (mt-32 + mt-12), then a radius-16 card whose content row is
              the API's status icon beside the two text lines. */}
          {!isExpired && !!paymentInfo && (!!paymentInfo.content || emiSteps.length > 0) && (
            <>
              {!!paymentInfo.title && <Text style={s.sectionTitlePayment}>{paymentInfo.title}</Text>}
              {/* Angular: menu-contacts.page.html:600 — the EMI stepper is
                  gated on `emicomplete && emicomplete != '0'`, and sits in its
                  OWN bordered box (.how-it-works-block), separate from the
                  shadowed payment-success card below it — not one shared card. */}
              {emiSteps.length > 0 && String(paymentInfo.emicomplete ?? '') !== '0' && (
                <View style={s.emiCard}>
                  <View style={s.emiStepper}>
                    {emiSteps.map((step, idx) => (
                      <View key={idx} style={s.emiStep}>
                        {/* Angular: .data-icon-size { width:24px } */}
                        {!!step.icon && <CdnSvg uri={step.icon} width={24} height={24} />}
                        <Text style={s.emiKey} numberOfLines={1}>{step.key}</Text>
                        {String(step.cta) === '1' ? (
                          <ButtonRevamp label={step.value ?? 'Pay'} variant="primary" size="small" onPress={goToRecharge} />
                        ) : (
                          <Text style={s.emiValue}>{step.value}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!!paymentInfo.content && (
                <View style={s.paymentCard}>
                  <View style={s.paymentRow}>
                    {/* Angular: menu-contacts.page.html:177 — the green check is
                        PAYMENTDETAILS.icon (an API URL), sized 4vh by
                        .membership-payment-successful-img. RN omitted it
                        entirely. vh has no RN equivalent, so it's computed off
                        the window height the same way the CSS would resolve. */}
                    {!!paymentInfo.icon && (
                      <CdnSvg uri={String(paymentInfo.icon)} width={paymentIconSize} height={paymentIconSize} />
                    )}
                    <View style={s.paymentTextCol}>
                      <Text style={s.paymentContent}>{paymentInfo.content}</Text>
                      {!!paymentInfo.content2 && <Text style={s.paymentContent2}>{paymentInfo.content2}</Text>}
                    </View>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ── Payment transaction history ──
              Angular: menu-contacts.page.html:253-267 — the heading sits ABOVE
              (mt-32), and each transaction is its OWN bordered card with a
              12px gap, not a row inside one shared card. */}
          {txnRows.length > 0 && (
            <>
              <Text style={s.sectionTitle}>{transactions?.title ?? ''}</Text>
              {txnRows.map((txn, idx) => (
                <View key={idx} style={s.txnCard}>
                  <View style={s.usageTextCol}>
                    <Text style={s.txnName}>{txn.packname}</Text>
                    {!!txn.packduration && <Text style={s.txnSub}>{txn.packduration}</Text>}
                  </View>
                  <View style={s.txnRightCol}>
                    {/* Angular: [innerHTML]="'-'+transData?.amount" — the minus
                        is prepended to the API's already-formatted amount
                        string, which carries its own ₹. Re-parsing and
                        re-formatting it (as RN did) round-trips through a
                        number and drops any formatting the backend applied. */}
                    <Text style={s.txnAmount}>{`-${txn.amount ?? ''}`}</Text>
                    {!!txn.paydate && <Text style={s.txnSub}>{txn.paydate}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <BottomSheet
        visible={showCancelConfirm}
        data={cancelSheet}
        onClose={declineCancelAutoRenew}
        onPrimaryPress={confirmCancelAutoRenew}
        onSecondaryPress={declineCancelAutoRenew}
      />
      <BottomSheet
        visible={showCancelSuccess}
        data={cancelSuccessSheet}
        onClose={() => setShowCancelSuccess(false)}
        onPrimaryPress={() => setShowCancelSuccess(false)}
      />
      <BottomSheet
        visible={showRefundConfirm}
        data={refundConfirmSheet}
        onClose={() => setShowRefundConfirm(false)}
        onPrimaryPress={confirmRefund}
        onSecondaryPress={() => setShowRefundConfirm(false)}
      />
      <BottomSheet
        visible={refundResult === 'success'}
        data={refundSuccessSheet}
        onClose={() => setRefundResult(null)}
        onPrimaryPress={() => setRefundResult(null)}
      />
      <BottomSheet
        visible={refundResult === 'decline'}
        data={refundDeclineSheet}
        onClose={() => setRefundResult(null)}
        onPrimaryPress={() => setRefundResult(null)}
      />
      <Popover
        visible={!!attentionInfo}
        type="attentionPopup"
        title={attentionInfo?.title}
        content={attentionInfo?.content}
        gotItLabel={t('GENERAL.GOT_IT', 'Got it')}
        onClose={() => setAttentionInfo(null)}
      />

      {/* Angular: menu-contacts.page.html:509 — <app-footer *ngIf="[1,3]
          .includes(header)">, i.e. the tab bar shows only when the page was
          reached from the bottom nav. footer.component.ts:79-83 marks
          '/my-membership' as select 3 (Membership). */}
      {fromTab && (
        <AppFooter activeTab={3} upgradeTag={upgradeTag || undefined} onTabPress={handleTabPress} />
      )}
    </View>
  )
}

// NOTE (was FontSize.font16/FontSize.font14/FontSize.font12 = 17/15/13): the reasoning behind those constants
// was right — Angular's root font-size DOES scale with the viewport, so every
// rem-based --fontNN renders larger than its name — but both the formula and
// the fixed-number approach were wrong:
//
//  1. They were derived from theme/variables.scss:15's
//     `--font-auto-resize: calc(13px + 1vw)`, which is OVERRIDDEN. Both that
//     file and _variable.scss:194 declare --font-auto-resize on :root at equal
//     specificity, and angular.json's styles array loads theme/variables.scss
//     BEFORE global.scss (which @imports _variable.scss) — so the later
//     declaration wins and the app actually renders with
//     `calc(0.325em + 3vw)`.
//  2. Being flat numbers they only matched at one screen width. At the 412px
//     they were tuned for the real values are 17.6/15.4/13.2 (close enough),
//     but on a 360px phone they are ~6% too large (real: 16.0/14.0/12.0) and
//     on a 430px one ~6% too small (real: 18.1/15.8/13.6).
//
// src/theme/fonts.ts's FontSize.fontNN already implements the WINNING formula
// (REM_BASE_PX = 0.325*16 + 0.03*SCREEN_W) and is what every other screen in
// this app uses, so the three constants are replaced by the tokens for the
// exact same --font16 / --font14 / --font12 they were standing in for.

const s = StyleSheet.create({
  // Angular: no --ion-background-color override exists for this page, so
  // ion-content falls through to Ionic's white default (RN had a grey tint).
  screen: { flex: 1, backgroundColor: Colors.white },

  // Angular: the header row carries .border-bottom-search (global.scss:26409)
  // — a 1px #f1f5f9 bottom border — and Ionic's md header shadow is explicitly
  // zeroed out by .hide-header-bar.header-md::after { height: 0 }
  // (global.scss:2737), so there is NO box-shadow here. RN had the inverse:
  // a drop shadow and no border.
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  // Angular: .heading4-medium-16 (global.scss:2217) — 16px, Poppins-Medium,
  // weight 500, #333333.
  headerTitle: { flex: 1, fontSize: FontSize.font16, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: '#333333', marginLeft: 6, marginRight: 16 },
  // Angular: with the back button hidden its column collapses to size 0 and
  // the row itself takes .pl-16 (global.scss:877) instead.
  headerTitleNoBack: { marginLeft: 16 },

  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  // No Angular counterpart — menu-contacts.page has no load-failure state.
  // Tokenised only, value unchanged.
  emptyText: { fontSize: FontSize.font14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Angular: the body is .pl-24 .pr-24 (--ion-cust-padding = 24px) on a plain
  // white ion-content, with .mt-24 above the hero card and .mb-24 at the end.
  // The `gap` is gone: every section below carries its own Angular margin
  // (mt-40 / mt-32 / mt-12), and a container gap would stack on top of those.
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },

  // Angular: .membership-package-block (menu-contacts.page.scss:90) — radius
  // 10 (RN had 16) and shadow 0 4px 12px rgba(0,0,0,.08). overflow hidden
  // keeps the gradient inside the rounded corners.
  card: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },

  // Angular: menu-contacts.page.html:13 — .pl-16 .pr-16 .pt-24 .pb-24, i.e.
  // 24px top/bottom and 16px left/right (RN had a flat 16 all round). The
  // status pill is absolutely positioned over the card's top-left corner, so
  // the clearance beneath it is this top padding — ADJUSTABLE: raise
  // paddingTop to push "Basic membership" further below the pill.
  heroTop: { paddingHorizontal: 16, paddingTop: 36, paddingBottom: 24 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroTextCol: { flex: 1 },

  // Angular: .membership-expiring-membership / .active-membership
  // (menu-contacts.page.scss:94-115) — absolutely pinned to the card's
  // top-left, with only the top-left and bottom-right corners rounded (10px)
  // and a 2px white ring. RN had it in normal flow with a uniform 12px
  // radius, so it sat below the corner instead of over it.
  statusBadge: {
    position: 'absolute', top: 0, left: 0, zIndex: 2,
    borderTopLeftRadius: 10, borderBottomRightRadius: 10,
    borderTopRightRadius: 0, borderBottomLeftRadius: 0,
    borderWidth: 2, borderColor: Colors.white,
    paddingVertical: 4,
  },
  // Angular: the green "active" variant is padded 4px 24px, the red expiring
  // variant 4px 8px — the two are not interchangeable.
  statusBadgeActive: { backgroundColor: '#10B981', paddingHorizontal: 24 },
  statusBadgeWarn: { backgroundColor: '#EF4444', paddingHorizontal: 8 },
  statusBadgeText: { fontSize: FontSize.font12, fontFamily: Fonts.poppinsMedium, color: Colors.white },
  statusBadgeTextActive: {},
  statusBadgeTextWarn: {},

  // Angular: .heading3-semibold-16 .color-1f1e1b .margin-0 .pt-20
  // (menu-contacts.page.html:15) — 16px Poppins-SemiBold, #1f1e1b.
  planTitle: { fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B' },
  // Angular: .body2-regular-14 .black-color .mt-4 (menu-contacts.page.html:16)
  // — 14px Poppins-Regular, #000, 4px above. RN had 13px/#4C4C4C/2px.
  planDuration: { fontSize: FontSize.font14, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.black, marginTop: 4 },
  // Angular: menu-contacts.page.html:673 — the EXPIRED heading is a
  // DIFFERENT class than the active state's: .heading4-medium-16
  // .color-1f1e1b (16px Poppins-MEDIUM, not SemiBold).
  planTitleExpired: { fontSize: FontSize.font16, fontFamily: Fonts.poppinsMedium, color: '#1F1E1B' },
  // Angular: menu-contacts.page.html:674 — .body3-regular-12 .black-color
  // .mt-4 (12px Poppins-Regular, #000) — NOT the active state's 14px.
  planDurationExpired: { fontSize: FontSize.font12, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.black, marginTop: 4 },

  crownBadge: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  expiredBody: { padding: 16, paddingTop: 16, gap: 12 },

  // Angular: .auto-renewal-block { border-top: 1px solid #f1f1f1 } — a
  // different, lighter grey than Colors.borderSubtle (#e6e6e6).
  renewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderTopWidth: 1, borderTopColor: '#f1f1f1',
  },
  renewTextCol: { flex: 1 },
  // Angular: .heading3-semibold-16 .color-1f1e1b .pt-8 (menu-contacts.page.html:506)
  // — 16px Poppins-SemiBold, not the 14px Poppins-Medium RN had.
  renewLabel: { fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B' },
  // Angular: .body3-regular-12 .color-545454 .mt-4 — 12px Poppins-Regular, 4px above.
  renewSub: { fontSize: FontSize.font12, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: '#545454', marginTop: 4 },

  // Angular: menu-contacts.page.html:515-524 — .auto-renewal-refund-box, a
  // bordered white box (1px #e5e5e5, radius 8), margin 16px sides/bottom,
  // 12px top (from the parent col's mt-12), padding 12px all round.
  refundNoteBox: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, backgroundColor: Colors.white,
    marginHorizontal: 16, marginTop: 12, marginBottom: 16, padding: 12,
  },
  // Angular: .body3-regular-12 .black-color — 12px Poppins-Regular, #000
  // (RN had #1F1E1B).
  refundNoteText: { fontSize: FontSize.font12, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.black, lineHeight: 18 },
  // Angular: .body1-medium-14 .color-29339B (menu-contacts.page.html:521) —
  // 14px Poppins-MEDIUM (not SemiBold), no underline in the source.
  refundLink: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.link },

  renewPlanBtn: { marginHorizontal: 16, marginBottom: 16 },

  // Angular: .subscription-expiring-time-membership-basic (scss:159) — the
  // template hardcodes the -basic variant regardless of packagetype, so this
  // strip is always #F7FAFF. Padding is pl-24/pr-12/pt-8/pb-8 — asymmetric,
  // not the flat 12 RN used — and there is NO top border: the separation is
  // purely the background-colour change from the gradient above.
  footerStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 24, paddingRight: 12, paddingVertical: 8,
    backgroundColor: '#F7FAFF',
  },
  // Angular: .body3-regular-12 .black-color — 12px Poppins-Regular, #000.
  expiryText: { flex: 1, fontSize: FontSize.font12, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.black },

  // Angular has THREE different section-heading styles, not one:
  //  - "Package Usage Details" — .font-14-semibold .clr0 .mt-40 → 14px/600/#000
  //  - "Payment status"        — .heading3-semibold-16 .clr0    → 16px/600/#000
  //  - "All Transactions"      — .heading3-semibold-16 .color-1f1e1b → 16px/600/#1f1e1b
  // All sit OUTSIDE their cards, so none carry the card's inner padding.
  sectionTitle: { fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B', marginTop: 32 },
  sectionTitleUsage: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsSemiBold, color: Colors.black, marginTop: 40 },
  sectionTitlePayment: { fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: Colors.black, marginTop: 32 },

  // Angular: .how-it-works-block (menu-contacts.page.html:601) — a bordered
  // box (1px #E3E3E5, radius 12, NO shadow), separate from the payment-status
  // card below it. mt-16 from the "Payment status" heading above.
  emiCard: {
    borderWidth: 1, borderColor: '#E3E3E5', borderRadius: 12,
    paddingVertical: 12, marginTop: 16,
  },
  emiStepper: { gap: 12, paddingHorizontal: 12, marginTop: 12 },
  emiStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Angular: .textcta-medium-12 .black-color (menu-contacts.page.html:610) —
  // 12px Poppins-Medium, #000 (RN had no fontFamily and grey textSecondary).
  emiKey: { flex: 1, fontSize: FontSize.font12, fontFamily: Fonts.poppinsMedium, color: Colors.black },
  // Angular: .body3-regular-12 .poppins-family .black-color
  // (menu-contacts.page.html:616) — poppins-family's Roboto-Regular override
  // (declared later than body3-regular-12 in global.scss) wins, so this
  // renders in Roboto-Regular, not Poppins-SemiBold/#1F1E1B.
  emiValue: { fontSize: FontSize.font12, fontFamily: Fonts.robotoRegular, color: Colors.black },

  // Angular: .payment-status-block-membership (menu-contacts.page.scss:179) —
  // radius 16 (vs 8 on the usage card and 10 on the hero: three different
  // radii on one page), shadow 0 3px 12px rgba(0,0,0,.08), padding-top 16
  // only. No background is declared there — it only looks white because the
  // page is — so it is set explicitly here or the shadow renders wrong.
  paymentCard: {
    backgroundColor: Colors.white, borderRadius: 16, paddingTop: 16, marginTop: 24,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  // Angular: menu-contacts.page.html:174 — the content row is inset 16px each
  // side and carries .bottom-border-e5e5e5, a divider with nothing beneath it
  // (every following row is *ngIf="false"). Reproduced because it is visible.
  paymentRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  paymentTextCol: { flex: 1 },
  // Angular: .body1-medium-14 .color-1e1e1e — 14px Poppins-Medium, #1e1e1e
  // (RN had SemiBold/#1F1E1B).
  paymentContent: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: '#1e1e1e' },
  // Angular: .body3-regular-12 .poppins-family .mt-6 — 12px, 6px above, and
  // NO color class, so it inherits black (RN had textSecondary grey). The
  // poppins-family class (declared later in global.scss than body3-regular-12)
  // wins the cascade, so this renders in Roboto-Regular, not Poppins-Regular.
  paymentContent2: { fontSize: FontSize.font12, fontFamily: Fonts.robotoRegular, color: Colors.black, marginTop: 6 },

  // Angular: .payment-revamp-intermediate-block (menu-contacts.page.scss:320)
  // — radius 8 (not 16), white, shadow -1px 3px 6px 1px rgba(64,67,67,.267)
  // (#40434343 is 8-digit hex: #404343 at 0x43 = 26.7% alpha). Padding is
  // 16px on three sides; the top falls to Ionic's default ion-col 5px.
  usageCard: {
    backgroundColor: Colors.white, borderRadius: 8,
    paddingTop: 5, paddingHorizontal: 16, paddingBottom: 16,
    // Angular: menu-contacts.page.html:62 — the card carries .mt-12, which
    // this was missing entirely (the heading's own mt-40 was the only gap).
    // ADJUSTABLE — raise for more space under "Package Usage Details".
    marginTop: 12,
    shadowColor: '#404343', shadowOffset: { width: -1, height: 3 },
    shadowOpacity: 0.267, shadowRadius: 6, elevation: 3,
  },

  // Angular: .bottom-border-e5e5e5 (menu-contacts.page.scss:132) — 1px #e5e5e5
  // under each row; the row's own 16px padding comes from the card, so the
  // divider spans the full inner width. Used for the expired-benefits row
  // (icon+text flex row) as well as the main usage-details row's OUTER
  // container (see usageRowOuter/usageRowInner below).
  usageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16,
  },
  usageRowDivided: { borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  // Angular: menu-contacts.page.html:547-569 — icon+title+balance already
  // fill all 12 grid columns, so subcontent wraps to its own full-width line
  // below (usageSub, rendered as usageRowOuter's second child) rather than
  // being indented inside the title column.
  usageRowOuter: { paddingVertical: 16 },
  usageRowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  usageTextCol: { flex: 1 },
  // Angular: the label's `semibold-14-font` class has NO definition outside
  // per-language scopes, so in English it contributes nothing and the text
  // renders as the inherited ion-label default — Poppins-Regular 400, not the
  // 14px medium the class name suggests. Matching what actually renders.
  // Also carries .mr-6 (menu-contacts.page.html:553) — 6px before the
  // attention icon.
  // FLAGGED — Angular's markup here is `semibold-14-font black-color mr-6`
  // (menu-contacts.page.html:73), but `.semibold-14-font` has NO English
  // declaration: global.scss defines it only inside one per-language block, so
  // on English it contributes neither size nor family and the label falls back
  // to body's inherited Poppins-Regular. The family below matches that real
  // fallback; the size has no reliable source (the class name implies --font14,
  // the rendered fallback is the inherited size), so it is left as-is.
  usageTitle: { flex: 1, fontSize: FontSize.font16, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.black, marginRight: 6 },
  // Angular: .body3-regular-12 .black-color .line-height-16.
  usageSub: { fontSize: FontSize.font12, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: Colors.black, lineHeight: 16 },
  // Angular: .heading3-semibold-16 — 16px Poppins-SemiBold.
  usageBalance: { fontSize: FontSize.font16, fontFamily: Fonts.poppinsSemiBold, color: Colors.black },
  // Angular: .body1-medium-14 — the "/total" half is 14px Poppins-Medium.
  usageTotal: { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.black },
  // Angular: .color-ef4444 applies to BOTH spans when balance <= warningcnt.
  usageBalanceWarn: { color: '#ef4444' },
  infoBtn: { paddingLeft: 4 },

  // Angular: menu-contacts.page.html:91 — <ion-row class="mt-16 mb-8">.
  renewRowInCard: { marginTop: 16, marginBottom: 8 },

  // Angular: .standard-membership-payment-block (menu-contacts.page.scss:197)
  // — each transaction is its own 1px #e5e5e5 bordered card, radius 10,
  // padding 10px 16px, NO shadow, with a 12px gap between cards (mt-12).
  txnCard: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16,
    marginTop: 12,
  },
  txnRightCol: { alignItems: 'flex-end' },
  // Angular: .body1-medium-14 .black-color — 14px Poppins-Medium, #000.
  txnName:   { fontSize: FontSize.font14, fontFamily: Fonts.poppinsMedium, color: Colors.black },
  // Angular: .color-545454 .body3-regular-12 .mt-4 — 12px regular, #545454.
  txnSub:    { fontSize: FontSize.font12, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: '#545454', marginTop: 4 },
  // Angular: .body1-medium-14 .poppins-family .f-500 .black-color — but
  // .poppins-family maps to Roboto-Regular (--english-poppins, _variable.scss:24,
  // applied !important and declared later than the medium class), so the ₹
  // amount renders in a REGULAR face, not Poppins-Medium.
  txnAmount: { fontSize: FontSize.font14, fontFamily: Fonts.robotoRegular, color: Colors.black },
})
