import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect, useRef } from 'react'
import { Colors } from '../../constants/colors'

const SCREEN_H = Dimensions.get('window').height

type Props = {
  visible: boolean
  onContinue: () => void
}

export default function RegistrationSuccessSheet({ visible, onContinue }: Props) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(200)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14,
      }).start()
    } else {
      slideAnim.setValue(200)
    }
  }, [visible])

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Platform.OS === 'ios' ? insets.bottom + 24 : 32,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.title}>Profile created successfully!</Text>

          <Pressable style={styles.ctaBtn} onPress={onContinue}>
            <Text style={styles.ctaLabel}>Continue</Text>
            <Text style={styles.ctaArrow}> ›</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:  Colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop:        28,
    gap:               20,
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.textPrimary,
    lineHeight: 24,
  },
  ctaBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.primary,
    borderRadius:    8,
    height:          52,
  },
  ctaLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.surface,
  },
  ctaArrow: {
    fontSize:   20,
    fontWeight: '600',
    color:      Colors.surface,
    lineHeight: 22,
  },
})
