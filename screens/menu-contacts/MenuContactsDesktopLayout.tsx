// Desktop/laptop layout for "My Membership" (Figma "Jodii Desktop -
// Registration", nodes 551:89 -> 555:8499 — 6 tier/status variants of one
// "Membership details" screen: Basic/Standard/Super x Active, plus a Basic
// "expiring soon" state and a Super "expired" state). Purely presentational —
// MenuContactsScreen.tsx owns all data-loading/state/handler logic and passes
// it down as props, same split as RechargeDesktopLayout/PaymentOptionsDesktopLayout.
//
// Measurements below are pulled directly from get_design_context on node
// 555:2997 (Standard/Active content frame) — a single continuous 720px-wide
// card: gradient hero top (rounded top only) -> white "Package usage
// details" section (no radius, no shadow of its own) -> gradient-tinted
// footer strip (rounded bottom only), ONE shared drop-shadow across all
// three, not three separate cards. "All Transactions" sits below as a plain
// heading + a connected bordered list (not its own shadowed card).
//
// The 4 confirm/success BottomSheet flows are reused unchanged — BottomSheet
// already renders as a centered dialog on desktop internally (see its own
// useIsDesktopWeb() branch), so no separate desktop sheet treatment is needed.
//
// Out of scope: the Figma "Super pack upgrade upsell" card (rocket icon, "pay
// extra ₹250", offer countdown) — no backend contract exists for it (dead/
// disabled code in the old Angular app too); see MenuContactsScreen.tsx's
// header comment. The "Payment status" card below IS real (PAYMENTDETAILS.
// content/content2, confirmed live), even though it wasn't present on the
// specific Active/no-upsell Figma node fetched for this layout.

import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import BottomSheet, { type BottomSheetData } from '../../components/bottom-sheet/BottomSheet'
import Popover from '../../components/popover/Popover'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import { Colors } from '../../constants/colors'
import { CDN, CDN_SVG } from '../../constants/cdn'
import { stripHtml, parseAmount, formatAmount } from '../../service/paymentService'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import type { MembershipTierTheme } from './membershipTierTheme'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const ICON_CROWN = CDN_SVG + 'revamp/crown-white.svg'
const ICON_ALERT = CDN + 'assets/images/svg/alert-circle.svg'
const ICON_INFO  = CDN + 'verified-info.svg'

type UsageRow = {
  icon?: string
  title?: string
  balance?: string | number
  value?: string | number
  total?: string | number
  subcontent?: string
  type?: string
}
type EmiStep = { icon?: string; key?: string; cta?: string; value?: string }
type TxnRow = { packname?: string; packduration?: string; amount?: string; paydate?: string }
type MissingBenefit = { icon?: string; value?: string }

export interface MenuContactsDesktopLayoutProps {
  loading:      boolean
  membership:   Record<string, any> | null
  paymentInfo:  Record<string, any> | null
  planTitle:    string
  planDuration: string
  isExpired:    boolean
  isExpiring:   boolean
  tierTheme:    MembershipTierTheme
  usageRows:      UsageRow[]
  missingBenefits: MissingBenefit[]
  emiSteps:       EmiStep[]
  txnRows:        TxnRow[]
  showRenewPlan:  boolean
  autoRenewOn:    boolean
  onToggleAutoRenew: (next: boolean) => void
  onRequestRefund:   () => void
  onGoToRecharge:    () => void
  onAttentionPress:  (row: UsageRow) => void
  rowIsWarning:      (row: UsageRow) => boolean

  langCode:         string
  onTabPress:       (tab: FooterTab) => void
  onLanguagePress?: (() => void) | undefined

  cancelSheet:        BottomSheetData
  cancelSuccessSheet: BottomSheetData
  refundConfirmSheet: BottomSheetData
  refundSuccessSheet: BottomSheetData
  refundDeclineSheet: BottomSheetData
  showCancelConfirm:  boolean
  showCancelSuccess:  boolean
  showRefundConfirm:  boolean
  refundResult:       'success' | 'decline' | null
  attentionInfo:      { title: string; content: string } | null
  onConfirmCancelAutoRenew: () => void
  onDeclineCancelAutoRenew: () => void
  onCloseCancelSuccess:     () => void
  onConfirmRefund:          () => void
  onCloseRefundConfirm:     () => void
  onCloseRefundResult:      () => void
  onCloseAttentionInfo:     () => void
}

