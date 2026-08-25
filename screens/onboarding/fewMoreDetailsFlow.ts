// Angular: registration-revamp.component.ts's getFewMoreDetailsNext() —
// resolves the conditional JODII-490 "few more details" chain
//   20 (add photo) → [34 education detail] → [35 occupation detail] → 27 (family)
// where both 34 and 35 are shown only when eligible:
//   34 — qualification is a Bachelor's/Master's degree (EDU_DETAIL_KEYS ['1','2'])
//   35 — any occupation except "Not working" (JOB_DETAIL_HIDE_OCCUPATION '8')
// When neither is eligible the chain collapses to 20 → 27, which is what this
// port did unconditionally before the two screens existed.

import {
  getRegValue,
  isEducationGroupEligible,
  isJobDetailEligible,
} from '../../service/registrationService'

export async function getFewMoreDetailsNextPage(fromPage: '20' | '34' | '35'): Promise<string> {
  if (fromPage === '20') {
    const qualification = String((await getRegValue('QUALIFICATION')) ?? '')
    if (isEducationGroupEligible(qualification)) return '34'
  }
  if (fromPage === '20' || fromPage === '34') {
    const occupation = String((await getRegValue('OCCUPATION')) ?? '')
    if (isJobDetailEligible(occupation)) return '35'
  }
  return '27'
}
