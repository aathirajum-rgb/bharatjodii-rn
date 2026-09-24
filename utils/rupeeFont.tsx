// Angular: global.scss:2316
//
//   .poppins-family { font-family: var(--english-poppins) !important; }
//
// Read that variable before trusting the class name — _variable.scss:24 is
//
//   --english-poppins: Roboto-Regular; // varible use for Rupess symbol
//
// so `.poppins-family` applies ROBOTO, not Poppins, and it exists precisely
// because Poppins' own ₹ is wrong. Using literal Poppins here would reproduce
// the very bug the class was written to avoid. RupeeSymbolFont is this port's
// name for that face (src/theme/fonts.ts:207), already used by RechargeScreen's
// strike-through price and savings line.
//
// Angular hangs that class on every element that shows money — benefits-card's
// price and struck-through price, breather/fullpage-modal discount amounts, the
// footer's upgrade tag, form-fields' INCOME label — because the regional faces
// (Tamil, Telugu, Malayalam, …) draw ₹ and the digits beside it differently from
// Poppins, and an amount rendered in them looks wrong next to the rest of the UI.
//
// A class is not available here: in React Native the font is a property of each
// Text, and this app already picks that per language (useLanguageFonts). So the
// equivalent is to wrap just the amount in a nested Text carrying Poppins — RN
// inherits everything else (size, colour, weight) from the parent, exactly as
// the CSS class only overrides font-family.
//
// Most amounts are NOT literals in this codebase — "Monthly ₹60,000 - ₹70,000"
// arrives inside a server string (the profile basic view), so this works on
// rendered text rather than at the call sites that happen to type a ₹.
import { Fragment, type ReactNode } from 'react'
import { Text } from 'react-native'
import { RupeeSymbolFont } from '../src/theme/fonts'

// ₹ plus the amount attached to it: digits, thousands separators, decimals, and
// the space some server strings put after the symbol ("₹ 1,199"). A bare ₹ with
// no number still matches, which is the case the symbol alone needs.
const AMOUNT_RE = /₹[\s ]?[\d.,]*/g

/**
 * Returns `text` with every ₹-amount wrapped in the rupee face, ready to drop
 * inside a <Text>. Plain string back when there is no ₹ in it, so the
 * common case adds no nested Text nodes.
 */
export function withRupeeFont(text: string): ReactNode {
  if (!text || !text.includes('₹')) return text

  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  // Fresh lastIndex each call — the regex is module-level and /g is stateful.
  AMOUNT_RE.lastIndex = 0
  while ((m = AMOUNT_RE.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`t${last}`}>{text.slice(last, m.index)}</Fragment>)
    out.push(
      <Text key={`r${m.index}`} style={{ fontFamily: RupeeSymbolFont }}>{m[0]}</Text>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>)
  return out
}

/**
 * Like withRupeeFont, but only the ₹ glyph itself switches face — the digits
 * keep the parent's font. For emphasised amounts (a promo's "₹2800 OFF"):
 * only Roboto-Regular is loaded, so wrapping the digits too rendered them
 * regular weight beside semibold text, where Angular's browser faux-bolds.
 */
export function withRupeeSymbolFont(text: string): ReactNode {
  if (!text || !text.includes('₹')) return text
  return text.split('₹').flatMap((part, i) => i === 0
    ? [<Fragment key="t0">{part}</Fragment>]
    : [
        <Text key={`r${i}`} style={{ fontFamily: RupeeSymbolFont }}>₹</Text>,
        <Fragment key={`t${i}`}>{part}</Fragment>,
      ])
}
