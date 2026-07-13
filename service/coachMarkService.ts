// One-time "swipe to see other profiles" coach-mark on ViewProfileScreen —
// Angular: viewprofile.page.ts's coach-mark tour. A true one-time-ever flag,
// unlike appRatingService.ts's cooldown-based gate — no date logic needed.
import { getItem, setItem } from './storageService'

const KEY = 'VIEWPROFILE_COACHMARK_SHOWN'

export async function shouldShowCoachMark(): Promise<boolean> {
  const shown = await getItem(KEY)
  return shown !== '1'
}

export async function markCoachMarkShown(): Promise<void> {
  await setItem(KEY, '1')
}
