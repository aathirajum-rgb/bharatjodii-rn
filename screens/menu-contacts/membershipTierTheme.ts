// Figma "Jodii Desktop - Registration" nodes 551:89 / 555:1768 / 555:4498 —
// the "My Membership" hero card's gradient/crown/footer colors vary by
// MEMBERSHIPDETAILS.packagetype ('BASIC' | 'STANDARD' | 'SUPER'), a field
// already flowing through CONTACT_DETAIL (service/communicationService.ts's
// fetchContactDetails()) but not previously read anywhere in this app.
//
// No tier-specific crown icons exist on the CDN today — rather than invent
// new asset URLs, every tier reuses the existing generic crown glyph
// (ButtonRevamp's 'crown-white' — CDN_SVG + 'revamp/crown-white.svg') on a
// tier-colored circular badge, matching the "colored badge + white glyph"
// pattern already used for status pills elsewhere in this screen.

export type MembershipTier = 'BASIC' | 'STANDARD' | 'SUPER'

export interface MembershipTierTheme {
  gradientColors: [string, string]
  crownBadgeBg:   string
  footerBg:       string
}

// Gradients are taken verbatim from Angular's .basic- / .standard- /
// .super-membership-package-block (menu-contacts.page.scss:116-130). The
// previous values were approximations — BASIC and STANDARD ended a shade too
// light, and SUPER was an invented purple (its own comment admitted borrowing
// the "Most Sold" ribbon's midpoint) where Angular is actually PINK.
//
// footerBg is retained per tier for the desktop layout, but note the mobile
// template hardcodes the -basic strip colour (#F7FAFF) for every tier — see
// MenuContactsScreen.tsx's footerStrip.
const TIER_THEME: Record<MembershipTier, MembershipTierTheme> = {
  // Angular: linear-gradient(#DCEBFE, #F1F7FF 100%)
  BASIC: {
    gradientColors: ['#DCEBFE', '#F1F7FF'],
    crownBadgeBg:   '#4797D9',
    footerBg:       '#F7FAFF',
  },
  // Angular: linear-gradient(#FFFAEB, #FFFAE8 100%)
  STANDARD: {
    gradientColors: ['#FFFAEB', '#FFFAE8'],
    crownBadgeBg:   '#D4A017',
    footerBg:       '#FFFCF1',
  },
  // Angular: linear-gradient(#FFA9C6, #FFE8F0 100%)
  SUPER: {
    gradientColors: ['#FFA9C6', '#FFE8F0'],
    crownBadgeBg:   '#D9478F',
    footerBg:       '#FFF8FA',
  },
}

export function getMembershipTierTheme(packagetype?: string): MembershipTierTheme {
  const key = String(packagetype ?? '').toUpperCase()
  return TIER_THEME[key as MembershipTier] ?? TIER_THEME.BASIC
}
