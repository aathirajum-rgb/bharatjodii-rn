// Spacing scale — all padding, margin, gap values come from here.
// Base unit is 4dp. xxl: 24 matches --ion-cust-padding: 24px from Angular.

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,    // primary screen horizontal padding
  xxxl: 32,
  xxxxl: 48,
} as const

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,  // perfect circle / pill shape
} as const
