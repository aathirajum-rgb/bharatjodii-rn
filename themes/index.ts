import { Colors } from './colors'
import { FontFamilies, FontSizes, FontWeights, LangFontMap } from './typography'
import { Spacing, BorderRadius } from './spacing'
import { Gradients } from './gradients'

// Single theme object — use this for component StyleSheets
export const theme = {
  colors: Colors,
  fonts: FontFamilies,
  fontSize: FontSizes,
  fontWeight: FontWeights,
  spacing: Spacing,
  borderRadius: BorderRadius,
  gradients: Gradients,
} as const

export type Theme = typeof theme

// Named re-exports — use these for direct imports when needed
export { Colors, FontFamilies, FontSizes, FontWeights, LangFontMap, Spacing, BorderRadius, Gradients }
