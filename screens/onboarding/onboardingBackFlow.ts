// Angular: registration-revamp.component.ts's onBtnClick() 'back' branch —
// onboarding back is resolved from a STATIC MAP (registration.config.ts's
// landingBackPage), not from history, with handlePageTypeBackNavigation()
// applying conditional overrides on top. Angular only falls through to
// navCtrl.back() when the map has no entry for the current page.
//
// Why RN needs this at all: the normal forward path already stacks each step
// via navigation.push('onboarding', {pageNo}), so a plain goBack() retraces
// the real route taken — which is what AppStack's OnboardingRouter does and
// should keep doing whenever there IS a stack under the current step. This
// map is the fallback for the case Angular handles natively and RN otherwise
// can't: onboarding entered DIRECTLY with nothing beneath it (resume via
// REGISTERURL on cold start, or pageLandingService's page_id '1' resetTo),
// where canGoBack() is false and the back button was previously hidden
// outright — leaving the user stranded mid-wizard with no way back.

import {
  getRegValue,
  isEducationGroupEligible,
  isJobDetailEligible,
} from '../../service/registrationService'

// Angular: registration.config.ts's landingBackPage. Entries whose Angular
// target is a non-onboarding route ('/signin' for page 1) are omitted — page 1
// is the wizard's first step, so a direct entry there has nothing to go back to
// inside AppStack (Angular's own '/signin' is the pre-auth stack, which RN
// models as a separate navigator entirely).
const LANDING_BACK_PAGE: Record<string, string> = {
  '2':  '1',
  '3':  '2',
  '4':  '3',
  '5':  '4',
  '43': '5',
  '38': '43',
  '39': '38',
  '9':  '39',
  '10': '9',
  '11': '10',
  '12': '11',
  '13': '12',
  '14': '13',
  '16': '20',
  '27': '35',
  '28': '27',
  '29': '28',
  '30': '29',
  '31': '30',
  '32': '29',
  '33': '32',
  '34': '20',
  '35': '34',
  '44': '46',
  '46': '9',
}

// Angular: registration.config.ts's SELFGENDER.
const SELF_GENDER = ['1', '10', '11']
// Angular: handlePageTypeBackNavigation()'s page-2 CREATEDBY override list.
const CREATED_BY_SKIPS_NAME = ['4', '5', '8', '9']
// Angular: JOB_DETAIL_HIDE_OCCUPATION — page 13 backs past income to occupation
// when the member selected "Not working".
const NOT_WORKING_OCCUPATION = '8'

// Angular: handlePageTypeBackNavigation() — conditional overrides applied on
// top of the static map above. The NRI (page 10 -> 41) and hometown-domain
// (page 10 -> 44/46) branches are deliberately NOT ported: both key off
// server-driven arrays (NATIVEPLACEDOMAIN) and page 41 has no RN screen, so
// guessing them would invent behavior rather than mirror it. Page 10's static
// '9' target stays, which is Angular's own value whenever neither applies.
export async function getOnboardingBackPage(pageNo: string): Promise<string | null> {
  if (pageNo === '2') {
    const createdBy = String((await getRegValue('CREATEDBY')) ?? '')
    if (CREATED_BY_SKIPS_NAME.includes(createdBy)) return '1'
  }

  if (pageNo === '4') {
    const createdBy = String((await getRegValue('CREATEDBY')) ?? '')
    if (!SELF_GENDER.includes(createdBy)) return '2'
  }

  if (pageNo === '13') {
    const occupation = String((await getRegValue('OCCUPATION')) ?? '')
    if (occupation === NOT_WORKING_OCCUPATION) return '11'
  }

  // JODII-490 "few more details" chain (20 -> [34] -> [35] -> 27) — back must
  // skip whichever of 34/35 was never shown. Mirrors the forward resolution in
  // fewMoreDetailsFlow.ts's getFewMoreDetailsNextPage().
  if (pageNo === '35') {
    const qualification = String((await getRegValue('QUALIFICATION')) ?? '')
    if (!isEducationGroupEligible(qualification)) return '20'
  }

  if (pageNo === '27') {
    const [qualification, occupation] = await Promise.all([
      getRegValue('QUALIFICATION'),
      getRegValue('OCCUPATION'),
    ])
    if (isJobDetailEligible(String(occupation ?? ''))) return '35'
    if (isEducationGroupEligible(String(qualification ?? ''))) return '34'
    return '20'
  }

  return LANDING_BACK_PAGE[pageNo] ?? null
}
