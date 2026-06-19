import { getItem, setItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { navigate } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import { redirectToIntermediatePage, updatePaywall } from './paymentService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaywallEntry {
  PAYWALLTYPE: string
  PAYWALLDELAY: string
}

// ─── enablePaywall ────────────────────────────────────────────────────────────
// Called after login / app resume. Reads stored PAYMENTWALL array and schedules
// each entry. Only male free users see paywalls (LOGINGENDER==M, ENTRYTYPE==F).

export async function enablePaywall(): Promise<void> {
  const raw    = await getItem(SK.Payment.PAYMENT_WALL)
  const gender = await getItem(SK.User.LOGIN_GENDER)

  if (!raw || gender !== 'M') return

  let paywallArr: PaywallEntry[]
  try { paywallArr = JSON.parse(raw) } catch { return }

  const validEntries = paywallArr.filter(
    e => e.PAYWALLTYPE && e.PAYWALLTYPE !== '0',
  )

  validEntries.forEach((entry, index) => {
    const delay = (Number(entry.PAYWALLDELAY) || 0) * 1000 + index * 500
    setTimeout(() => openPaywall(entry.PAYWALLTYPE), delay)
  })
}

// ─── openPaywall ──────────────────────────────────────────────────────────────
// Maps PAYWALLTYPE (server value) to the payment page variant, then navigates.

export async function openPaywall(paywallType: string): Promise<void> {
  const typeMap: Record<string, string> = {
    '1': '12', '2': '12', '3': '13', '4': '4',
  }
  const resolvedType = typeMap[paywallType] ?? '12'

  await setItem('PAYWALLTYPE', paywallType)
  await setItem(SK.Payment.PAYMENT_WALL, JSON.stringify([{ PAYWALLTYPE: '0', PAYWALLDELAY: '0' }]))

  await redirectToIntermediatePage('paywall', undefined, resolvedType)
}

// ─── getPaywallType ───────────────────────────────────────────────────────────

export async function getPaywallType(): Promise<string | null> {
  return getItem('PAYWALLTYPE')
}

// ─── updatePaywallAndNavigate ─────────────────────────────────────────────────
// Updates server state + clears local flag, then navigates to payment page.

export async function updatePaywallAndNavigate(type: string): Promise<void> {
  await updatePaywall(type)
  navigate(ENavigation.PAYMENT, { type })
}
