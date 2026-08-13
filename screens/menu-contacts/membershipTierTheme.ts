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

const TIER_THEME: Record<MembershipTier, MembershipTierTheme> = {
  BASIC: {
    gradientColors: ['#DCEBFE', '#F8FBFF'],
    crownBadgeBg:   '#4797D9',
    footerBg:       '#F7FAFF',
  },
  STANDARD: {
    gradientColors: ['#FFF9E3', '#FFFCF3'],
    crownBadgeBg:   '#D4A017',
    footerBg:       '#FFFCF1',
  },
  // Purple accent matches the "Most Sold" ribbon gradient's midpoint already
  // used on RechargeScreen.tsx's plan cards — the closest existing purple in
  // the app's palette, reused rather than inventing an unrelated new one.
  SUPER: {
    gradientColors: ['#DFD9FF', '#FFFFFF'],
    crownBadgeBg:   '#7347CB',
    footerBg:       '#F7F5FF',
  },
}

export function getMembershipTierTheme(packagetype?: string): MembershipTierTheme {
  const key = String(packagetype ?? '').toUpperCase()
  return TIER_THEME[key as MembershipTier] ?? TIER_THEME.BASIC
}
