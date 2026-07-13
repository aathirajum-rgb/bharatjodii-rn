import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_REACT } from '../../constants/cdn'
import { clearSession } from '../../service/apiClient'

const SUCCESS_GIF = CDN_REACT + '/delete_success.gif'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { navigation: any; route: any }

// ─── DeleteProfileSuccessScreen ───────────────────────────────────────────────

export default function DeleteProfileSuccessScreen({ route }: Props) {
  const insets = useSafeAreaInsets()

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
      clearSession()
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  return (
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

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
  iconWrap: {
    width:          120,
    height:         120,
    alignItems:     'center',
    justifyContent: 'center',
  },
  message: {
    marginTop:     24,
    fontSize:      18,
    fontWeight:    '600',
    color:         '#1f1e1b',
    letterSpacing: 0.09,
    textAlign:     'center',
    lineHeight:    26,
    paddingHorizontal: 24,
  },
})
