import { Platform, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'

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
  },

  pageIcon: {
    width:        48,
    height:       48,
    marginBottom: 24,
  },

  title: {
    fontSize:     22,
    fontWeight:   '600',
    color:        Colors.textPrimary,
    lineHeight:   28,
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

  errorText: {
    marginTop: 8,
    fontSize:  12,
    color:     Colors.inputError,
    lineHeight: 16,
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
