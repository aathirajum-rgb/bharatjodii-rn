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
// Deliberately out of scope (documented rather than silently dropped):
//   - The separate "expired membership" grid layout — this port adapts the
//     same layout via badge color/copy instead of a second template.
//   - RENEWALENABLEKEY localStorage gate on Renew Plan — not tracked
//     client-side anywhere in this port; gating on emicomplete alone stands in.
//   - reDirectRecharePage()'s real target (an untraced "Super pack
//     intermediate page") — routes to the already-built 'recharge' screen.
//   - The auto-triggered first-visit attention popover (1.9s timer) — the
//     popover still works on tap, just without the automatic trigger.
//   - Refund-decline's used-contacts count via a separate activity API call —
//     uses CONTACT_DETAIL.phoneNumbersUsed directly if present.
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import BottomSheet, { type BottomSheetData } from '../../components/bottom-sheet/BottomSheet'
import Popover from '../../components/popover/Popover'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import { fetchContactDetails } from '../../service/communicationService'
import { getJson } from '../../service/storageService'
import { updateAutoRenewal, requestAutopayRefund } from '../../service/paymentService'

const ICONS = {
  back: CDN_REACT + '/menu_back_arrow.svg',
  info: CDN + 'verified-info.svg',
  lostBenefit: CDN + 'revamp/close-icon.svg',
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

export default function MenuContactsScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [contactDetail, setContactDetail] = useState<Record<string, any> | null>(null)
  const [autoRenewOn, setAutoRenewOn] = useState(false)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showCancelSuccess, setShowCancelSuccess] = useState(false)
  const [showRefundConfirm, setShowRefundConfirm] = useState(false)
  const [refundResult, setRefundResult] = useState<'success' | 'decline' | null>(null)
  const [refundUsedContacts, setRefundUsedContacts] = useState<string | undefined>(undefined)

  const [attentionInfo, setAttentionInfo] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await fetchContactDetails()
      if (cancelled) return
      const detail = await getJson<Record<string, any>>('CONTACT_DETAIL')
      if (cancelled) return
      setContactDetail(detail)
      setAutoRenewOn(String(detail?.MEMBERSHIPDETAILS?.autorenewalstatus) === '1')
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
  const isExpiring = expiryDays <= 5

  const usageRows: UsageRow[] = Array.isArray(membership?.CONACTDETAILS)
    ? membership.CONACTDETAILS.filter((row: UsageRow) => row.type !== 'chat')
    : []

  const emiSteps: EmiStep[] = Array.isArray(paymentInfo?.emidetails) ? paymentInfo.emidetails : []
  const txnRows: TxnRow[] = Array.isArray(transactions?.DATA) ? transactions.DATA : []

  const showRenewPlan = String(paymentInfo?.emicomplete ?? '1') === '0'

  function rowIsWarning(row: UsageRow): boolean {
    const balance = Number(row.balance ?? row.value ?? 0)
    const warn = Number(row.warningcnt ?? NaN)
    return Number.isFinite(warn) && balance <= warn
  }

  function handleAttentionPress(index: number) {
    setAttentionInfo({
      title: t('GENERAL.ATTENTION', 'Attention!'),
      content: index === 1
        ? t('GENERAL.MEMBERSHIP_CHAT', 'Jodii chat messages sent to members who have deleted their profiles afterwards are also included in this count')
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
    title: cancelData?.TITLE ?? "Are you sure you want to cancel auto-renewal?",
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
    title: cancelData?.SUCCESS?.TITLE ?? 'Auto-renewal cancelled successfully!',
    content: cancelData?.SUCCESS?.CONTENT
      ?? `You can use your membership benefits till ${membership?.expiryTextVal ?? ''} and after that you won't be charged any more`,
    ctaLabel: cancelData?.SUCCESS?.CTA ?? 'Got it',
  }

  const refundData = contactDetail?.REFUNDDET
  const refundConfirmSheet: BottomSheetData = {
    title: refundData?.TITLE ?? 'Request a Refund?',
    content: refundData?.CONTENT ?? 'This will cancel your current plan and you will lose access to all premium features immediately.',
    ctaLabel: refundData?.CTA ?? 'Request refund',
    secondaryCtaLabel: refundData?.CTA1 ?? 'Go back',
    showSecondaryCta: true,
  }
  const refundSuccessSheet: BottomSheetData = {
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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICONS.back} width={24} height={24} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{t('GENERAL.MEMBERSHIP_HEADER', 'My Membership')}</Text>
      </View>

      {loading ? (
        <View style={s.loaderContainer}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : !membership ? (
        <View style={s.loaderContainer}>
          <Text style={s.emptyText}>
            {t('GENERAL.NOINTERNET', "We couldn't load your membership details. Please check your connection and try again.")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>

          {/* ── Membership status card ── */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              {!!membership.headericon && (
                <CdnSvg uri={membership.headericon} width={36} height={36} />
              )}
              <View style={s.cardHeaderText}>
                <Text style={s.planTitle}>{planTitle || membership.packageName || ''}</Text>
                {!!planDuration && <Text style={s.planDuration}>{planDuration}</Text>}
              </View>
              <View style={[s.statusBadge, isExpiring ? s.statusBadgeWarn : s.statusBadgeActive]}>
                <Text style={[s.statusBadgeText, isExpiring ? s.statusBadgeTextWarn : s.statusBadgeTextActive]} numberOfLines={1}>
                  {membership.membershipStatus ?? (isExpiring ? 'Expiring soon' : 'Active')}
                </Text>
              </View>
            </View>

            {!!membership.packexpirytext && (
              <Text style={s.expiryText}>{membership.packexpirytext}</Text>
            )}

            {/* Auto-renewal toggle */}
            {String(membership.autorenewalsection) === '1' && (
              <View style={s.renewRow}>
                <View style={s.renewTextCol}>
                  <Text style={s.renewLabel}>{t('RECHARGE.AUTORENEWAL', 'Auto renewal')}</Text>
                  {!!membership.expiryTextVal && <Text style={s.renewSub}>{membership.expiryTextVal}</Text>}
                </View>
                <Switch
                  value={autoRenewOn}
                  onValueChange={handleToggleAutoRenew}
                  trackColor={{ true: Colors.primaryDark, false: Colors.border }}
                />
              </View>
            )}

            {/* Refund note */}
            {String(membership.payrefundsection) === '1' && (
              <View style={s.refundNote}>
                <Text style={s.refundNoteText}>
                  {t('RECHARGE.AUTORENEWAL_NOTE', 'Get full refund even after renewal, if no paid benefits are used')}{'  '}
                  <Text style={s.refundLink} onPress={() => setShowRefundConfirm(true)}>
                    {t('RECHARGE.TAP_HERE', 'Tap here')}
                  </Text>
                </Text>
              </View>
            )}

            {showRenewPlan && (
              <ButtonRevamp
                label={t('MENU.RENEW_PLAN', 'Renew Plan')}
                variant="primary" size="standard" fullWidth
                onPress={goToRecharge}
                style={s.renewPlanBtn}
              />
            )}
          </View>

          {/* ── Payment / EMI status ── */}
          {!!paymentInfo && (!!paymentInfo.content || emiSteps.length > 0) && (
            <View style={s.card}>
              {!!paymentInfo.title && <Text style={s.sectionTitle}>{paymentInfo.title}</Text>}

              {emiSteps.length > 0 && (
                <View style={s.emiStepper}>
                  {emiSteps.map((step, idx) => (
                    <View key={idx} style={s.emiStep}>
                      {!!step.icon && <CdnSvg uri={step.icon} width={20} height={20} />}
                      <Text style={s.emiKey} numberOfLines={1}>{step.key}</Text>
                      {String(step.cta) === '1' ? (
                        <ButtonRevamp label={step.value ?? 'Pay'} variant="primary" size="small" onPress={goToRecharge} />
                      ) : (
                        <Text style={s.emiValue}>{step.value}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {!!paymentInfo.content && <Text style={s.paymentContent}>{paymentInfo.content}</Text>}
              {!!paymentInfo.content2 && <Text style={s.paymentContent2}>{paymentInfo.content2}</Text>}
            </View>
          )}

          {/* ── Package usage details ── */}
          {usageRows.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>{membership.content ?? 'Package Usage Details'}</Text>
              {usageRows.map((row, idx) => {
                const warning = rowIsWarning(row)
                return (
                  <View key={idx} style={s.usageRow}>
                    {!!row.icon && <CdnSvg uri={row.icon} width={24} height={24} />}
                    <View style={s.usageTextCol}>
                      <Text style={s.usageTitle}>{row.title}</Text>
                      {!!row.subcontent && <Text style={s.usageSub}>{row.subcontent}</Text>}
                    </View>
                    <Text style={[s.usageBalance, warning && s.usageBalanceWarn]}>
                      {row.balance ?? row.value ?? 0}{row.total != null ? `/${row.total}` : ''}
                    </Text>
                    {warning && (
                      <Pressable onPress={() => handleAttentionPress(idx)} hitSlop={8} style={s.infoBtn}>
                        <CdnSvg uri={ICONS.info} width={16} height={16} />
                      </Pressable>
                    )}
                  </View>
                )
              })}
            </View>
          )}

          {/* ── Payment transaction history ── */}
          {txnRows.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>{transactions?.title ?? 'All Transactions'}</Text>
              {txnRows.map((txn, idx) => (
                <View key={idx} style={s.txnRow}>
                  <View style={s.usageTextCol}>
                    <Text style={s.usageTitle}>{txn.packname}</Text>
                    {!!txn.packduration && <Text style={s.usageSub}>{txn.packduration}</Text>}
                  </View>
                  <View style={s.txnRightCol}>
                    <Text style={s.txnAmount}>{`-₹${txn.amount ?? ''}`}</Text>
                    {!!txn.paydate && <Text style={s.usageSub}>{txn.paydate}</Text>}
                  </View>
                </View>
              ))}
            </View>
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
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Poppins-Medium', color: '#333333', marginLeft: 6, marginRight: 16 },

  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  content: { padding: 16, gap: 16 },

  card: {
    backgroundColor: Colors.membershipCardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderText: { flex: 1 },
  planTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  planDuration: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeActive: { backgroundColor: Colors.badgePaidBg },
  statusBadgeWarn: { backgroundColor: Colors.primarySurface },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadgeTextActive: { color: Colors.badgePaidText },
  statusBadgeTextWarn: { color: Colors.inputError },

  expiryText: { fontSize: 12, color: Colors.textSecondary, marginTop: 10 },

  renewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  renewTextCol: { flex: 1 },
  renewLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  renewSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  refundNote: { marginTop: 12 },
  refundNoteText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  refundLink: { color: Colors.link, fontWeight: '600', textDecorationLine: 'underline' },

  renewPlanBtn: { marginTop: 16 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },

  emiStepper: { gap: 12, marginBottom: 12 },
  emiStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emiKey: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  emiValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

  paymentContent: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  paymentContent2: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

  usageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  usageTextCol: { flex: 1 },
  usageTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  usageSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  usageBalance: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  usageBalanceWarn: { color: Colors.inputError },
  infoBtn: { paddingLeft: 4 },

  txnRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  txnRightCol: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
})
