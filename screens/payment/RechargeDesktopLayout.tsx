// Desktop/laptop layout for the membership-plans screen (Figma "Jodii
// Desktop - Registration", node 1047-10280 — "Membership plans" modal with
// an X close button, not a back arrow). Purely presentational —
// RechargeScreen.tsx owns all data-loading/state/handler logic (same split
// MatchesDesktopLayout.tsx/ViewProfileDesktopLayout.tsx already use for
// their screens) and passes it down as props; this file only arranges that
// data into a centered modal-style card instead of RechargeScreen's mobile
// full-screen layout. Reuses PlanCard/renderBenefitText straight from
// RechargeScreen.tsx — the plan-card content is identical on both, only the
// surrounding chrome (full screen vs. centered card, back-arrow-less close
// button) differs.
//
// The "view other packages" sheet reuses the existing cross-platform
// BottomSheet component unchanged — Figma didn't show a distinct desktop
// treatment for it, and it already renders as a centered overlay.

import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import { PlanCard } from './RechargeScreen'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import type { MembershipPlansData } from '../../service/paymentService'

const ICON_CLOSE = CDN_SVG + 'close-light-black.svg'
const ICON_CALL  = CDN_SVG + 'revamp/call-blue.svg'

export interface RechargeDesktopLayoutProps {
  data:            MembershipPlansData | null
  loading:         boolean
  selectedId:      string
  onSelect:        (id: string) => void
  onClose:         () => void
  onViewAllPlans:  () => void
  showAllPlans:    boolean
  onCloseAllPlans: () => void
  sheetSelectedId: string
  onSheetSelect:   (id: string) => void
  payLabel:        string
  onPay:           () => void
  sheetPayLabel:   string
  onSheetPay:      () => void
}

export default function RechargeDesktopLayout({
  data, loading, selectedId, onSelect, onClose, onViewAllPlans,
  showAllPlans, onCloseAllPlans, sheetSelectedId, onSheetSelect,
  payLabel, onPay, sheetPayLabel, onSheetPay,
}: RechargeDesktopLayoutProps) {
  return (
    <View style={s.screen}>
      <View style={s.card}>
        <View style={s.header}>
          <Text style={s.headerTitle} numberOfLines={1}>{data?.title ?? 'Membership plans'}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <CdnSvg uri={ICON_CLOSE} width={20} height={20} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 40 }} />
        ) : !data || data.plans.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No plans available.</Text>
          </View>
        ) : (
          <>
            <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
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
            </ScrollView>

            <View style={s.footer}>
              {!!data.viewAllText && (
                <Pressable style={s.viewAllRow} onPress={onViewAllPlans}>
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
          </>
        )}
      </View>

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
  screen: { flex: 1, backgroundColor: '#FDF8F8', alignItems: 'center', justifyContent: 'center', padding: 24 },

  card: {
    width: 480, maxWidth: '100%', maxHeight: 760,
    backgroundColor: Colors.white, borderRadius: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16,
    elevation: 4, overflow: 'hidden',
  },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black, flex: 1 },

  scroll: { flexGrow: 0 },
  content: { padding: 24, paddingTop: 20, gap: 20 },

  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText:  { fontSize: 14, color: Colors.textSecondary },

  viewAllRow:  { alignItems: 'center', paddingVertical: 4 },
  viewAllText: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },

  offerBanner: {
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: Colors.membershipCardBg, alignItems: 'center',
  },
  offerBannerText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#7A1739', textAlign: 'center', lineHeight: 16 },

  footer: { paddingHorizontal: 24, paddingVertical: 16, gap: 8, borderTopWidth: 1, borderTopColor: Colors.divider },

  needHelpRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  needHelpText:   { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.black },
  needHelpNumber: { fontFamily: 'Poppins-Medium', fontSize: 14, color: Colors.link, marginLeft: 4 },

  sheetInner:       { maxHeight: '100%' },
  sheetTitle:       { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: Colors.black, textAlign: 'center', marginBottom: 16 },
  sheetList:        { maxHeight: 480 },
  sheetListContent: { gap: 20, paddingBottom: 8 },
})
