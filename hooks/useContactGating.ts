// Paid/free-contact gating values MatchCard needs (oppGender, ownEntryType,
// femaleFreeEligible, indNumbersLeft) — extracted from MatchesScreen.tsx's own
// inline derivation (its loadMatches() effect) so any other screen that reuses
// MatchCard (e.g. ActivityScreen's liked-profile tabs) gets the same values
// without duplicating this fetch sequence a second time. MatchesScreen itself
// keeps its own inline copy for now — not migrated here, to avoid touching an
// already-large, working screen for a refactor nobody asked for.
import { useEffect, useState } from 'react'
import { getItem, getJson } from '../service/storageService'
import { getSessionValue } from '../service/registrationService'
import { fetchContactDetails } from '../service/communicationService'
import { StorageKeys } from '../constants/storage.keys'

export interface ContactGating {
  oppGender:          'M' | 'F'
  loginGender:        'M' | 'F'
  ownEntryType:       string
  femaleFreeEligible: boolean
  indNumbersLeft:     string
  contactQuota:       { viewed: string; left: string; expiry: string }
  loaded:             boolean
}

const INITIAL: ContactGating = {
  oppGender: 'F', loginGender: 'F', ownEntryType: '', femaleFreeEligible: false,
  indNumbersLeft: '0', contactQuota: { viewed: '0', left: '', expiry: '' }, loaded: false,
}

export function useContactGating(): ContactGating {
  const [state, setState] = useState<ContactGating>(INITIAL)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const lg = await getItem(StorageKeys.User.LOGIN_GENDER)
      // Angular: common.ts's getContactDetails() — populates CONTACT_DETAIL
      // before it's read below (must resolve first, same ordering MatchesScreen uses).
      await fetchContactDetails().catch(() => {})
      const [entryType, femaleFreeRaw, contactDetail] = await Promise.all([
        getSessionValue('ENTRYTYPE'),
        getSessionValue('FEMALEFREECONACT'),
        getJson<Record<string, any>>('CONTACT_DETAIL'),
      ])
      if (cancelled) return
      const loginGender: 'M' | 'F' = lg === 'M' ? 'M' : 'F'
      const oppGender: 'M' | 'F' = loginGender === 'F' ? 'M' : 'F'
      const femaleFree: any = femaleFreeRaw
      setState({
        oppGender,
        loginGender,
        ownEntryType: entryType ?? '',
        // Angular: getFree3Contact() && !getfreephoneviewOver()
        femaleFreeEligible: String(femaleFree?.FLAG) === '1' && loginGender === 'F' && String(femaleFree?.Left ?? '0') !== '0',
        // Angular: getIndNumbersLeft()
        indNumbersLeft: String(contactDetail?.IndNumbersLeft ?? '0'),
        contactQuota: {
          viewed: String(contactDetail?.phoneNumbersViewed ?? '0'),
          left:   String(contactDetail?.phoneNumbersLeft ?? ''),
          expiry: String(contactDetail?.expiryTextValue ?? ''),
        },
        loaded: true,
      })
    })()
    return () => { cancelled = true }
  }, [])

  return state
}
