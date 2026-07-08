import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { useOnboardingFooter } from '../../contexts/OnboardingContext'
import { getRegValue } from '../../service/registrationService'
import { CDN_IMG } from '../../constants/cdn'
import { os } from './onboardingStyles'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_MALE_PLACEHOLDER   = CDN_IMG + 'male_silhouette.png'
const CDN_FEMALE_PLACEHOLDER = CDN_IMG + 'female_silhouette.png'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route:      { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddPhotoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()

  const [gender,    setGender]    = useState('1')
  const [createdBy, setCreatedBy] = useState('4')
  const [skipSheetVisible, setSkipSheetVisible] = useState(false)

  const slideAnim = useRef(new Animated.Value(300)).current

  function openSkipSheet() {
    setSkipSheetVisible(true)
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20,
    }).start()
  }

  function closeSkipSheet(thenNavigate = false) {
    Animated.timing(slideAnim, {
      toValue: 300, duration: 220, useNativeDriver: true,
    }).start(() => {
      setSkipSheetVisible(false)
      if (thenNavigate) navigation.push('onboarding', { pageNo: '27' })
    })
  }

  useEffect(() => {
    Promise.all([
      getRegValue('GENDER'),
      getRegValue('CREATEDBY'),
    ]).then(([g, cb]) => {
      if (g)  setGender(g)
      if (cb) setCreatedBy(cb)
    })
  }, [])

  const isFemale = gender === '2' || ['5', '9'].includes(createdBy)

  function openGallery() {
    navigation.push('onboarding', { pageNo: '22' })
  }

  useOnboardingFooter({
    nextHidden: true,
    showSkip:   false,
    onNext:     () => {},
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={os.flex1}>
      <ScrollView
        style={os.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Pink photo placeholder */}
        <View style={styles.photoAreaWrapper}>
          <Pressable
            style={styles.photoArea}
            onPress={openGallery}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
          >
            <Image
              source={{ uri: isFemale ? CDN_FEMALE_PLACEHOLDER : CDN_MALE_PLACEHOLDER }}
              style={styles.silhouette}
              contentFit="contain"
            />
          </Pressable>
        </View>

        {/* Title */}
        <Text style={styles.title}>Add your photo{'\n'}to continue</Text>

        {/* Benefits card */}
        <View style={styles.card}>
          <Text style={styles.cardIntro}>Only if you add photo:</Text>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>You will be able to like matches</Text>
          </View>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>Your profile will be visible to matches</Text>
          </View>

          {/* Add photo button inside card */}
          <Pressable
            style={styles.addBtn}
            onPress={openGallery}
            accessibilityRole="button"
          >
            <Text style={styles.addBtnLabel}>Add photo now</Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* "I'll do this later" pinned at bottom */}
      <Pressable
        style={[styles.laterRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}
        onPress={openSkipSheet}
        hitSlop={12}
      >
        <Text style={styles.laterText}>I'll do this later</Text>
        <Text style={styles.laterChevron}>›</Text>
      </Pressable>

      {/* Skip-confirm bottom sheet */}
      <Modal
        transparent
        visible={skipSheetVisible}
        animationType="none"
        onRequestClose={() => closeSkipSheet(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.sheetOverlay} onPress={() => closeSkipSheet(false)}>
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24,
                transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.warnIconCircle}>
              <Text style={styles.warnIconText}>!</Text>
            </View>

            <Text style={styles.sheetTitle}>
              Without adding photo you will not be able to like matches or get responses.
            </Text>
            <Text style={styles.sheetSub}>Do you want to add photo?</Text>

            <Pressable
              style={styles.sheetBtnOutline}
              onPress={() => closeSkipSheet(true)}
            >
              <Text style={styles.sheetBtnOutlineLabel}>I'll do this later</Text>
            </Pressable>

            <Pressable
              style={styles.sheetBtnSolid}
              onPress={() => { closeSkipSheet(false); openGallery() }}
            >
              <Text style={styles.sheetBtnSolidLabel}>Yes, add photo</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PINK_BG = '#fdf0f3'

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop:        16,
    alignItems:        'center',
  },

  photoAreaWrapper: {
    alignItems:    'center',
    marginBottom:  24,
  },
  photoArea: {
    width:           180,
    height:          200,
    backgroundColor: PINK_BG,
    borderRadius:    20,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     '#f5cdd8',
  },
  silhouette: {
    width:  '100%',
    height: '100%',
  },

  title: {
    fontSize:      24,
    fontWeight:    '700',
    color:         Colors.textPrimary,
    lineHeight:    32,
    textAlign:     'center',
    marginBottom:  24,
  },

  card: {
    width:             '100%',
    backgroundColor:   Colors.surface,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       Colors.divider,
    paddingHorizontal: 20,
    paddingVertical:   20,
    gap:               14,
    shadowColor:       Colors.black,
    shadowOpacity:     0.06,
    shadowOffset:      { width: 0, height: 2 },
    shadowRadius:      8,
    elevation:         3,
  },
  cardIntro: {
    fontSize:   13,
    fontWeight: '400',
    color:      Colors.textSecondary,
    lineHeight: 18,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  bullet: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.textPrimary,
    marginTop:       7,
    flexShrink:      0,
  },
  bulletText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '700',
    color:      Colors.textPrimary,
    lineHeight: 20,
  },

  addBtn: {
    height:          52,
    backgroundColor: Colors.primaryDark,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
  },
  addBtnLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.white,
  },

  laterRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    paddingTop:        14,
    paddingHorizontal: 24,
    gap:               4,
    backgroundColor:   Colors.surface,
  },
  laterText: {
    fontSize:   14,
    fontFamily: 'Poppins-Regular',
    color:      '#333333',
  },
  laterChevron: {
    fontSize:   18,
    color:      '#333333',
    lineHeight: 22,
  },

  sheetOverlay: {
    flex:            1,
    backgroundColor: Colors.scrim,
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingTop:           28,
    gap:                  16,
  },
  warnIconCircle: {
    alignSelf:       'flex-start',
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  warnIconText: {
    color:      Colors.white,
    fontSize:   20,
    fontWeight: '700',
    lineHeight: 24,
  },
  sheetTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.textPrimary,
    lineHeight: 26,
  },
  sheetSub: {
    fontSize:   14,
    fontWeight: '400',
    color:      Colors.textSecondary,
    lineHeight: 20,
  },
  sheetBtnOutline: {
    height:          52,
    borderRadius:    8,
    borderWidth:     1.5,
    borderColor:     Colors.primaryDark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sheetBtnOutlineLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.primaryDark,
  },
  sheetBtnSolid: {
    height:          52,
    borderRadius:    8,
    backgroundColor: Colors.primaryDark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sheetBtnSolidLabel: {
    fontSize:   16,
    fontWeight: '600',
    color:      Colors.white,
  },
})
