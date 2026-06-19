// All app colors — single source of truth.
// Extracted from Angular variables.scss and _variable.scss.
// No raw hex strings anywhere else in the app — always import from here.

export const Colors = {

  // ── Brand ──────────────────────────────────────────────
  primary: '#B50033',        // main brand maroon
  primaryPink: '#DE2A68',    // secondary brand pink
  orange: '#ED6402',         // accent orange

  // ── Semantic ───────────────────────────────────────────
  success: '#00a03a',
  successLight: '#4AC14B',   // whatsapp green / online indicator
  error: '#E12B10',
  errorPink: '#DE2A68',
  warning: '#ffc409',
  link: '#29339B',

  // ── Neutrals ───────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  lightBlack: '#262626',
  blackLight: '#333333',
  dark: '#222428',
  grey: '#666666',
  greyMedium: '#808080',
  greyDark: '#8A8A8A',
  greyLight: '#b3b3b3',
  greyBorder: '#e5e5e5',
  greyBorderSoft: 'rgba(0, 0, 0, 0.20)',
  greyBackground: '#FAFAFA',
  lightBlue: '#f1f5f9',
  e6e6e6: '#e6e6e6',

  // ── Extended Palette ───────────────────────────────────
  purple: '#7A0E54',
  raasi: '#7E0884',
  govId: '#0069CA',
  submitYellow: '#BD7800',
  teal: '#1ec7bd',
  cream: '#fef6db',
  toast: '#2F2E41',
  brown: 'rgba(128, 32, 0, 1)',
  lightGreenExtended: 'rgba(54, 128, 82, 1)',
  lightBlueExtended: 'rgba(42, 79, 165, 1)',

  // ── Payment radio buttons ──────────────────────────────
  radioBasic: 'rgb(103, 144, 198)',
  radioStandard: '#BC0E4D',
  radioSuper: 'rgb(87, 163, 137)',

  // ── Utility ────────────────────────────────────────────
  transparent: 'transparent',
  overlayHalf: 'rgba(0, 0, 0, 0.5)',

} as const

export type ColorKey = keyof typeof Colors