// Figma: the contacts-left row renders "10/35" uniformly bold, but the
// horoscope/profile-highlighter rows render "82" bold + " days left" in a
// lighter regular weight — this splits a leading-number value into that
// two-tone shape when there's a trailing unit, and falls back to a single
// uniform style otherwise (e.g. "Unlimited").
function UsageValue({ row, warn }: { row: UsageRow; warn: boolean }) {
  if (row.total != null) {
    return (
      <Text style={[s.usageBalance, warn && s.usageBalanceWarn]}>
        {row.balance ?? row.value ?? 0}/{row.total}
      </Text>
    )
  }
  const str = String(row.balance ?? row.value ?? '')
  const match = str.match(/^(\d+)(\s+.*)$/)
  if (match) {
    return (
      <Text style={[s.usageBalance, warn && s.usageBalanceWarn]}>
        {match[1]}<Text style={s.usageBalanceUnit}>{match[2]}</Text>
      </Text>
    )
  }
  return <Text style={[s.usageBalance, warn && s.usageBalanceWarn]}>{str}</Text>
}

export default function MenuContactsDesktopLayout({
  loading, membership, paymentInfo, planTitle, planDuration, isExpired, isExpiring, tierTheme,
  usageRows, missingBenefits, emiSteps, txnRows, showRenewPlan, autoRenewOn,
  onToggleAutoRenew, onRequestRefund, onGoToRecharge, onAttentionPress, rowIsWarning,
  langCode, onTabPress, onLanguagePress,
  cancelSheet, cancelSuccessSheet, refundConfirmSheet, refundSuccessSheet, refundDeclineSheet,
  showCancelConfirm, showCancelSuccess, showRefundConfirm, refundResult, attentionInfo,
  onConfirmCancelAutoRenew, onDeclineCancelAutoRenew, onCloseCancelSuccess,
  onConfirmRefund, onCloseRefundConfirm, onCloseRefundResult, onCloseAttentionInfo,
}: MenuContactsDesktopLayoutProps) {
  return (
    <View style={s.screen}>
      <MatchesDesktopNav
        activeTab={3 as FooterTab}
        langCode={langCode}
        onTabPress={onTabPress}
        onLanguagePress={onLanguagePress}
      />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Membership details</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
        ) : !membership ? (
          <Text style={s.emptyText}>We couldn't load your membership details. Please check your connection and try again.</Text>
        ) : (
          <>
            {/* ── Hero card (gradient top + white usage/renewal body + gradient
                footer strip — ONE continuous card, single shared shadow) ── */}
            <View style={s.heroCard}>
              <LinearGradient
                colors={tierTheme.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={s.heroTop}
              >
                <View style={[s.statusBadge, isExpired || isExpiring ? s.statusBadgeWarn : s.statusBadgeActive]}>
                  <Text style={s.statusBadgeText} numberOfLines={1}>
                    {isExpired ? 'Membership Expired' : isExpiring ? 'Membership Expiring soon' : 'Active'}
                  </Text>
                </View>

                <View style={s.heroRow}>
                  <View style={s.heroTextCol}>
                    <Text style={s.planTitle} numberOfLines={2}>
                      {isExpired ? `Your ${planTitle || 'membership'} has expired!` : (planTitle || membership.packageName || '')}
                    </Text>
                    <Text style={s.planDuration}>{isExpired ? stripHtml(membership.packexpirytext) ?? '' : planDuration}</Text>
                  </View>
                  <View style={[s.crownBadge, { backgroundColor: isExpired ? Colors.primaryDark : tierTheme.crownBadgeBg }]}>
                    <CdnSvg uri={isExpired ? ICON_ALERT : ICON_CROWN} width={30} height={30} />
                  </View>
                </View>
              </LinearGradient>

              {isExpired ? (
                <View style={s.expiredBody}>
                  <Text style={s.expiredTitle}>You are missing the following membership benefits. Renew now!</Text>
                  {missingBenefits.map((b, idx) => (
                    <View key={idx} style={s.usageRow}>
                      {!!b.icon && <CdnSvg uri={b.icon} width={20} height={20} />}
                      <Text style={s.usageTitle}>{b.value}</Text>
                    </View>
                  ))}
                  <ButtonRevamp
                    label="Renew plan"
                    variant="primary" size="standard"
                    icon="forward-icon-white" iconPosition="end"
                    onPress={onGoToRecharge}
                    style={s.renewPlanBtn}
                  />
                </View>
              ) : (
                <>
                  {usageRows.length > 0 && (
                    <View style={s.usageBody}>
                      <Text style={s.sectionTitle}>{membership.content ?? 'Package usage details'}</Text>
                      <View style={s.usageList}>
                        {usageRows.map((row, idx) => {
                          const warning = rowIsWarning(row)
                          return (
                            <View key={idx}>
                              {idx > 0 && <View style={s.usageDivider} />}
                              <View style={s.usageRow}>
                                {!!row.icon && <CdnSvg uri={row.icon} width={24} height={24} />}
                                <View style={s.usageTextCol}>
                                  <Text style={s.usageTitle}>{row.title}</Text>
                                  {!!row.subcontent && <Text style={s.usageSub}>{row.subcontent}</Text>}
                                </View>
                                <UsageValue row={row} warn={warning} />
                                {warning && (
                                  <Pressable onPress={() => onAttentionPress(row)} hitSlop={8}>
                                    <CdnSvg uri={ICON_INFO} width={16} height={16} />
                                  </Pressable>
                                )}
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  )}

                  {String(membership.autorenewalsection) === '1' && (
                    <View style={s.renewRow}>
                      <View style={s.renewTextCol}>
                        <Text style={s.renewLabel}>Auto renewal</Text>
                        {!!membership.expiryTextVal && <Text style={s.renewSub}>{membership.expiryTextVal}</Text>}
                      </View>
                      <Switch
                        value={autoRenewOn}
                        onValueChange={onToggleAutoRenew}
                        trackColor={{ true: Colors.primaryDark, false: Colors.border }}
                      />
                    </View>
                  )}

                  {String(membership.payrefundsection) === '1' && (
                    <View style={s.refundNote}>
                      <Text style={s.refundNoteText}>
                        Get full refund even after renewal, if no paid benefits are used{'  '}
                        <Text style={s.refundLink} onPress={onRequestRefund}>Tap here</Text>
                      </Text>
                    </View>
                  )}

                  {showRenewPlan && (
                    <ButtonRevamp
                      label="Renew Plan" variant="primary" size="standard"
                      onPress={onGoToRecharge}
                      style={s.renewPlanBtn}
                    />
                  )}

                  {!!membership.packexpirytext && (
                    <View style={[s.footerStrip, { backgroundColor: tierTheme.footerBg }]}>
                      <Text style={s.expiryText}>{stripHtml(membership.packexpirytext)}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* ── Payment status (real PAYMENTDETAILS.content/content2 — not the
                out-of-scope upsell card, see header comment) ── */}
            {!isExpired && !!paymentInfo && (!!paymentInfo.content || emiSteps.length > 0) && (
              <View style={s.card}>
                {!!paymentInfo.title && <Text style={s.sectionTitle}>{paymentInfo.title}</Text>}
                {emiSteps.length > 0 && (
                  <View style={s.emiStepper}>
                    {emiSteps.map((step, idx) => (
                      <View key={idx} style={s.emiStep}>
                        {!!step.icon && <CdnSvg uri={step.icon} width={20} height={20} />}
                        <Text style={s.emiKey} numberOfLines={1}>{step.key}</Text>
                        {String(step.cta) === '1' ? (
                          <ButtonRevamp label={step.value ?? 'Pay'} variant="primary" size="small" onPress={onGoToRecharge} />
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

            {/* ── All Transactions (plain heading + a connected bordered list,
                not its own shadowed card — matches Figma) ── */}
            {txnRows.length > 0 && (
              <View style={s.txnSection}>
                <Text style={s.txnSectionTitle}>All Transactions</Text>
                <View style={s.txnList}>
                  {txnRows.map((txn, idx) => (
                    <View key={idx} style={[s.txnRow, idx < txnRows.length - 1 && s.txnRowDivider]}>
                      <View style={s.usageTextCol}>
                        <Text style={s.usageTitle}>{txn.packname}</Text>
                        {!!txn.packduration && <Text style={s.usageSub}>{txn.packduration}</Text>}
                      </View>
                      <View style={s.txnRightCol}>
                        <Text style={s.txnAmount}>{`-${formatAmount(parseAmount(txn.amount))}`}</Text>
                        {!!txn.paydate && <Text style={s.usageSub}>{txn.paydate}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={showCancelConfirm}
        data={cancelSheet}
        onClose={onDeclineCancelAutoRenew}
        onPrimaryPress={onConfirmCancelAutoRenew}
        onSecondaryPress={onDeclineCancelAutoRenew}
      />
      <BottomSheet
        visible={showCancelSuccess}
        data={cancelSuccessSheet}
        onClose={onCloseCancelSuccess}
        onPrimaryPress={onCloseCancelSuccess}
      />
      <BottomSheet
        visible={showRefundConfirm}
        data={refundConfirmSheet}
        onClose={onCloseRefundConfirm}
        onPrimaryPress={onConfirmRefund}
        onSecondaryPress={onCloseRefundConfirm}
      />
      <BottomSheet
        visible={refundResult === 'success'}
        data={refundSuccessSheet}
        onClose={onCloseRefundResult}
        onPrimaryPress={onCloseRefundResult}
      />
      <BottomSheet
        visible={refundResult === 'decline'}
        data={refundDeclineSheet}
        onClose={onCloseRefundResult}
        onPrimaryPress={onCloseRefundResult}
      />
      <Popover
        visible={!!attentionInfo}
        type="attentionPopup"
        title={attentionInfo?.title}
        content={attentionInfo?.content}
        gotItLabel="Got it"
        onClose={onCloseAttentionInfo}
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDF8F8' },

  body: { paddingVertical: 32, gap: 42, maxWidth: 720, alignSelf: 'center', width: '100%' },

  pageTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 24, color: '#1F1E1B', letterSpacing: -0.24 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 24 },

  // Generic card used by the standalone "Payment status" section.
  card: {
    backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },

  // The one continuous membership card (hero gradient + usage body + footer strip).
  heroCard: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },

  heroTop: { paddingHorizontal: 40, paddingTop: 40, paddingBottom: 24, position: 'relative' },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  heroTextCol: { flex: 1, gap: 4 },

  statusBadge: {
    position: 'absolute', top: 0, left: 0,
    paddingHorizontal: 24, paddingVertical: 12,
    borderTopLeftRadius: 11, borderBottomRightRadius: 12,
    borderWidth: 1, borderColor: Colors.white,
  },
  statusBadgeActive: { backgroundColor: '#10B981' },
  statusBadgeWarn: { backgroundColor: '#C70038' },
  statusBadgeText: { fontSize: 14, fontFamily: Fonts.poppinsMedium, color: Colors.white },

  planTitle: { fontSize: 20, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B' },
  planDuration: { fontSize: 16, fontFamily: Fonts.poppinsMedium, color: '#1F1E1B' },

  crownBadge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  expiredBody: { paddingHorizontal: 40, paddingVertical: 24, gap: 12 },
  expiredTitle: { fontSize: 16, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: '#1F1E1B', marginBottom: 4 },

  usageBody: { backgroundColor: Colors.white, paddingHorizontal: 40, paddingVertical: 24, gap: 24 },
  usageList: { gap: 12 },
  usageDivider: { height: 1, backgroundColor: '#E6E6E6', marginBottom: 12 },

  renewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 40, paddingVertical: 20, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: '#E6E6E6',
  },
  renewTextCol: { flex: 1 },
  renewLabel: { fontSize: 14, fontFamily: Fonts.poppinsMedium, color: '#1F1E1B' },
  renewSub: { fontSize: 12, color: '#545454', marginTop: 2 },

  refundNote: { paddingHorizontal: 40, paddingBottom: 16, backgroundColor: Colors.white },
  refundNoteText: { fontSize: 12, color: '#1F1E1B', lineHeight: 18 },
  refundLink: { color: Colors.link, fontFamily: Fonts.poppinsSemiBold, textDecorationLine: 'underline' },

  renewPlanBtn: { marginHorizontal: 40, marginBottom: 20, alignSelf: 'flex-start', minWidth: 200 },

  footerStrip: { paddingHorizontal: 40, paddingVertical: 16 },
  expiryText: { fontSize: 14, color: '#1F1E1B' },

  sectionTitle: { fontSize: 16, fontFamily: SemanticFontsEnglish.headingEnglishMedium, color: '#1F1E1B' },

  emiStepper: { gap: 12, paddingHorizontal: 40, paddingTop: 16 },
  emiStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emiKey: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  emiValue: { fontSize: 13, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B' },

  paymentContent: { fontSize: 14, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B', paddingHorizontal: 40, marginTop: 12 },
  paymentContent2: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, paddingHorizontal: 40, paddingBottom: 24 },

  usageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  usageTextCol: { flex: 1, gap: 4 },
  usageTitle: { flex: 1, fontSize: 14, fontFamily: Fonts.poppinsMedium, color: '#1F1E1B' },
  usageSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  usageBalance: { fontSize: 18, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B' },
  usageBalanceUnit: { fontSize: 14, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, color: '#1F1E1B' },
  usageBalanceWarn: { color: Colors.inputError },

  txnSection: { gap: 16 },
  txnSectionTitle: { fontSize: 16, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B' },
  txnList: { borderWidth: 1, borderColor: '#E6E6E6', borderRadius: 8, overflow: 'hidden' },
  txnRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white,
  },
  txnRowDivider: { borderBottomWidth: 1, borderBottomColor: '#E6E6E6' },
  txnRightCol: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 14, fontFamily: Fonts.poppinsSemiBold, color: '#1F1E1B' },
})
