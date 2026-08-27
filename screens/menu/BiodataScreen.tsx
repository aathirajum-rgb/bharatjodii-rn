// Angular: pages/download-biodata/download-biodata.component.html + .ts —
// a DEDICATED screen (not a mode of ViewProfileScreen), reached from Menu's
// "Download your biodata" row. Shows the logged-in user's own profile as a
// downloadable/shareable biodata, skinned by 5 swipeable color templates.

import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Alert, Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { getItem, setItem } from '../../service/storageService'
import { handleBack as goBackCentral } from '../../utils/navigationRef'
import {
  getBiodataProfile, getFirstMissingBiodataField, showReligiousDetails, hasPropertyDetails,
  propertyContentText, resolveFamilyCountLabel, saveBiodataThemeId, getSavedBiodataThemeId,
  getBioDataDownloadLink, type BiodataProfile, type BiodataTheme,
} from '../../service/biodataService'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

const SCREEN_WIDTH  = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

const ICON_BACK        = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON     = CDN_REACT + '/menu_right_arrow.svg'
const ICON_ALERT       = CDN + 'assets/images/svg/activity-alert-img.svg'
const ICON_ADD         = CDN + 'assets/images/svg/app-photos-edit-profile-img.svg'
const ICON_JODII_LOGO  = CDN + 'assets/images/svg/biodata-jodii-logo.svg'
const ICON_TOP_DECOR   = CDN + 'assets/images/svg/download-biodata-top.svg'
const ICON_BOTTOM_DECOR = CDN + 'assets/images/svg/download-biodata-bottom.svg'
const ICON_EDIT_PHOTO  = CDN + 'assets/images/svg/biodata-edit-icon.svg'
const ICON_BACK_ARROW_THEME = CDN + 'assets/images/svg/biodata-back-arrow.svg'
const ICON_NEXT_ARROW_THEME = CDN + 'assets/images/svg/biodata-next-arrow.svg'

// Angular: negative-margin-top-*-biodata classes — each template's photo/
// details card overlaps UP into the themed top image by a different amount.
const BIODATA_THEME_OVERLAP_VH: Record<string, number> = { '1': 8, '2': 8, '3': 13, '4': 18, '5': 2 }
function themeOverlapMargin(themeValue: string): number {
  const vh = BIODATA_THEME_OVERLAP_VH[themeValue] ?? 0
  return -Math.round(SCREEN_HEIGHT * (vh / 100))
}

const VIEWED_SWIPE_KEY = 'VIEWEDSWIP'

type Props = { navigation: any }

