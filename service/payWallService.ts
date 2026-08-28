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

// ─── getPaymentWallType ───────────────────────────────────────────────────────
// Angular: pay-wall.service.ts's getPaymentWallType() —
//   JSON.parse(localStorage.PAYMENTWALL)?.PAYWALLTYPE.toString()
//
// Angular stores PAYMENTWALL as an OBJECT ({PAYWALLTYPE, PAYWALLDELAY}); this
// project's enablePaywall() above parses it as an ARRAY of those. Both shapes
// are handled here rather than betting on one, and the standalone PAYWALLTYPE
// key that openPaywall() writes is the last fallback.
//
// PAYWALLTYPE '4' is the EXPIRED wall (pay-wall.service.ts's own type map:
// `4: "EXPIRED"`).

async function getPaymentWallType(): Promise<string> {
  const raw = await getItem(SK.Payment.PAYMENT_WALL)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const entry  = Array.isArray(parsed) ? parsed[0] : parsed
      const type   = entry?.PAYWALLTYPE
      if (type !== undefined && type !== null && String(type) !== '') return String(type)
    } catch {
      // Fall through to the standalone key.
    }
  }
  return String((await getItem('PAYWALLTYPE')) ?? '')
}

// ─── checkFreeTrialCondition ──────────────────────────────────────────────────
// Angular: pay-wall.service.ts's checkFreeTrialCondition(). NOTE its body is
// commented out under "JODII-345 open up paywall promotion screens" and it
// unconditionally `return false` — which makes the EXPIRED variant of the menu
// promo banner unreachable in the current Angular build.
//
// The logic below is the commented-out intent, which is also still LIVE and
// uncommented in explore.component.ts's own copy of the same method — so this
// is the app's real definition of the condition, not an invention.
//
//   expired : LOGINGENDER=='M' && ENTRYTYPE=='F' && paywallType=='4'
//   default : LOGINGENDER=='M' && ENTRYTYPE=='F'
//             && ['4','2','3','1','0'].includes(paywallType)
//             && NUMBEROFPAYMENTS=='0'

export async function checkFreeTrialCondition(type = ''): Promise<boolean> {
  const [gender, entryType, paywallType] = await Promise.all([
    getItem(SK.User.LOGIN_GENDER),
    getItem(SK.Auth.ENTRY_TYPE),
    getPaymentWallType(),
  ])

  if (gender !== 'M' || entryType !== 'F') return false

  if (type === 'expired') return paywallType === '4'

  // Angular's getNoOfPayment(): localStorage NUMBEROFPAYMENTS, defaulting '0'.
  const noOfPayment = String((await getItem('NUMBEROFPAYMENTS')) ?? '0') || '0'
  return ['4', '2', '3', '1', '0'].includes(paywallType) && noOfPayment === '0'
}

// ─── updatePaywallAndNavigate ─────────────────────────────────────────────────
// Updates server state + clears local flag, then navigates to payment page.

export async function updatePaywallAndNavigate(type: string): Promise<void> {
  await updatePaywall(type)
  navigate(ENavigation.PAYMENT, { type })
}
