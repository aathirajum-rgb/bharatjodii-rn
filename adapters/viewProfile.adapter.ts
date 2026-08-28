// Transforms the raw viewprofile API response (RESPONSE.REPONSE — that inner key's
// spelling is a real quirk of the actual API, confirmed against Angular's
// viewprofile.page.ts:719: `this.vpdata = data.vpdata.REPONSE`) into the
// ViewProfileModel UI model consumed by ViewProfileScreen.
// Pattern mirrors adapters/matches.adapter.ts.

import type { Adapter } from '../core/base/base.adapter'
import type { ViewProfileModel, PropertyItem } from '../types/interfaces/viewProfile.interface'
import { stripAgeUnit } from './profileListing.adapter'

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

    // Angular: viewprofile.page.html:607-652 — these are THREE separate, independently
    // gated rows (NRI location, city/state, and a Hindi/etc-only "Hometown" row), not
    // one collapsed string. NRI needs only ONE of NRICOUNTRY/NRISTATE present (not
    // both), and is COUNTRY-first ("India, Chennai" order, not "Chennai, India").
    // When NRI is showing, the city/state row's label switches from "Current location"
    // to "Home location" (HOME_LOCATION) — same row, different heading underneath it.
    const nriLocation = location['NRICOUNTRY'] || location['NRISTATE']
      ? [location['NRICOUNTRY'], location['NRISTATE']].filter(Boolean).join(', ')
      : undefined
    const cityState = [location['CITY'], location['STATE']].filter(Boolean).join(', ') || undefined
    const homeCityState = location['HOMECITY'] && location['HOMESTATE']
      ? [location['HOMECITY'], location['HOMESTATE']].filter(Boolean).join(', ')
      : undefined

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
    // Angular: viewprofile.page.html:692 — ANNUALINCOME=='0' means "no income data",
    // same "0" = "none" sentinel as elsewhere in this API, not a literal ₹0 income.
    const incomeRaw = professional['ANNUALINCOME'] ?? professional['MONTHLYINCOME'] ?? professional['INCOME']
    const income = incomeRaw != null && String(incomeRaw) !== '0' ? incomeRaw : undefined

    const model: ViewProfileModel = {
      // Confirmed live: this endpoint's PERSONALINFO uses MATRID (single I), not the
      // MATRIID spelling every other listing endpoint in this app uses — fallback
      // chain covers both rather than assuming one spelling. Sent back as a raw
      // JSON number (not a string like other endpoints), so coerce explicitly.
      profileId:        String(personal['MATRID'] ?? personal['MATRIID'] ?? personal['NBID'] ?? personal['ID'] ?? ''),
      name:             personal['NAME'] ?? '',
      age:              stripAgeUnit(personal['AGE']),
      location:         nriLocation || cityState || '',
      nriLocation,
      cityStateLocation: cityState,
      homeLocation:     homeCityState,
      height:           personal['HEIGHTCATEGORY'] ?? personal['HEIGHT'] ?? undefined,
      education:        professional['EDUCATION'] ?? undefined,
      occupation:       professional['OCCUPATION'] ?? undefined,
      income,
      caste:            religious['CASTE'] ?? undefined,
      photos,
      // Angular's viewprofile.page.html inline check (`ENTRYTYPE === '1'`) is stale —
      // confirmed live, this endpoint's PAYMENTINFO.ENTRYTYPE sends the same 'F'/'B'/
      // paid-tier letter codes as every listing endpoint, never '0'/'1'. Matches the
      // already-live-verified FUNC.IsPaidMember pattern homeService.ts uses for the
      // exact same field on Matches/Home listing cards, not the dead template value.
      isPaidMember:     !['B', 'F'].includes(String(payment['ENTRYTYPE'] ?? 'F')) || personal['MEMBERSHIP'] === '1',
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
      // Angular: viewprofile.page.ts:214/401 — homePlaceDomain.includes(MOTHERTONGUES)
      // gates the Hometown row on the raw numeric code, never the display text above.
      motherTongueCode: personal['MOTHERTONGUES'] ?? undefined,
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
      hasStarMatchInputs: !!(religious['RAASI'] && religious['STAR']),

      likedMsg: comm['LIKEDMSG'] ?? undefined,

      // Angular: viewprofile.page.ts:618-640 presentPopover() — content: this.vpdata?.
      // PERSONALINFO.IDDET.BODY, shown in the Verified badge's info popover.
      verifiedInfoText: personal['IDDET']?.['BODY'] ?? undefined,
    }

    this.onAdapt?.(model)
    return model
  }

  onAdapt?: (result: ViewProfileModel) => void
}

export const viewProfileAdapter = new ViewProfileAdapter()