export default function BiodataScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [profile, setProfile]     = useState<BiodataProfile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [matriId, setMatriId]     = useState('')
  const [occupationCode, setOccupationCode] = useState('')
  const [themeIndex, setThemeIndex]   = useState(0)
  const [brothersLabel, setBrothersLabel] = useState('')
  const [sistersLabel, setSistersLabel]   = useState('')
  const [showSwipeTip, setShowSwipeTip]   = useState(false)
  const [downloading, setDownloading]     = useState(false)

  // Refetches on focus (not just mount) so returning from the standalone
  // Manage Photos flow (see handleAddPhoto/handleEditPhoto below) shows the
  // photo change immediately — same pattern as EditProfileScreen.tsx.
  const load = useCallback(async () => {
    setLoading(true)
    const [id, occCode, data, savedThemeId, viewedSwipe] = await Promise.all([
      getItem(SK.Auth.USER_ID),
      getItem(SK.User.OCCUPATION),
      getBiodataProfile(),
      getSavedBiodataThemeId(),
      getItem(VIEWED_SWIPE_KEY),
    ])
    setMatriId(id ?? '')
    setOccupationCode(occCode ?? '0')
    setProfile(data)
    if (data) {
      const idx = data.BIODATATHEME.findIndex(th => th.value === savedThemeId)
      setThemeIndex(idx >= 0 ? idx : 0)
      const [bLabel, sLabel] = await Promise.all([
        resolveFamilyCountLabel('BOTHER', data.FAMILYINFO?.BROTHERS),
        resolveFamilyCountLabel('SISTER', data.FAMILYINFO?.SISTERS),
      ])
      setBrothersLabel(bLabel)
      setSistersLabel(sLabel)
      if (!viewedSwipe && data.BIODATATHEME.length > 1) setShowSwipeTip(true)
    }
    setLoading(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function handleBack() {
    if (navigation.canGoBack()) goBackCentral()
    else navigation.reset({ index: 0, routes: [{ name: 'Menu' }] })
  }

  function dismissSwipeTip() {
    setShowSwipeTip(false)
    setItem(VIEWED_SWIPE_KEY, '1').catch(() => {})
  }

  const themes = profile?.BIODATATHEME ?? []
  const currentTheme: BiodataTheme | undefined = themes[themeIndex]

  function cycleTheme(direction: 1 | -1) {
    if (themes.length === 0) return
    const next = (themeIndex + direction + themes.length) % themes.length
    setThemeIndex(next)
    saveBiodataThemeId(themes[next]!.value).catch(() => {})
  }

  // Angular: .vpcontent{{viewedid}} onMove gesture — a horizontal swipe over
  // the themed top area cycles templates.
  const themeSwipeGesture = Gesture.Pan()
    .enabled(themes.length > 1)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onEnd(e => {
      if (e.translationX > 40) runOnJS(cycleTheme)(-1)
      else if (e.translationX < -40) runOnJS(cycleTheme)(1)
    })

  const missingField = profile ? getFirstMissingBiodataField(profile, occupationCode) : null

  function handleAddNow() {
    if (missingField) navigation.navigate(missingField.screen)
  }

  function stub(label: string) {
    Alert.alert(label, 'Coming soon')
  }

  // Add/Edit photo — same standalone Manage Photos entry point HelpCenterScreen
  // and HomeScreen already use elsewhere (ManagePhotosScreen → CustomGalleryScreen,
  // both Expo-based: expo-media-library/expo-image-picker). `standalone: true`
  // means Confirm/Back returns here instead of continuing the signup wizard.
  function handleAddPhoto() {
    navigation.navigate('onboarding', { pageNo: '21', standalone: true })
  }

  async function handleDownload() {
    if (!matriId) return
    setDownloading(true)
    try {
      const url = await getBioDataDownloadLink(matriId, currentTheme?.value ?? '1')
      Linking.openURL(url)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <View style={[s.screen, s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={[s.screen, s.centered, { paddingTop: insets.top }]}>
        <Text style={s.errorText}>Could not load your biodata.</Text>
        <ButtonRevamp label="Go back" variant="primary" onPress={handleBack} />
      </View>
    )
  }

  const personal      = profile.PERSONALINFO ?? {}
  const professional  = profile.PROFESSIONALINFO ?? {}
  const habits        = profile.HABITSINFO ?? {}
  const religious     = profile.RELIGIOUSINFO ?? {}
  const family        = profile.FAMILYINFO ?? {}
  const horo          = profile.HOROINFO ?? {}
  const photo         = profile.PHOTOINFO ?? {}
  const location      = profile.LOCATIONINFO ?? {}

  const showReligious = showReligiousDetails(profile.RELIGION)
  const showIncomeRow = !['8', '0'].includes(occupationCode)
  const photoAvailable = photo.PHOTOAVAILABLE === 'Y'
  const photoCount      = Number(photo.PHOTOCOUNT ?? 0)
  const photos: any[]   = Array.isArray(photo.PHOTO) ? photo.PHOTO : []
  const photoUrl = photoAvailable && photos.length > 0
    ? photos[photos.length - 1]?.IMAGE
    : undefined

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        <Pressable style={s.langPill} onPress={() => navigation.navigate('LanguageSelection')}>
          <Text style={s.langPillText}>{t('BIO_DATA.SELECT_LANGUAGE')}</Text>
        </Pressable>
      </View>

      {missingField && (
        <View style={s.missingBanner}>
          <CdnSvg uri={ICON_ALERT} width={20} height={20} />
          <Text style={s.missingBannerText}>{t('BIO_DATA.MISSING_DETAILS_TXT')}</Text>
          <Pressable style={s.missingBannerCta} onPress={handleAddNow}>
            <CdnSvg uri={ICON_ADD} width={14} height={14} />
            <Text style={s.missingBannerCtaText}>{t('BIO_DATA.ADD_NOW_TXT')}</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* ── Themed top + photo ──────────────────────────────────────────── */}
        <GestureDetector gesture={themeSwipeGesture}>
          <View style={[s.themedTop, currentTheme && { backgroundColor: currentTheme.bgColor }]}>
            {currentTheme?.topImg ? (
              <Image source={{ uri: currentTheme.topImg }} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" />
            ) : null}

            {themes.length > 1 && (
              <>
                <Pressable style={[s.themeArrowBtn, s.themeArrowLeft]} onPress={() => cycleTheme(-1)} hitSlop={8}>
                  <CdnSvg uri={ICON_BACK_ARROW_THEME} width={28} height={28} />
                </Pressable>
                <Pressable style={[s.themeArrowBtn, s.themeArrowRight]} onPress={() => cycleTheme(1)} hitSlop={8}>
                  <CdnSvg uri={ICON_NEXT_ARROW_THEME} width={28} height={28} />
                </Pressable>
              </>
            )}

            <View style={s.jodiiLogoWrap} pointerEvents="none">
              <CdnSvg uri={ICON_JODII_LOGO} width={80} height={24} />
            </View>

            <View style={s.topDecorWrap} pointerEvents="none">
              <CdnSvg uri={ICON_TOP_DECOR} width={SCREEN_WIDTH} height={140} />
            </View>

            <View style={[s.photoWrap, !photoUrl && s.photoWrapSquare]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={s.photo} contentFit="cover" />
              ) : (
                <View style={s.photoPlaceholder} />
              )}
              {!photoAvailable && photoCount === 0 && (
                <Pressable style={s.photoActionBtn} onPress={handleAddPhoto}>
                  <Text style={s.photoActionText}>{t('BIO_DATA.ADD_YOUR_PHOTO')}</Text>
                </Pressable>
              )}
              {photoAvailable && (
                <Pressable style={s.photoEditBtn} onPress={handleAddPhoto}>
                  <CdnSvg uri={ICON_EDIT_PHOTO} width={20} height={20} />
                </Pressable>
              )}
            </View>
          </View>
        </GestureDetector>

        {/* ── Info card ─────────────────────────────────────────────────────── */}
        <View style={[s.infoCard, currentTheme && { marginTop: themeOverlapMargin(currentTheme.value) }]}>
          <Text style={s.name}>{personal.NAME}</Text>
          <Text style={s.matriId}>ID {personal.MATRIID}</Text>

          <SectionTitle title={t('BIO_DATA.PERSONAL_DETAILS')} />
          <FieldRow
            label={t('BIO_DATA.DOB_AGE')}
            value={personal.DOB ? `${personal.DOB} & ${personal.AGE} yrs` : personal.AGE}
          />
          <FieldRow label={t('EDITPROFILE.HEIGHT')} value={personal.HEIGHT} />
          <FieldRow label={t('EDITPROFILE.MOTHERTONGUE')} value={personal.MOTHERTONGUE} />
          <FieldRow
            label={t('BIO_DATA.HOME_TOWN')}
            value={location.CITY && location.STATE ? `${location.CITY}, ${location.STATE}` : undefined}
          />
          <FieldRow label={t('EDITPROFILE.EDUCATION')} value={professional.EDUCATION} />
          {!!professional.EDUCATION && (
            <FieldRow label={t('EDITPROFILE.OCCUPATION')} value={professional.OCCUPATION} />
          )}
          {showIncomeRow && (
            <FieldRow
              label={t('EDITPROFILE.INCOME')}
              value={professional.ANNUALINCOME && professional.ANNUALINCOME !== '0' ? professional.ANNUALINCOME : undefined}
              addLabel={t('EDITPROFILE.ADDYOURINCOME')}
              onAddPress={() => navigation.navigate('EditProfileProfessional')}
            />
          )}
          <FieldRow label={t('EDITPROFILE.MARITALSTATUS')} value={personal.MARITALSTATUS} />
          {!!personal.MARITALSTATUS && (
            <FieldRow label={t('BIO_DATA.NO_OF_CHILDREN')} value={personal.NOOFCHILDREN} />
          )}
          <FieldRow label={t('EDITPROFILE.PHYSICALSTATUS')} value={personal.PHYSICALSTATUS} />
          <FieldRow
            label={t('EDITPROFILE.EATING')}
            value={habits.EATINGHABITS}
            addLabel={t('EDITPROFILE.ADDYOUREATING')}
            onAddPress={() => navigation.navigate('EditProfileLifestyle')}
          />
          <FieldRow
            label={t('BIO_DATA.DRINKING_HABITS')}
            value={habits.DRINKING}
            addLabel={t('EDITPROFILE.ADDYOURDRINKING')}
            onAddPress={() => navigation.navigate('EditProfileLifestyle')}
          />
          <FieldRow
            label={t('BIO_DATA.SMOKING_HABITS')}
            value={habits.SMOKING}
            addLabel={t('EDITPROFILE.ADDYOURSMOKING')}
            onAddPress={() => navigation.navigate('EditProfileLifestyle')}
          />

          {showReligious && (
            <>
              <SectionTitle title={t('EDITPROFILE.RELIGIOUSDETAIL')} />
              <FieldRow label={t('EDITPROFILE.RELIGION')} value={religious.RELIGION} />
              <FieldRow label={t('EDITPROFILE.CASTESUB')} value={religious.CASTE} />
              {profile.SHOWGOTHRA && (
                <FieldRow
                  label={t('EDITPROFILE.GOTHRAM')}
                  value={religious.GOTHRAM}
                  addLabel={t('BIO_DATA.ADD_GOTHRAM_DETAILS')}
                />
              )}
              <FieldRow
                label={t('EDITPROFILE.RAASI')}
                value={religious.RAASI}
                addLabel={t('BIO_DATA.ADD_RAASI_DETAILS')}
                onAddPress={() => navigation.navigate('EditProfileReligious')}
              />
              <FieldRow
                label={t('EDITPROFILE.DOSHAM')}
                value={profile.doshamText}
                addLabel={t('BIO_DATA.ADD_DOSHAM_DETAILS')}
                onAddPress={() => navigation.navigate('EditProfileReligious')}
              />
              <FieldRow
                label={t('EDITPROFILE.STAR')}
                value={religious.STAR}
                addLabel={t('BIO_DATA.ADD_STAR_DETAILS')}
                onAddPress={() => navigation.navigate('EditProfileReligious')}
              />
            </>
          )}

          <SectionTitle title={t('EDITPROFILE.FAMILYDETAILS')} />
          <FieldRow
            label={t('BIO_DATA.NO_OF_BROTHERS')}
            value={family.BROTHERS ? brothersLabel : undefined}
            addLabel={t('BIO_DATA.ADD_BROTHER_DETAILS')}
            onAddPress={() => navigation.navigate('EditProfileFamily')}
          />
          <FieldRow
            label={t('BIO_DATA.NO_OF_SISTERS')}
            value={family.SISTERS ? sistersLabel : undefined}
            addLabel={t('BIO_DATA.ADD_SISTER_DETAILS')}
            onAddPress={() => navigation.navigate('EditProfileFamily')}
          />
          <FieldRow
            label={t('BIO_DATA.PROPERTY_DETAILS')}
            value={hasPropertyDetails(family) ? propertyContentText(family) : undefined}
            addLabel={t('BIO_DATA.ADD_PROPERTY_DETAILS')}
            onAddPress={() => navigation.navigate('EditProfileProperty')}
          />

          {showReligious && (
            <>
              <SectionTitle title={t('VIEWPROFILE.HORO_DETAILS')} />
              {horo.HOROSCOPEAVAILABLE === 'Y' ? (
                <View style={s.horoRow}>
                  {!!horo.RASIGIF && (
                    <View style={s.horoCol}>
                      <Text style={s.horoLabel}>{t('BIO_DATA.RAASI_TXT')}</Text>
                      <Image source={{ uri: horo.RASIGIF }} style={s.horoImg} contentFit="contain" />
                    </View>
                  )}
                  {!!horo.NAVAMSAGIF && (
                    <View style={s.horoCol}>
                      <Text style={s.horoLabel}>{t('BIO_DATA.NAVAMSA_TXT')}</Text>
                      <Image source={{ uri: horo.NAVAMSAGIF }} style={s.horoImg} contentFit="contain" />
                    </View>
                  )}
                </View>
              ) : (
                <View style={s.horoMissingBlock}>
                  <Text style={s.horoMissingHeader}>{t('BIO_DATA.HORO_HEADER')}</Text>
                  <Text style={s.horoMissingBody}>{t('BIO_DATA.HORO_BODY')}</Text>
                  <ButtonRevamp
                    label={t('BIO_DATA.HORO_CTA')}
                    variant="primary"
                    onPress={() => stub('Add horoscope')}
                    style={{ marginTop: 12 }}
                  />
                </View>
              )}
            </>
          )}

          {!!profile.QRCODE && (
            <View style={s.qrSection}>
              <Image source={{ uri: profile.QRCODE }} style={s.qrImage} contentFit="contain" />
              <Text style={s.qrCaption}>
                {t('BIO_DATA.QR_CODE_TXT').replace('#HISHER#', t(`PRONOUN.${personal.GENDER === 'F' ? 'F' : 'M'}.hisher`))}
              </Text>
            </View>
          )}
        </View>

        <View style={s.bottomDecorWrap} pointerEvents="none">
          <CdnSvg uri={ICON_BOTTOM_DECOR} width={SCREEN_WIDTH} height={100} />
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <ButtonRevamp
          label={t('BIO_DATA.DOWNLOAD_BIODATA')}
          variant="primary"
          size="large"
          fullWidth
          loading={downloading}
          style={{ backgroundColor: Colors.primaryDark }}
          onPress={handleDownload}
        />
      </View>

      {showSwipeTip && (
        <View style={s.swipeTipOverlay}>
          <Text style={s.swipeTipTitle}>{t('BIO_DATA.SWIPE_RIGHT_TXT_1')}</Text>
          <Text style={s.swipeTipBody}>{t('BIO_DATA.SWIPE_RIGHT_TXT_2')}</Text>
          <ButtonRevamp label={t('BIO_DATA.OK_CTA')} variant="primary" fullWidth onPress={dismissSwipeTip} />
        </View>
      )}
    </View>
  )
}

// ─── Presentational helpers ─────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>
}

function FieldRow({
  label, value, addLabel, onAddPress,
}: { label: string; value?: string | undefined; addLabel?: string; onAddPress?: () => void }) {
  if (!value) {
    if (!addLabel) return null
    return (
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {onAddPress ? (
          <Pressable style={s.fieldAddLink} onPress={onAddPress}>
            <Text style={s.fieldAddLinkText}>{addLabel}</Text>
            <CdnSvg uri={ICON_CHEVRON} width={14} height={14} />
          </Pressable>
        ) : (
          <View style={s.fieldAddLink}>
            <Text style={s.fieldAddLinkText}>{addLabel}</Text>
          </View>
        )}
      </View>
    )
  }
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.white },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  errorText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: Colors.white,
  },
  langPill: {
    borderWidth: 1, borderColor: Colors.borderNeutral, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  langPillText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black },

  missingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.selectionBg, paddingHorizontal: 16, paddingVertical: 12,
  },
  missingBannerText: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#333333' },
  missingBannerCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryDark, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  missingBannerCtaText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontWeight: '500', fontSize: 10, color: Colors.white },

  themedTop: {
    width: SCREEN_WIDTH, minHeight: 260, position: 'relative', overflow: 'hidden',
    alignItems: 'center',
  },
  themeArrowBtn: {
    position: 'absolute', top: '40%', width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  themeArrowLeft: { left: 8 },
  themeArrowRight: { right: 8 },
  jodiiLogoWrap: { marginTop: 16, zIndex: 1 },
  topDecorWrap: { position: 'absolute', top: 40, left: 0 },

  photoWrap: {
    marginTop: 40, width: 140, height: 140, borderRadius: 70, overflow: 'hidden',
    backgroundColor: Colors.white, borderWidth: 4, borderColor: Colors.white,
    position: 'relative', zIndex: 1,
  },
  // Figma (15156-14543): no-photo state is a big square card (312x312 on a
  // 360-wide frame, 24px side margins), 20px corner radius — NOT the small
  // circular avatar shown once a real photo exists.
  photoWrapSquare: {
    width: SCREEN_WIDTH - 48, height: SCREEN_WIDTH - 48, borderRadius: 20,
    borderWidth: 0, backgroundColor: '#CFCFCF',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#CFCFCF' },
  photoActionBtn: {
    position: 'absolute', bottom: 8, alignSelf: 'center',
    backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  photoActionText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontWeight: '500', fontSize: 10, color: '#333333' },
  photoEditBtn: {
    position: 'absolute', bottom: 4, right: 4, backgroundColor: Colors.white,
    borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },

  infoCard: {
    backgroundColor: Colors.white, marginHorizontal: 8, borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 3,
  },
  name: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: '#333333' },
  matriId: { fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 12, color: '#333333', marginTop: 8 },

  sectionTitle: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontWeight: '500', fontSize: 14, color: '#333333', marginTop: 16, marginBottom: 8 },

  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  fieldLabel: { flex: 5, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#333333' },
  fieldValue: { flex: 7, fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 12, color: '#333333' },
  fieldAddLink: { flex: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldAddLinkText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontWeight: '500', fontSize: 12, color: '#D99C00' },

  horoRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  horoCol: { flex: 1, alignItems: 'center' },
  horoLabel: { fontFamily: Fonts.poppinsSemiBold, fontSize: 10, color: '#D8AD6E', marginBottom: 8 },
  horoImg: { width: '100%', height: 100 },
  // Figma (15156-14417): a dashed pink card, not a plain solid-red-border box.
  horoMissingBlock: {
    marginTop: 8, padding: 16, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.selectionBg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#EF4444',
  },
  horoMissingHeader: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontWeight: '500', fontSize: 16, color: '#EF4444', textAlign: 'center' },
  horoMissingBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#4C4C4C', textAlign: 'center', marginTop: 4 },

  qrSection: { alignItems: 'center', marginTop: 24, gap: 16 },
  qrImage: { width: 160, height: 160 },
  qrCaption: { fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 12, color: '#1A1818', textAlign: 'center' },

  bottomDecorWrap: { marginTop: -35, alignItems: 'center' },

  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: Colors.white },

  swipeTipOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16,
  },
  swipeTipTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.white, textAlign: 'center' },
  swipeTipBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.white, textAlign: 'center' },
})
