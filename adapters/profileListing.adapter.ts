// Shared low-level field primitives for the profile-listing family of mappers —
// service/homeService.ts's toProfile()/fetchSuccessStories(), service/viewProfileService.ts's
// toSimilarCard(), adapters/matches.adapter.ts, and adapters/viewProfile.adapter.ts each
// independently re-derived the same "strip yrs/years off AGE" and "PHOTO[0].IMAGE
// falls back to THUMBIMG" rules. Centralized here so a future API field-name
// change (a recurring issue in this codebase — see the fallback-chain comments
// throughout homeService.ts) is a one-file fix instead of five.
//
// Deliberately narrow in scope — NOT a full raw-item -> UI-model Adapter<T>,
// just the two byte-identical primitives every listing mapper needs. Each
// mapper's id-fallback order (MATRIID-first for the matches API vs MATRID-first
// for viewprofile's own raw shape) and IgnoredProfile's reversed THUMBIMG-first
// photo priority stay local to their own mappers — those really do differ
// per-endpoint/per-screen (documented in ignoredProfilesService.ts's own
// comment), unlike age-stripping and the base photo fallback, which don't.

// Global flag (matches adapters/viewProfile.adapter.ts's pre-existing
// implementation) — a non-global replace leaves a second "yrs"/"years"
// occurrence uncaught on sources that double up the unit (see
// adapters/matches.adapter.ts's own prior comment on this exact bug).
export function stripAgeUnit(raw: unknown): string {
  return raw ? String(raw).replace(/\s*(yrs|years)/gi, '').trim() : ''
}

// Angular: FUNC.getPartnerImg() — prefers the full-size PHOTO[0].IMAGE over the
// low-res THUMBIMG. Callers needing further fallbacks (e.g. viewProfileService's
// PROFILEIMG) OR the opposite priority (ignoredProfilesService's THUMBIMG-first,
// kept local — see file header there) build on or bypass this, not extend it.
export function pickListingPhoto(p: Record<string, any>): string | undefined {
  return p['PHOTO']?.[0]?.['IMAGE'] || p['THUMBIMG']
}
