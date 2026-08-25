import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
import { CDN_SVG } from '../../constants/cdn'
import { os } from './onboardingStyles'
import { getFewMoreDetailsNextPage } from './fewMoreDetailsFlow'
import { useLanguageFonts } from '../../hooks/useLanguageFonts'

// ─── Constants ────────────────────────────────────────────────────────────────

const CDN_MALE_PLACEHOLDER   = CDN_SVG + 'add-photo.svg'
const CDN_FEMALE_PLACEHOLDER = CDN_SVG + 'add-photo.svg'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: any
  route:      { params?: { pageNo?: string } }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddPhotoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  const [gender,    setGender]    = useState('1')
  const [createdBy, setCreatedBy] = useState('4')

  // Angular: add-photo.component.ts's skip() — for the onboarding fromPage it
  // just emits straight to onboardingSkip(), no confirmation dialog; that only
  // exists for this same component's OTHER entry point (opened from a
  // notification banner), not here.
  function handleSkip() {
    // Angular: getFewMoreDetailsNext('20') — the JODII-490 chain routes to
    // 34 (education detail) or 35 (occupation detail) when eligible, else 27.
    getFewMoreDetailsNextPage('20').then(next =>
      navigation.push('onboarding', { pageNo: next }))
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

        {/* Title — Angular: add-photo.component.html's bindTitle() default for
            the onboarding fromPage ("Add your photo <br> to continue"); this
            is server-driven dynamic content in Angular, not a static locale
            key, so the English copy is kept verbatim here. */}
        <Text style={[styles.title, { fontFamily: langFonts.semiBold }]}>Add your photo{'\n'}to continue</Text>

        {/* Benefits card — Angular: add-photo.component.html's promotype==='1'
            block (SUBHEADER + BODY.CONTENT1/CONTENT2), also dynamic content;
            same default copy kept, "shortlist" not "like" per Angular's own
            template default. */}
        <View style={styles.card}>
          <Text style={[styles.cardIntro, { fontFamily: langFonts.regular }]}>Only if you add photo:</Text>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={[styles.bulletText, { fontFamily: langFonts.medium }]}>You will be able to shortlist matches</Text>
          </View>

          <View style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={[styles.bulletText, { fontFamily: langFonts.medium }]}>Your profile will be visible to matches</Text>
          </View>

          {/* Add photo button inside card — Angular: registration.config.ts
              page 20's CTA key, REGISTRATION.ADDPHOTOCTA. */}
          <Pressable
            style={styles.addBtn}
            onPress={openGallery}
            accessibilityRole="button"
          >
            <Text style={[styles.addBtnLabel, { fontFamily: langFonts.semiBold }]}>
              {t('REGISTRATION.ADDPHOTOCTA', 'Add photo')}
            </Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* "I'll do this later" pinned at bottom — Angular: skips immediately,
          no confirmation dialog, for the onboarding entry point. */}
      <Pressable
        style={[styles.laterRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}
        onPress={handleSkip}
        hitSlop={12}
      >
        <Text style={[styles.laterText, { fontFamily: langFonts.regular }]}>
          {t('REGISTRATION.IWILLDOTHISLATER', "I'll do this later")}
        </Text>
        <Text style={styles.laterChevron}>›</Text>
      </Pressable>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    width:    180,
    height:   200,
    overflow: 'hidden',
    alignItems:      'center',
    justifyContent:  'center',
  
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
    color:      '#333333',
  },
  laterChevron: {
    fontSize:   18,
    color:      '#333333',
    lineHeight: 22,
  },
})
