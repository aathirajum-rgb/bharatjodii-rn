// Pure API -> UI transforms extracted from service/paymentService.ts (1490+
// lines, mostly network calls and native Razorpay/PayU bridge orchestration).
// Only moved what's genuinely duplicated or a clean, self-contained mapping —
// left everything else (currency helpers, native-failure normalization, the
// PAYMENTMETHODS string-coercion block, HTML-stripping) in paymentService.ts
// since none of those are duplicated and several sit right next to
// payment-critical native-bridge code where minimizing touched surface area
// matters more than tidiness. See PROJECT report for the full breakdown of
// what was and wasn't moved, and why.

export interface RenewalBenefit {
  icon:  string
  value: string
  info?: boolean
}

// getAutoRenewalBenefits() and getRenewalBanner() in paymentService.ts each
// independently built this exact {icon, value} shape from a raw BENEFITS
// array — a literal duplicate, not just similar-looking code.
export function mapRenewalBenefits(raw: unknown, renewalTickIcon: string): RenewalBenefit[] {
  return Array.isArray(raw)
    ? raw.map((b: any) => ({ icon: renewalTickIcon, value: String(b?.value ?? b) }))
    : []
}

// Angular: recharge.page.ts / benefits-card.component.html read
// package.value1[0]/[1] directly — Angular must compute this split somewhere
// before the template renders it, since the raw API response only has a
// single combined `value` string ("Basic - 1 Month").
export function mapMembershipPlan(raw: any): any {
  const parts = String(raw?.value ?? '').split('-').map((s: string) => s.trim())
  const value1: [string, string] = [parts[0] ?? '', parts[1] ?? '']

  return {
    ...raw,
    value1,
    // Angular: benefits-card.component.html reads package.benefits (lowercase
    // — unlike every other BENEFITS payload elsewhere in paymentService.ts,
    // this one is NOT uppercase on the raw CONTENT item), so it already
    // matches the MembershipPlan.benefits field 1:1. Still passed through a
    // mapper (not left to the `...raw` spread above) so each entry's shape is
    // normalized the same way as every other benefits list in this adapter.
    benefits: Array.isArray(raw?.benefits)
      ? raw.benefits.map((b: Record<string, any>) => ({ icon: String(b?.icon ?? ''), value: String(b?.value ?? '') }))
      : [],
    discounttitle: typeof raw?.discounttitle === 'string' ? raw.discounttitle.trim() : raw?.discounttitle,
  }
}
