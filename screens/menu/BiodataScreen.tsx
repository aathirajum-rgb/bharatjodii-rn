// Angular: pages/download-biodata/download-biodata.component.html + .ts —
// a DEDICATED screen (not a mode of ViewProfileScreen), reached from Menu's
// "Download your biodata" row. Shows the logged-in user's own profile as a
// downloadable/shareable biodata, skinned by 5 swipeable color templates.

import { useCallback, useState } from 'react'
import {
  Linking, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native'
import { Image } from 'expo-image'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { CDN, CDN_REACT, CDN_LOTTIE } from '../../constants/cdn'
import { StorageKeys as SK } from '../../constants/storage.keys'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import CdnLottie from '../../components/CdnLottie'
import ButtonRevamp from '../../components/button-revamp/ButtonRevamp'
import { getItem, setItem } from '../../service/storageService'
import { handleBack as goBackCentral } from '../../utils/navigationRef'
import {
  getBiodataProfile, getFirstMissingBiodataField, showReligiousDetails, hasPropertyDetails,
  propertyContentText, resolveFamilyCountLabel, saveBiodataThemeId, getSavedBiodataThemeId,
  getBioDataDownloadLink, type BiodataProfile, type BiodataTheme,
} from '../../service/biodataService'
import { getOwnGenderAvatarUrl } from '../../utils/avatar'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'


const ICON_BACK        = CDN_REACT + '/menu_back_arrow.svg'
const ICON_CHEVRON     = CDN_REACT + '/menu_right_arrow.svg'
const ICON_ALERT       = CDN + 'assets/images/svg/activity-alert-img.svg'
const ICON_ADD         = CDN + 'assets/images/svg/app-photos-edit-profile-img.svg'
const ICON_JODII_LOGO  = CDN + 'assets/images/svg/biodata-jodii-logo.svg'
const ICON_TOP_DECOR   = CDN + 'assets/images/svg/download-biodata-top.svg'
const ICON_BOTTOM_DECOR = CDN + 'assets/images/svg/download-biodata-bottom.svg'
const ICON_EDIT_PHOTO  = CDN + 'assets/images/svg/biodata-edit-icon.svg'
// Angular .language-selection-biodata's background-image — the chevron inside
// the language pill.
const ICON_LANG_CHEVRON = CDN + 'assets/images/revamp-img/down-arrow.svg'
const ICON_BACK_ARROW_THEME = CDN + 'assets/images/svg/biodata-back-arrow.svg'
const ICON_NEXT_ARROW_THEME = CDN + 'assets/images/svg/biodata-next-arrow.svg'

// Angular's negative-margin-top-*-biodata classes are PER-TEMPLATE (-8vh /
// -8vh / -13vh / -18vh / -2vh) because each theme's TOP_IMG is a plain
// <ion-img> rendered at its own intrinsic aspect ratio — every template's
// banner is a different height, and the margin cancels that difference so the
// white block always lands in the same place.
//
// This port does NOT reproduce that: the banner is StyleSheet.absoluteFill with
// contentFit 'cover' inside a fixed-height themedTop, so the top area is the
// same height for EVERY theme. Keeping the per-theme margin therefore
// compensated for a difference that no longer exists and instead jerked the
// card 102-147px up or down as you switched templates (the swing grows with
// screen height, since it was vh-based).
//
// One constant instead: the card sits flush under the themed top, identically
// for all five themes and on every screen size.
const CARD_TOP_OVERLAP = 0

const VIEWED_SWIPE_KEY = 'VIEWEDSWIP'

// Angular: the white card lives in a `pl-8 pr-8` row inside the themed column,
// so exactly 8px of theme colour frames it on each side.
const THEME_FRAME_PAD = 8


// download-biodata-top.svg / -bottom.svg are both 344x84 — authored for exactly
// this 344pt container (a 360pt frame less 8pt each side), not as generic
// full-width strips. Each is the card's decorative END CAP: a white fill that
// meets the card body, with the ornamental corner notches on the outer side.
//
// Geometry read off the assets rather than guessed:
//  - The white FILL spans the FULL width (its left edge traces to x=0, easing
//    to x=1.54 only at the very tip). So the card body must also be full
//    FRAME_W — any inset leaves a step of theme colour at the join.
//  - Each file also has <rect x="13" width="318" stroke="#fff"/>, which LOOKS
//    like the card outline but is a white stroke over white fill: invisible.
//    Treating it as the card edge (and insetting the body 13pt to match) is
//    what left the top edge disconnected from the card beneath it.
//  - In top.svg the white fill starts at y≈47.8 of 84, so its lower ~36pt is
//    the card's top; in bottom.svg the fill ends at y≈36, so its upper ~36pt
//    is the card's bottom. Both therefore butt directly onto the body.
// Plain theme colour above the banner strip, before the card begins. A fixed
// spacing value, so it does NOT scale with width.
const BANNER_TOP_GAP = 20

type BiodataMetrics = {
  frameW: number   // themed frame's content width — the caps and card span this
  decorH: number   // cap height at that width, held to the asset's 344:84 ratio
}

// Every horizontal dimension on this screen is derived here, per render, from
// the LIVE viewport width.
//
// It used to come from a module-level `Dimensions.get('window').width`, captured
// once at import. That froze the frame at whichever width the app happened to
// start at, so the caps, the themed frame and the card all disagreed with the
// real viewport after a rotation, on a foldable, or in a resized browser — and
// the cap height had additionally been hand-pinned to literal 85/60pt, which
// only matched a ~360pt screen and clipped or floated at any other size.
function biodataMetrics(viewportWidth: number): BiodataMetrics {
  const frameW = Math.max(0, viewportWidth - THEME_FRAME_PAD * 2)
  return { frameW, decorH: Math.round(frameW * (84 / 344)) }
}

// Angular: `EDUCATION + (EDUCATIONDETAILS ? ', ' + EDUCATIONDETAILS : '')`,
// and the identical shape for OCCUPATION/OCCUPATIONDETAILS.
function joinDetail(base?: string, detail?: string): string | undefined {
  if (!base) return undefined
  return detail ? `${base}, ${detail}` : base
}

type Props = { navigation: any }

export default function BiodataScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  // Live viewport — recomputes on rotation, on a foldable unfolding, and on a
  // mobile-web resize, so the frame and both caps always match the real width.
  const { width: viewportWidth } = useWindowDimensions()
  const m = biodataMetrics(viewportWidth)

  const [profile, setProfile]     = useState<BiodataProfile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [matriId, setMatriId]     = useState('')
  const [occupationCode, setOccupationCode] = useState('')
  const [themeIndex, setThemeIndex]   = useState(0)
  const [brothersLabel, setBrothersLabel] = useState('')
  const [sistersLabel, setSistersLabel]   = useState('')
  const [showSwipeTip, setShowSwipeTip]   = useState(false)
  const [downloading, setDownloading]     = useState(false)
  // Angular: `userPhotoUrl = localStorage.getItem('PHOTOURL')` — a photo the
  // member has already uploaded but which the server hasn't approved yet, so
  // it isn't in PHOTOINFO.PHOTO. getPhotoUrl() still renders it (blurred) with
  // an "under validation" pill. This port had no such state at all.
  const [cachedPhotoUrl, setCachedPhotoUrl] = useState('')
  // Angular's getPhotoUrl() default branch is common.getAvatarImg(false) — the
  // member's OWN-gender silhouette, not a blank grey card.
  const [genderAvatarUrl, setGenderAvatarUrl] = useState('')

  // Refetches on focus (not just mount) so returning from the standalone
  // Manage Photos flow (see handleAddPhoto/handleEditPhoto below) shows the
  // photo change immediately — same pattern as EditProfileScreen.tsx.
  const load = useCallback(async () => {
    setLoading(true)
    const [id, occCode, data, savedThemeId, viewedSwipe, cachedPhoto, avatar] = await Promise.all([
      getItem(SK.Auth.USER_ID),
      getItem(SK.User.OCCUPATION),
      getBiodataProfile(),
      getSavedBiodataThemeId(),
      getItem(VIEWED_SWIPE_KEY),
      getItem(SK.User.PHOTO_URL),
      getOwnGenderAvatarUrl(),
    ])
    setMatriId(id ?? '')
    setOccupationCode(occCode ?? '0')
    setCachedPhotoUrl(cachedPhoto ?? '')
    setGenderAvatarUrl(avatar)
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
        <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
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

  // Port of Angular's getPhotoUrl(), which this screen previously collapsed
  // into "approved photo, else a blank grey card". Its real branches are:
  //   PHOTOAVAILABLE 'Y' -> the LAST entry of PHOTOINFO.PHOTO
  //   PHOTOAVAILABLE 'N' but a locally cached PHOTOURL -> that, pending review
  //   otherwise           -> common.getAvatarImg(false), the own-gender avatar
  const approvedPhoto = photoAvailable && photos.length > 0
    ? photos[photos.length - 1]?.IMAGE
    : undefined
  // Angular: the same PHOTOAVAILABLE=='N' && PHOTOCOUNT==0 && userPhotoUrl!=''
  // condition drives BOTH the blur and the "under validation" pill.
  const photoUnderValidation = !photoAvailable && photoCount === 0 && !!cachedPhotoUrl
  const photoUrl = approvedPhoto ?? (cachedPhotoUrl || genderAvatarUrl || undefined)

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CdnSvg uri={ICON_BACK} width={24} height={24} />
        </Pressable>
        {/* Angular's header row is `<ion-col size="2">` for the back arrow then
            a flex col with `justify-content-center` holding TWO separate items:
            the plain "Select language" LABEL, then (ml-8) a bordered <select>
            whose only option is the CURRENT language name.
            This port collapsed both into one right-aligned pill containing the
            label — so the language itself was never shown and the group hugged
            the right edge instead of sitting centred. */}
        <View style={s.langGroup}>
          <Text style={s.langLabel}>{t('BIO_DATA.SELECT_LANGUAGE')}</Text>
          <Pressable style={s.langPill} onPress={() => navigation.navigate('LanguageSelection')}>
            {/* Angular: {{userLanguage}} — ACCOUNT.SELECTED_LANGUAGE holds the
                native name of the active locale in every locale file
                ("English" / "தமிழ்" / "हिंदी" / ...). */}
            <Text style={s.langPillText}>{t('ACCOUNT.SELECTED_LANGUAGE')}</Text>
            <CdnSvg uri={ICON_LANG_CHEVRON} width={12} height={12} />
          </Pressable>
        </View>
        {/* Balances the back arrow's column so the group above lands optically
            centred rather than shifted right. */}
        <View style={s.headerSpacer} />
      </View>

      {/* Angular lays this out as TWO rows, not one: the alert icon and the
          message share row 1, then "Add Now" sits on row 2 indented under the
          message (offset="1" mt-6). Cramming all three onto one line squeezed
          the message into a narrow column beside the pill. */}
      {missingField && (
        <View style={s.missingBanner}>
          <View style={s.missingBannerRow}>
            <CdnSvg uri={ICON_ALERT} width={20} height={20} />
            <Text style={s.missingBannerText}>{t('BIO_DATA.MISSING_DETAILS_TXT')}</Text>
          </View>
          <Pressable style={s.missingBannerCta} onPress={handleAddNow}>
            <CdnSvg uri={ICON_ADD} width={16} height={16} />
            <Text style={s.missingBannerCtaText}>{t('BIO_DATA.ADD_NOW_TXT')}</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Angular's outer themed column:
              <ion-col [ngStyle]="{'background-color': theme?.BGCOLOR}">
            wraps the top image, the white card AND the bottom decoration — the
            theme colour (#011443 navy / #EED872 / #014836 / #8C0133 / #DD6F11)
            is meant to show as an 8px frame down both sides of the card and
            behind the decorative top/bottom edges.
            This port applied bgColor only to the top strip, so the card sat on
            plain white: no visible theme, no card edge, and the white bottom
            decoration was invisible white-on-white. */}
        <View style={[s.themedFrame, { width: viewportWidth }, currentTheme && { backgroundColor: currentTheme.bgColor }]}>
        {/* ── Themed top + photo ──────────────────────────────────────────── */}
        <GestureDetector gesture={themeSwipeGesture}>
          <View style={[s.themedTop, { width: viewportWidth, marginHorizontal: -THEME_FRAME_PAD, height: m.decorH }]}>
            {currentTheme?.topImg ? (
              <Image source={{ uri: currentTheme.topImg }} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" />
            ) : null}

            {/* The decorative top edge sits ON the banner strip, not floating
                below it — its transparent regions are what let the theme
                pattern show through around the card's rounded corners. */}
            <View style={s.topDecorWrap} pointerEvents="none">
              <CdnSvg uri={ICON_TOP_DECOR} width={m.frameW} height={m.decorH} />
            </View>

            <View style={s.jodiiLogoWrap} pointerEvents="none">
              <CdnSvg uri={ICON_JODII_LOGO} width={80} height={24} />
            </View>
          </View>
        </GestureDetector>

        {/* ── Info card ─────────────────────────────────────────────────────── */}
        <View style={s.infoCard}>
          {/* Angular puts the photo INSIDE the white card
              (<ion-col class="white-background pl-12 pr-12"> → .download-
              biodata-profile-image), as the card's first child — so it is inset
              by the card's own 12px padding and wrapped in a 2px #fcd34d gold
              frame. This port had it up in the banner area instead, which is why
              it ran full-bleed, showed no gold border, and had its bottom edge
              (and the "Add your photo" pill) cut off by the card below it. */}
          <View style={s.photoFrame}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={s.photo}
                // Angular .profile-image-download-biodata-fit is object-fit:
                // contain for BOTH states, so a real photo is never cropped.
                contentFit="contain"
                // Angular .biodata-profile-blur: filter: blur(20px), on the same
                // "uploaded but not yet approved" condition.
                blurRadius={photoUnderValidation ? 20 : 0}
              />
            ) : (
              <View style={s.photoPlaceholder} />
            )}
            {/* Angular shows exactly ONE of these two pills: "Add your photo"
                when there's nothing uploaded at all, "under validation" when
                something was uploaded but hasn't been approved. The second
                state was missing from this port entirely. */}
            {!photoAvailable && photoCount === 0 && !cachedPhotoUrl && (
              <Pressable style={s.photoActionBtn} onPress={handleAddPhoto}>
                <Text style={s.photoActionText}>{t('BIO_DATA.ADD_YOUR_PHOTO')}</Text>
              </Pressable>
            )}
            {photoUnderValidation && (
              <View style={s.photoActionBtn}>
                <Text style={s.photoActionText}>{t('BIO_DATA.UNDER_VALIDATION_TXT')}</Text>
              </View>
            )}
            {photoAvailable && (
              <Pressable style={s.photoEditBtn} onPress={handleAddPhoto}>
                <CdnSvg uri={ICON_EDIT_PHOTO} width={20} height={20} />
              </Pressable>
            )}
          </View>

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
          {/* Angular appends the free-text sub-value to each, e.g.
              "Bachelor's Degree, B.Sc Computer Science" — this port was
              dropping EDUCATIONDETAILS/OCCUPATIONDETAILS entirely. */}
          <FieldRow label={t('EDITPROFILE.EDUCATION')} value={joinDetail(professional.EDUCATION, professional.EDUCATIONDETAILS)} />
          {!!professional.EDUCATION && (
            <FieldRow label={t('EDITPROFILE.OCCUPATION')} value={joinDetail(professional.OCCUPATION, professional.OCCUPATIONDETAILS)} />
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
          {/* Angular offers an "Add Physical status" link here (edit page 40).
              Without an addLabel this row silently vanished when unset. */}
          <FieldRow
            label={t('EDITPROFILE.PHYSICALSTATUS')}
            value={personal.PHYSICALSTATUS}
            addLabel={t('BIO_DATA.ADD_PHYSICAL_STATUS')}
            onAddPress={() => navigation.navigate('EditProfileMarital')}
          />
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
                  // Angular navigates to edit page 16 here; without onAddPress
                  // this rendered as dead, un-tappable text unlike every
                  // sibling "Add ..." link in the section.
                  onAddPress={() => navigation.navigate('EditProfileReligious')}
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
                  {/* Angular: goToEditScreen('22','add') — the add-horoscope
                      form. This was a "Coming soon" stub even though the
                      route exists and EditProfileScreen already links to it. */}
                  <ButtonRevamp
                    label={t('BIO_DATA.HORO_CTA')}
                    variant="primary"
                    onPress={() => navigation.navigate('EditProfileHoroscope')}
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

        {/* Angular: the bottom decoration sits INSIDE the themed frame with
            margin-top:-35px — it IS the white card's bottom edge (its corner
            cut-outs are transparent, which is how the theme colour shows
            through), not an overlay floating on the page. */}
        <View style={[s.bottomDecorWrap, { width: m.frameW, height: m.decorH }]} pointerEvents="none">
          <CdnSvg uri={ICON_BOTTOM_DECOR} width={m.frameW} height={m.decorH} />
        </View>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {/* Angular's CTA carries a download glyph before the label
            (download-biodata-white.svg); this port had label-only. */}
        <ButtonRevamp
          label={t('BIO_DATA.DOWNLOAD_BIODATA')}
          variant="primary"
          size="large"
          fullWidth
          icon="download-biodata-white"
          loading={downloading}
          style={{ backgroundColor: Colors.primaryDark }}
          onPress={handleDownload}
        />
      </View>

      {/* Angular .biodata-back-arrow-img / .biodata-next-arrow-img:
            position: fixed; top: 50%; left|right: 0; z-index: 9999
          — pinned to the VIEWPORT, so they stay reachable at mid-screen however
          far the biodata is scrolled. Nesting them inside the top image (as
          this port did) meant they scrolled away with it and were unreachable
          for most of the page. */}
      {themes.length > 1 && (
        <>
          <Pressable style={[s.themeArrowBtn, s.themeArrowLeft]} onPress={() => cycleTheme(-1)} hitSlop={12}>
            <CdnSvg uri={ICON_BACK_ARROW_THEME} width={28} height={28} />
          </Pressable>
          <Pressable style={[s.themeArrowBtn, s.themeArrowRight]} onPress={() => cycleTheme(1)} hitSlop={12}>
            <CdnSvg uri={ICON_NEXT_ARROW_THEME} width={28} height={28} />
          </Pressable>
        </>
      )}

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

  // Angular: pt-16/pb-16 on the row rather than a fixed height, and no
  // space-between — the arrow is its own column and the language group is
  // centred in what remains (langGroup's flex: 1 + headerSpacer do that).
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, backgroundColor: Colors.white,
  },
  // Matches the back arrow's width so the centred group isn't biased right.
  headerSpacer: { width: 24 },
  langGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  langLabel: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.black },
  // Angular .language-selection-biodata: border 1px solid #333333, radius 8,
  // padding 4px 24px 4px 8px, white bg, 12px chevron at right 8px. That 24px
  // right padding exists to clear the chevron, so it becomes a gap here.
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#333333', borderRadius: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  langPillText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.black },

  missingBanner: {
    backgroundColor: Colors.selectionBg, paddingHorizontal: 16, paddingVertical: 12,
  },
  missingBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  missingBannerText: { flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#333333' },
  // alignSelf so the pill hugs its content instead of stretching the banner
  // width; marginLeft aligns it under the message, past the alert icon
  // (Angular's offset="1"). marginTop is its mt-6.
  missingBannerCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12,
    backgroundColor: Colors.primaryDark, borderRadius: 8, height: 40,
  },
  missingBannerCtaText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontWeight: '500', fontSize: 14, color: Colors.white },

  // Angular's outer themed <ion-col> — carries theme.BGCOLOR behind the top
  // image, the white card and the bottom decoration alike.
  // width comes from the live viewport at the usage site — see biodataMetrics().
  themedFrame: { paddingHorizontal: THEME_FRAME_PAD },
  themedTop: {
    // width / marginHorizontal / height are supplied per render: the strip
    // bleeds back out over the frame's 8pt padding (Angular's top image is a
    // direct child of the themed column, outside the pl-8/pr-8 row) and is
    // exactly as tall as the cap sitting on it. A literal 85 only matched a
    // ~360pt screen — it is derived from the live width now.
    position: 'relative', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'flex-end', marginTop: BANNER_TOP_GAP
  },
  // Screen-level overlay (see the render comment) — top 50%, flush to each
  // edge, above the scroll content.
  themeArrowBtn: {
    position: 'absolute', top: '50%', width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  themeArrowLeft: { left: 0 },
  themeArrowRight: { right: 0 },
  // The cap fills the banner strip exactly (both are DECOR_H tall) and its
  // bottom edge is therefore flush with the card's top edge. `top: 40` left it
  // hanging 40pt down inside an 84pt overflow:hidden box, so its lower half —
  // the part that is the card's white top — was clipped away, which is what
  // made the edge look detached from the card below.
  topDecorWrap: { position: 'absolute', top: 0, left: 8, zIndex: 1 },
  // Angular .biodata-jodii-logo: position absolute, top 25%. Sits above the cap.
  jodiiLogoWrap: { position: 'absolute', top: '25%', zIndex: 2 },

  // Angular .download-biodata-profile-image:
  //   height: 45vh; border: 2px solid #fcd34d; border-radius: 6px;
  //   overflow: hidden; object-fit: contain
  // It is the SAME frame in every state — Angular has no circular-avatar
  // variant at all. The previous 140px white-ringed circle (with a separate
  // full-bleed grey square for the empty state) came from Figma node
  // 15156-14543, which disagrees with the shipped Angular UI; Angular is the
  // reference for this screen, so the two states are unified here.
  //
  // Square rather than 45vh: a viewport-height-derived box changes shape per
  // device, and the reference screenshot is square. Width is inherited from the
  // card (stretch), so the 12px card padding provides the inset either side.
  photoFrame: {
    width: '100%', aspectRatio: 1, overflow: 'hidden',
    borderWidth: 2, borderColor: '#FCD34D', borderRadius: 6,
    backgroundColor: '#E6E6E6',
    position: 'relative',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#CFCFCF' },
  photoActionBtn: {
    position: 'absolute', bottom: 8, alignSelf: 'center',
    backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  photoActionText: { fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontWeight: '500', fontSize: 10, color: '#333333' },
  // Angular .biodata-profile-image-edit: `right: 10px; top: 10px;
  // background-color: #745430; border-radius: 50%; opacity: 0.8` — a
  // translucent brown disc in the TOP-right corner. This port had a white disc
  // bottom-right.
  photoEditBtn: {
    position: 'absolute', top: 10, right: 10, backgroundColor: '#745430', opacity: 0.8,
    borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },

  infoCard: {
    // Angular: .white-background with pl-12/pr-12 inside the themed pl-8/pr-8
    // row — so no marginHorizontal of its own any more, the themed frame
    // provides the 8px inset. No shadow either: the theme colour beside the
    // card is what separates it, not a drop shadow.
    backgroundColor: Colors.white,
    marginTop: CARD_TOP_OVERLAP,
    // Breathing room between the card's decorative top edge and the photo
    // frame. Angular's white column is itself pt-0 — all of its clearance
    // comes from the ~36pt white portion at the foot of the top cap — but with
    // the cap scaled to this frame that alone reads as a tight seam, so the
    // card contributes the rest. This is the single knob for that gap.
    paddingHorizontal: 12, paddingTop: 0,
    paddingBottom: 24,
  },
  // Angular: <ion-col class="padd0 mt-24"> around the name label — a 24pt gap
  // between the photo frame and the name, which this port had at 0 so the name
  // sat directly against the frame's bottom border.
  name: { fontFamily: Fonts.poppinsSemiBold, fontSize: 16, color: '#333333', marginTop: 24 },
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
  // Angular .biodata-horoscope-block (+ .biodata-horoscope-block-border, which
  // is applied only when HOROSCOPEAVAILABLE=='N', i.e. exactly this block):
  //   background-color: #fffcf4; border-radius: 8px; padding-bottom: 16px;
  //   border: 1px dashed #ffe17e;
  // This port had a pink card with a hard red dashed border — the Figma node it
  // cites disagrees with the shipped Angular styling, and Angular is the
  // reference here.
  horoMissingBlock: {
    marginTop: 8, padding: 16, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#FFFCF4', borderWidth: 1, borderStyle: 'dashed', borderColor: '#FFE17E',
  },
  horoMissingHeader: { fontFamily: SemanticFontsEnglish.headingEnglishMedium, fontWeight: '500', fontSize: 16, color: '#EF4444', textAlign: 'center' },
  horoMissingBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: '#4C4C4C', textAlign: 'center', marginTop: 4 },

  // Angular .biodata-barcode-section: `border-top: 1px solid #a9907e;
  // margin-top: 24px` — a hairline rule separating the QR block from the
  // details above it. Missing entirely from this port.
  qrSection: {
    alignItems: 'center', marginTop: 24, paddingTop: 16, gap: 16,
    borderTopWidth: 1, borderTopColor: '#A9907E',
  },
  // Angular .biodata-barcode: 10vh square with `border: 1px solid #e6ca64;
  // border-radius: 8px; overflow: hidden`. The gold border was missing — this
  // is the "border is not shown" case.
  qrImage: {
    width: 160, height: 160,
    borderWidth: 1, borderColor: '#E6CA64', borderRadius: 8,
  },
  qrCaption: { fontFamily: Fonts.poppinsMedium, fontWeight: '500', fontSize: 12, color: '#1A1818', textAlign: 'center' },

  // Butts straight onto the card — no overlap. The -35 that used to be here was
  // sized for the old (wrongly 100pt-tall) slab and painted over the QR caption,
  // the last element in the card.
  // width / height come from the live viewport at the usage site. The literal
  // 60 clipped the cap's upper region — which is the part that joins the card —
  // and the SCREEN_WIDTH + marginHorizontal: -10 pair pushed the container 2pt
  // past both screen edges while the SVG inside it stayed at frame width.
  // Sized to the cap's own proportion instead, so it lines up at any width.
  bottomDecorWrap: {
    alignItems: 'center', justifyContent: 'flex-start',
    marginTop: -1, position: 'relative', overflow: 'hidden',
  },

  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: Colors.white },

  swipeTipOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16,
  },
  swipeTipTitle: { fontFamily: Fonts.poppinsSemiBold, fontSize: 20, color: Colors.white, textAlign: 'center' },
  swipeTipBody: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.white, textAlign: 'center' },
})
