// Income disclosure prompt — Angular: matches.page.ts:2432-2479 checkIncomeSheet()/
// openIncomeSheet()/modalResponse(). Nudges a user who hasn't specified their income
// to add one, ~1.2s after landing on Matches; snoozed 7 days on dismiss without one.
// Angular's own sheet also handles NRI currency selection (registration.service.ts's
// getIncomeSheetComponentData()) — simplified here to the INR income list only via
// the existing SearchablePicker, not a full replica of that registration-style form.
import { getItem, setItem, removeItem } from './storageService'
import { getSessionValue, setSessionValue } from './registrationService'
import { getPaymentWallType } from './payWallService'
import { submitFieldChanges } from './editProfileService'

// Angular core/config/registration.config.ts
const INCOME_NOT_SPECIFIED = '10'
const SNOOZE_KEY  = 'INCOMEPOPUPNEXTSHOW'
const SNOOZE_DAYS = 7

export async function shouldShowIncomeSheet(): Promise<boolean> {
  const income = String((await getSessionValue('INCOME')) ?? '')
  if (income !== INCOME_NOT_SPECIFIED) return false

  const paywallType = await getPaymentWallType()
  if (paywallType && paywallType !== '0') return false

  const nextShowAt = Number((await getItem(SNOOZE_KEY)) ?? '0')
  if (nextShowAt && Date.now() < nextShowAt) return false

  return true
}

// Returns true on a real save — caller clears its own local state either way.
export async function saveIncome(incomeKey: string): Promise<boolean> {
  const result = await submitFieldChanges([{ field: 'INCOME', value: incomeKey }])
  if (!result.succeeded.includes('INCOME')) return false
  await setSessionValue('INCOME', incomeKey)
  await removeItem(SNOOZE_KEY)
  return true
}

export async function snoozeIncomeSheet(): Promise<void> {
  const snoozeMs = SNOOZE_DAYS * 24 * 60 * 60 * 1000
  await setItem(SNOOZE_KEY, String(Date.now() + snoozeMs))
}
