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
  motherTongue?:   string
  physicalStatus?: string
  profileFor?:     string

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
  horoCompatibility?:  string   // e.g. "85%" — only meaningful for paid users with raasi+star both set

  // Star-match teaser (paid = real values from horoCompatibility above; free = static teaser)
  hasStarMatchInputs: boolean   // both own + opposite RAASI & STAR present

  likedMsg?: string   // COMMINFO.LIKEDMSG — "Liked by you on ..." row text, when present
}
