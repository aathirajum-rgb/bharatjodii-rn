// Marketing/web-site URLs — single source of truth, mirrors constants/cdn.ts's
// role for the image CDN. Derived from EnvConfig.web so a domain rename (like
// Jodii -> BharatJodii) only needs to change the 5 env files, not every screen
// that happens to link to the marketing site.
import { EnvConfig } from './env'

const WEB_BASE = EnvConfig.web  // e.g. 'https://www.bharatjodii.com/'

export const PRIVACY_POLICY_URL   = `${WEB_BASE}privacy-policy.html`
export const TERMS_CONDITIONS_URL = `${WEB_BASE}terms.html`
// Angular: matches.page.ts loadGambanner() + core/config/matches.config.ts
// gamBannerUrl (JODII-371 renamed this to bharatjodii.com too, confirmed via
// git history — not just the general domain-config swap).
export const GAM_BANNER_BASE_URL  = `${WEB_BASE}ad.html?DivID=60912`
