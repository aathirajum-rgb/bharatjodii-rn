// Shared between GamBanner.tsx (native) and GamBanner.web.tsx (web) — the one
// piece of logic both platform files need: building the ad-embed URL.
//
// Angular: matches.page.ts loadGambanner() + core/config/matches.config.ts
// gamBannerUrl = 'https://www.jodii.com/ad.html?DivID=60912'. Only gender/
// caste/domain are appended to the URL — photo/horo/user build a separate
// "gamUserDetail" string Angular never actually sends anywhere, so it's not
// replicated here.
const GAM_BANNER_BASE_URL = 'https://www.jodii.com/ad.html?DivID=60912'

export interface GamBannerParams {
  gender?: string
  caste?:  string
  domain?: string
}

export function buildGamBannerUrl({ gender = '', caste = '', domain = '' }: GamBannerParams): string {
  // Angular (matches.page.ts/viewprofile.page.ts) interpolates these raw too
  // — GENDER/CASTE/DOMAINID are short backend codes, never free text, so this
  // has never broken in practice. encodeURIComponent is a no-op for any value
  // seen today; only guards against one ever containing a URL-special
  // character (&, =, #, ...) that would otherwise inject/break query params.
  return `${GAM_BANNER_BASE_URL}&gender=${encodeURIComponent(gender)}&caste=${encodeURIComponent(caste)}&domain=${encodeURIComponent(domain)}`
}
