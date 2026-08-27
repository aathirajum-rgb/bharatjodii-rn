// UI model for the ViewProfile screen — produced by ViewProfileAdapter.
// Superset of MatchProfile (same core fields, same field semantics) so the
// existing Matches CTA plumbing (AfterLikeCtx, WhatsAppPaywallModal, showLikeCTA/
// showAfterLikeCTA, disableDontShow/disableViewLater) can be reused verbatim —
// a ViewProfileModel satisfies MatchProfile structurally.
import type { MatchProfile } from './matches.interface'

export interface PropertyItem {
  label: string
}

export interface ViewProfileModel extends MatchProfile {
  gender:          'M' | 'F'
  maritalStatus?:  string
  noOfChildren?:   string
  motherTongue?:     string
  motherTongueCode?: string   // raw PERSONALINFO.MOTHERTONGUES numeric code — Hometown row visibility depends on this, not the display text
  physicalStatus?:   string
  profileFor?:       string

  // Location — Angular renders these as up to three independent rows (NRI /
  // city-state / Hindi-etc-only Hometown), not one collapsed string. `location`
  // (from MatchProfile) stays as the single-string fallback other shared
  // components (buildBasicView, etc.) already expect.
  nriLocation?:      string
  cityStateLocation?: string
  homeLocation?:      string

  // Religious
  religion?:  string
  subCaste?:  string
  raasi?:     string
  star?:      string
  dosham?:    string[]

  // Life style
  drinking?:     string
  smoking?:      string
  eatingHabits?: string

  // Family
  brothers?: string
  sisters?:  string
  property:  PropertyItem[]
  vehicle:   PropertyItem[]

  // Horoscope (display-only in this phase — no request/upload actions)
  showHoroSection:     boolean
  horoscopeAvailable:  boolean

  // Star-match teaser — real ratio comes from a separate proactive API call
  // (ViewProfileScreen.tsx's starMatch state), not from this model.
  hasStarMatchInputs: boolean   // both own + opposite RAASI & STAR present

  likedMsg?: string   // COMMINFO.LIKEDMSG — "Liked by you on ..." row text, when present

  // Angular: viewprofile.page.ts's presentPopover() — the Verified badge's info-tap
  // popover shows PERSONALINFO.IDDET.BODY, API-supplied text (e.g. "Verified via
  // Call"), not a translation key. Only ever shown to a female viewer on a
  // verified profile (see ViewProfileScreen.tsx's isIdVerified && loginGender==='F' gate).
  verifiedInfoText?: string
}
