import { Dimensions } from 'react-native'

// Possessive labels per createdBy key — used by all onboarding screens
// that build a dynamic title like "Enter your son's name".
// '1' (Myself) is absent intentionally: screens fall back to "your" or "their".
export const PROFILE_POSSESSIVE: Record<string, string> = {
  '4':  "son's",
  '5':  "daughter's",
  '8':  "brother's",
  '9':  "sister's",
  '10': "friend's",
  '11': "relative's",
}

// Singular (non-possessive) labels per createdBy key — Angular's PROFILETYPE
// map (registration.config.ts). Used only for English AGESTATEMENT text
// ("Your son is 21 years old"), where Angular's replaceProfileType() special-
// cases AGESTATEMENT + language 'en' to the singular form instead of the
// possessive used everywhere else (e.g. CONFIRM_SHEET, HOME_TOWN_TXT).
export const PROFILE_SINGULAR: Record<string, string> = {
  '4':  'SON',
  '5':  'DAUGHTER',
  '8':  'BROTHER',
  '9':  'SISTER',
  '10': 'FRIEND',
  '11': 'RELATIVE',
}

// Sliding picker panel dimensions — used by all onboarding screens
// that open a right-side animated modal (Religion, Caste, Gothra, etc.).
export const PICKER_PANEL_WIDTH = Dimensions.get('window').width * 0.85
export const PICKER_ITEM_HEIGHT = 52
