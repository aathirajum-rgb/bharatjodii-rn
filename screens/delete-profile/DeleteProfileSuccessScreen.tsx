import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { clearSession } from '../../service/apiClient'
import { setItem } from '../../service/storageService'
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb'
import DeleteProfileSuccessDesktopLayout from './DeleteProfileSuccessDesktopLayout'
import { FontSize } from '../../src/theme/fonts'
import ScreenTopInset from '../../components/screen/ScreenTopInset'

const SUCCESS_GIF = CDN_REACT + '/delete_success.gif'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }

// ─── DeleteProfileSuccessScreen ───────────────────────────────────────────────

export default function DeleteProfileSuccessScreen({ route }: Props) {
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktopWeb()

  const {
    successMsg = 'Your profile has been successfully deleted',
  } = route.params ?? {}

  // Strip HTML tags (<br>, <br/> etc.) → newline for native display
  const displayMsg = successMsg.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')

  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:         1,
        useNativeDriver: true,
        tension:         55,
        friction:        8,
      }),
      Animated.timing(fadeAnim, {
        toValue:         1,
        duration:        500,
        delay:           200,
        useNativeDriver: true,
      }),
    ]).start()

    const timer = setTimeout(() => {
      // Flag consumed by AuthStack's Splash screen — post-delete, the user
      // already has a language picked, so skip re-showing LanguageSelection
      // and land straight on the mobile-number/login screen. Scoped to this
      // one flow only (not e.g. plain logout) — see AuthStack.tsx.
      setItem('POST_DELETE_SKIP_LANGUAGE', '1')
      clearSession()
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  if (isDesktop) {
    return <DeleteProfileSuccessDesktopLayout message={displayMsg} />
  }

  return (
    <View style={[s.screen, { paddingBottom: insets.bottom }]}>
      <ScreenTopInset style={s.topInset} />

      {/* Success GIF */}
      <Animated.View style={[s.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={{ uri: SUCCESS_GIF }}
          style={{ width: 120, height: 120 }}
          contentFit="contain"
        />
      </Animated.View>

      {/* Success message from API */}
      <Animated.Text style={[s.message, { opacity: fadeAnim }]}>
        {displayMsg}
      </Animated.Text>

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.white,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Absolute so the strip doesn't add to the flex layout and shift the
  // centered content — screen's justifyContent:'center' must be preserved.
  topInset: { position: 'absolute', top: 0, left: 0, right: 0 },
  iconWrap: {
    width:          120,
    height:         120,
    alignItems:     'center',
    justifyContent: 'center',
  },
  message: {
    marginTop:     24,
    fontSize:      FontSize.font18,
    fontWeight:    '600',
    color:         '#1f1e1b',
    letterSpacing: 0.09,
    textAlign:     'center',
    lineHeight:    26,
    paddingHorizontal: 24,
  },
})
