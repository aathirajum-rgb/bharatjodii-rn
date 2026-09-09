import { Platform, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, FontSize } from '../../src/theme/fonts'

// Shared layout styles used by every onboarding screen.
// Import as `os` to keep usage terse: os.screen, os.footer, etc.
export const os = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },
  flex1: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     24,
  },

  pageIcon: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  // Poppins fallback for screens that don't override fontFamily inline.
  // Screens rendering server-translated text should override this per-render
  // via useLanguageFonts() (e.g. { fontFamily: langFonts.semiBold }) so
  // non-English languages get their matching NotoSans script instead.
  // Angular: the "onboarding/:id" route renders registration-revamp.component,
  // whose page-title ion-label (registration-revamp.component.html:32) is
  // `.heading1-semibold-22 black-color` for every currentPageType — font22,
  // not font20, and .black-color has no competing override in this component
  // (unlike the older /registration/:id flow) so color is plain #000. No
  // line-height class is set here.
  title: {
    fontFamily:   Fonts.poppinsSemiBold,
    fontSize:     FontSize.font22,
    fontWeight:   '600',
    color:        Colors.black,
    marginBottom: 32,
  },

  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    paddingTop:        20,
    backgroundColor:   Colors.surface,
  },

  // Angular: registration-revamp.component.html's error rows (job-detail
  // error line 113, DOB error line 313) both use `.body3-regular-12
  // color-de2a68` — font12, not a hardcoded 12, and no line-height class.
  errorText: {
    marginTop: 8,
    fontSize:  FontSize.font12,
    color:     Colors.inputError,
  },
})

// Helper: bottom padding for the sticky footer to respect safe area.
export function footerPaddingBottom(insetsBottom: number): number {
  return Platform.OS === 'ios' ? insetsBottom : 20
}

// Helper: bottom padding for ScrollView content so it clears the footer.
export function scrollPaddingBottom(insetsBottom: number, footerH: number): number {
  return footerH + (Platform.OS === 'ios' ? insetsBottom : 20) + 12
}
