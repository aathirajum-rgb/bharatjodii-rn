// Transforms the raw viewprofile API response (RESPONSE.REPONSE — that inner key's
// spelling is a real quirk of the actual API, confirmed against Angular's
// viewprofile.page.ts:719: `this.vpdata = data.vpdata.REPONSE`) into the
// ViewProfileModel UI model consumed by ViewProfileScreen.
// Pattern mirrors adapters/matches.adapter.ts.

import type { Adapter } from '../core/base/base.adapter'
import type { ViewProfileModel, PropertyItem } from '../types/interfaces/viewProfile.interface'

function stripAgeUnit(raw: unknown): string {
  return raw ? String(raw).replace(/\s*(yrs|years)/gi, '').trim() : ''
}

function toLikedStatus(raw: unknown): '0' | '1' | '2' | '3' {
  const s = String(raw ?? '0')
  return (['0', '1', '2', '3'] as const).includes(s as any) ? (s as '0' | '1' | '2' | '3') : '0'
}

function toPropertyList(raw: unknown): PropertyItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(item => (typeof item === 'string' ? item : item?.NAME ?? item?.PROPERTYNAME ?? ''))
    .filter(Boolean)
    .map(label => ({ label: String(label) }))
}

export class ViewProfileAdapter implements Adapter<ViewProfileModel> {

  adapt = (raw: Record<string, any>): ViewProfileModel => {
    const personal      = raw?.PERSONALINFO ?? {}
    const photo         = raw?.PHOTOINFO ?? {}
    const comm          = raw?.COMMINFO ?? {}
    const location      = raw?.LOCATIONINFO ?? {}
    const professional  = raw?.PROFESSIONALINFO ?? {}
    const religious     = raw?.RELIGIOUSINFO ?? {}
    const habits        = raw?.HABITSINFO ?? {}
    const family        = raw?.FAMILYINFO ?? {}
    const horo          = raw?.HOROINFO ?? {}
    const payment       = raw?.PAYMENTINFO ?? {}

    const gender: 'M' | 'F' = personal['GENDER'] === 'F' ? 'F' : 'M'

    const nriLocation = location['NRISTATE'] && location['NRICOUNTRY']
      ? `${location['NRISTATE']}, ${location['NRICOUNTRY']}`
      : ''
    const cityState = [location['CITY'], location['STATE']].filter(Boolean).join(', ')

    const photos: string[] = Array.isArray(photo['PHOTO'])
      ? photo['PHOTO'].map((p: any) => p?.IMAGE).filter(Boolean)
      : []

    // Angular: viewprofile.page.ts:770-781 — each RELIGIOUSINFO.DOSHAM array item
    // is an object carrying its own display text under a `DOSHAM` sub-key (e.g.
    // `{DOSHAM: "Rahu"}`), not a plain string. `.map(String)` on the raw objects
    // was stringifying the whole object instead of reading that field, which is
    // why this rendered as the literal text "[object Object]" on screen.
    const dosham: string[] = Array.isArray(religious['DOSHAM'])
      ? religious['DOSHAM'].map((d: any) => d?.DOSHAM).filter(Boolean).map(String)
      : []

    // Same field-name-inconsistency pattern found repeatedly in Matches listing
    // responses (income/age/isIdVerified sent under different keys on different
    // endpoints) — apply the same fallback hardening here rather than trusting
    // a single field name.
    const isIdVerified = personal['IDVERIFY'] == '1' || personal['IDVERIFYSTATUS'] == '1' || personal['IDVERIFIED'] == '1'
    const income = professional['ANNUALINCOME'] ?? professional['MONTHLYINCOME'] ?? professional['INCOME']

    const model: ViewProfileModel = {
      // Confirmed live: this endpoint's PERSONALINFO uses MATRID (single I), not the
      // MATRIID spelling every other listing endpoint in this app uses — fallback
      // chain covers both rather than assuming one spelling. Sent back as a raw
      // JSON number (not a string like other endpoints), so coerce explicitly.
      profileId:        String(personal['MATRID'] ?? personal['MATRIID'] ?? personal['NBID'] ?? personal['ID'] ?? ''),
      name:             personal['NAME'] ?? '',
      age:              stripAgeUnit(personal['AGE']),
      location:         nriLocation || cityState,
      height:           personal['HEIGHTCATEGORY'] ?? personal['HEIGHT'] ?? undefined,
      education:        professional['EDUCATION'] ?? undefined,
      occupation:       professional['OCCUPATION'] ?? undefined,
      income:           income ?? undefined,
      caste:            religious['CASTE'] ?? undefined,
      photos,
      isPaidMember:     payment['ENTRYTYPE'] === 'P' || personal['MEMBERSHIP'] === '1',
      isIdVerified,
      isPhotoAvailable: photo['PHOTOAVAILABLE'] === 'Y',
      isPhotoProtect:   photo['PHOTOPROTECTED'] === 'Y',
      likedStatus:      toLikedStatus(comm['LIKED']),
      isNewlyJoined:    personal['NEWUSER'] === '1',
      isNewLabel:       false,
      labelContent:     '',
      phoneViewed:      String(comm['PHONEVIEWED'] ?? '0'),
      dontShowStatus:   String(comm['SKIPPED'] ?? '0'),
      viewLaterStatus:  String(comm['VIEWLATER'] ?? '0'),

      gender,
      maritalStatus:    personal['MARITALSTATUS'] ?? undefined,
      noOfChildren:     personal['NOOFCHILDREN'] ?? undefined,
      motherTongue:     personal['MOTHERTONGUE'] ?? personal['MOTHERTONGUES'] ?? undefined,
      physicalStatus:   personal['PHYSICALSTATUS'] ?? undefined,
      profileFor:       personal['PROFILEFOR'] ?? undefined,

      religion:  religious['RELIGION'] ?? undefined,
      subCaste:  religious['SUBCASTE'] ?? undefined,
      raasi:     religious['RAASI'] ?? undefined,
      star:      religious['STAR'] ?? undefined,
      dosham,

      drinking:     habits['DRINKING'] ?? undefined,
      smoking:      habits['SMOKING'] ?? undefined,
      eatingHabits: habits['EATINGHABITS'] ?? undefined,

      // Angular: viewprofile.page.html:1001 hides the whole Family details section
      // when `BROTHERS != '' || SISTERS != ''` is false — an empty string (not just
      // null/undefined) means "no data", so `??` alone let it through as "defined".
      brothers: family['BROTHERS'] || undefined,
      sisters:  family['SISTERS'] || undefined,
      property: toPropertyList(family['NPROPERTY']),
      vehicle:  toPropertyList(family['NVECHILE']),

      showHoroSection:    horo['SHOWHORO'] === '1',
      // Angular: viewprofile.page.html:821 checks `HOROSCOPEAVAILABLE == 'Y'`
      // (not '1' — that sentinel is 'Y'/'N', unlike the '1'/'0' SHOWHORO flag
      // right above it). Comparing against '1' here always failed, so this
      // profile fell into the "hasn't added horoscope" request-CTA branch
      // even when the opposite profile's horoscope really was available.
      horoscopeAvailable: horo['HOROSCOPEAVAILABLE'] === 'Y',
      horoCompatibility:  horo['COMPATIBILITY'] ?? undefined,
      hasStarMatchInputs: !!(religious['RAASI'] && religious['STAR']),

      likedMsg: comm['LIKEDMSG'] ?? undefined,
    }

    this.onAdapt?.(model)
    return model
  }

  onAdapt?: (result: ViewProfileModel) => void
}

export const viewProfileAdapter = new ViewProfileAdapter()
