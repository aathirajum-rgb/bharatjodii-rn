// Desktop/laptop layout for the membership-plans screen (Figma "Jodii
// Desktop - Registration", node 969:2785 — full-page 3-column layout: top
// nav, plan cards, order-summary sidebar). Purely presentational —
// RechargeScreen.tsx owns all data-loading/state/handler logic (same split
// MatchesDesktopLayout.tsx/ViewProfileDesktopLayout.tsx already use for
// their screens) and passes it down as props; this file only arranges that
// data into the new full-page layout instead of the old centered modal card.
// Reuses PlanCard straight from RechargeScreen.tsx — the plan-card content
// is identical on both, only the surrounding chrome (full page vs. modal,
// top nav vs. close button, added order-summary sidebar) differs.
//
// The "view other packages" sheet reuses the existing cross-platform
// BottomSheet component unchanged — Figma didn't show a distinct desktop
// treatment for it, and it already renders as a centered overlay.

import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import MatchesDesktopNav from '../../components/matches-header/MatchesDesktopNav'
import { PlanCard } from './RechargeScreen'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { FooterTab } from '../../components/app-footer/AppFooter'
import type { MembershipPlansData } from '../../service/paymentService'

const ICON_CALL = CDN_SVG + 'revamp/call-blue.svg'

export interface RechargeDesktopLayoutProps {
  data:            MembershipPlansData | null
  loading:         boolean
  selectedId:      string
  onSelect:        (id: string) => void
  onViewAllPlans:  () => void
  showAllPlans:    boolean
  onCloseAllPlans: () => void
  sheetSelectedId: string
  onSheetSelect:   (id: string) => void
  payLabel:        string
  onPay:           () => void
  sheetPayLabel:   string
  onSheetPay:      () => void

  langCode:         string
  onTabPress:       (tab: FooterTab) => void
  onLanguagePress?: (() => void) | undefined
}

export default function RechargeDesktopLayout({
  data, loading, selectedId, onSelect, onViewAllPlans,
  showAllPlans, onCloseAllPlans, sheetSelectedId, onSheetSelect,
  payLabel, onPay, sheetPayLabel, onSheetPay,
  langCode, onTabPress, onLanguagePress,
}: RechargeDesktopLayoutProps) {
  const selectedPlan = data?.plans.find(p => p.productid === selectedId)

  return (
    <View style={s.screen}>
      <MatchesDesktopNav
        activeTab={3 as FooterTab}
        langCode={langCode}
        onTabPress={onTabPress}
        onLanguagePress={onLanguagePress}
      />

      {loading ? (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
      ) : !data || data.plans.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>No plans available.</Text>
        </View>
      ) : (
        <View style={s.body}>
          <ScrollView style={s.main} contentContainerStyle={s.mainContent} showsVerticalScrollIndicator={false}>
            <Text style={s.pageTitle}>{data.title}</Text>

            {data.plans.map(plan => (
              <PlanCard
                key={plan.productid}
                plan={plan}
                selected={selectedId === plan.productid}
                onPress={() => onSelect(plan.productid)}
              />
            ))}

            {!!data.offerBannerText && (
              <View style={s.offerBanner}>
                <Text style={s.offerBannerText}>{data.offerBannerText}</Text>
              </View>
            )}

            {!!data.viewAllText && (
              <Pressable style={s.viewAllRow} onPress={onViewAllPlans}>
                <Text style={s.viewAllText}>{data.viewAllText}</Text>
              </Pressable>
            )}
          </ScrollView>

          <View style={s.sidebar}>
            <View style={s.summaryCard}>
              <View style={s.summaryTopRow}>
                <Text style={s.summaryPlanName} numberOfLines={1}>
                  {[selectedPlan?.value1[0], selectedPlan?.value1[1]].filter(Boolean).join(' ')}
                </Text>
                <Text style={s.summaryPlanPrice}>{selectedPlan?.price}</Text>
              </View>

              {!!selectedPlan?.discountamount && (
                <View style={s.discountRow}>
                  <Text style={s.discountLabel}>Special discount</Text>
                  <Text style={s.discountValue}>-{selectedPlan.discountamount}</Text>
                </View>
              )}

              <View style={s.summaryDivider} />

              <View style={s.totalRow}>
                <Text style={s.totalLabel}>To Pay</Text>
                <Text style={s.totalValue}>{selectedPlan?.paidamt}</Text>
              </View>
            </View>

            <ButtonRevamp
              label={payLabel}
              variant="primary"
              size="large"
              fullWidth
              icon="forward-icon-white"
              iconPosition="end"
              style={{ backgroundColor: Colors.primaryDark }}
              onPress={onPay}
            />

            {!!data.helpline && (
              <View style={s.needHelpRow}>
                <Text style={s.needHelpText}>Need help? </Text>
                <CdnSvg uri={ICON_CALL} width={16} height={16} />
                <Text style={s.needHelpNumber}>{data.helpline}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <BottomSheet visible={showAllPlans} onClose={onCloseAllPlans}>
        <View style={s.sheetInner}>
          <Text style={s.sheetTitle}>{data?.viewAllText ?? 'All packages'}</Text>
          <ScrollView style={s.sheetList} contentContainerStyle={s.sheetListContent}>
            {data?.allPlans.map(plan => (
              <PlanCard
                key={plan.productid}
                plan={plan}
                selected={sheetSelectedId === plan.productid}
                onPress={() => onSheetSelect(plan.productid)}
              />
            ))}
          </ScrollView>
          <ButtonRevamp
            label={sheetPayLabel}
            variant="primary"
            size="large"
            fullWidth
            icon="forward-icon-white"
            iconPosition="end"
            style={{ backgroundColor: Colors.primaryDark, marginTop: 16 }}
            onPress={onSheetPay}
          />
        </View>
      </BottomSheet>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDF8F8' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary },

  body: { flex: 1, flexDirection: 'row', paddingHorizontal: 124, paddingVertical: 32, gap: 32 },

  main:        { flex: 1 },
  mainContent: { gap: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 20, color: Colors.black, marginBottom: 4 },

  offerBanner: {
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: Colors.membershipCardBg, alignItems: 'center',
  },
  offerBannerText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#7A1739', textAlign: 'center', lineHeight: 16 },

  viewAllRow:  { alignItems: 'center', paddingVertical: 4 },
  viewAllText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },

  sidebar: { width: 352, gap: 16, alignSelf: 'flex-start' },

  summaryCard: {
    width: '100%', backgroundColor: Colors.white, borderRadius: 16, padding: 24,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryPlanName:  { flex: 1, fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black },
  summaryPlanPrice: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },

  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  discountLabel: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.black },
  discountValue: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.discountGreen },

  summaryDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 16 },

  totalRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.black },
  totalValue: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: Colors.black },

  needHelpRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  needHelpText:   { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.black },
  needHelpNumber: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link, marginLeft: 4 },

  sheetInner:       { maxHeight: '100%' },
  sheetTitle:       { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black, textAlign: 'center', marginBottom: 16 },
  sheetList:        { maxHeight: 480 },
  sheetListContent: { gap: 20, paddingBottom: 8 },
})
