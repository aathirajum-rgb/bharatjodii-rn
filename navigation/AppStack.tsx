import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import AppHeader from '../components/app-header/AppHeader'
import ButtonRevamp from '../components/button-revamp/ButtonRevamp'
import CdnSvg from '../components/cdn-svg/CdnSvg'
import { Colors } from '../constants/colors'
import { CDN_SVG } from '../constants/cdn'
import { StorageKeys } from '../constants/storage.keys'
import { OnboardingCtx, FooterState, FooterHandlers } from '../contexts/OnboardingContext'
import { getItem, setItem } from '../service/storageService'
import { getOnboardingBackPage } from '../screens/onboarding/onboardingBackFlow'
import { handleBack as centralizedHandleBack } from '../utils/navigationRef'
import { useAuth } from '../contexts/AuthContext'
import { useIsDesktopWeb } from '../hooks/useIsDesktopWeb'
import { useLanguageFonts } from '../hooks/useLanguageFonts'

// Angular's LINK_BTN (button.config.ts) plays a looping Lottie
// (forward-animation-link, right-arrow-animation.json/.gif) next to the link
// text. Same static-icon + looping-translateX-bounce substitute already used
// by DOBScreen.tsx's "Please enter age" link, reused here for every screen's
// footer link button instead of pulling in a GIF/Lottie player dependency.
const CDN_FORWARD_ICON = CDN_SVG + 'revamp/forward-icon-link.svg'
import ComponentShowcaseScreen    from '../screens/dev/ComponentShowcaseScreen'
import HomeScreen                  from '../screens/home/HomeScreen'
import GalleryScreen               from '../screens/GalleryScreen'
import CreatedByScreen             from '../screens/onboarding/CreatedByScreen'
import NameScreen                  from '../screens/onboarding/NameScreen'
import GenderScreen                from '../screens/onboarding/GenderScreen'
import MaritalStatusScreen         from '../screens/onboarding/MaritalStatusScreen'
import DOBScreen                   from '../screens/onboarding/DOBScreen'
import HeightScreen                from '../screens/onboarding/HeightScreen'
import EatingHabitScreen           from '../screens/onboarding/EatingHabitScreen'
import MotherTongueScreen          from '../screens/onboarding/MotherTongueScreen'
import LocationScreen              from '../screens/onboarding/LocationScreen'
import HomeTownLocationScreen      from '../screens/onboarding/HomeTownLocationScreen'
import HomeTownScreen              from '../screens/onboarding/HomeTownScreen'
import QualificationScreen         from '../screens/onboarding/QualificationScreen'
import OccupationScreen            from '../screens/onboarding/OccupationScreen'
import MonthlyIncomeScreen         from '../screens/onboarding/MonthlyIncomeScreen'
import ReligionScreen              from '../screens/onboarding/ReligionScreen'
import CasteScreen                 from '../screens/onboarding/CasteScreen'
import GothraScreen                from '../screens/onboarding/GothraScreen'
import AddPhotoScreen              from '../screens/onboarding/AddPhotoScreen'
import EducationDetailScreen       from '../screens/onboarding/EducationDetailScreen'
import OccupationDetailScreen      from '../screens/onboarding/OccupationDetailScreen'
import CustomGalleryScreen         from '../screens/onboarding/CustomGalleryScreen'
import ManagePhotosScreen          from '../screens/onboarding/ManagePhotosScreen'
import FamilyDetailsScreen         from '../screens/onboarding/FamilyDetailsScreen'
import PropertyDetailsScreen       from '../screens/onboarding/PropertyDetailsScreen'
import GenerateHoroscopeScreen     from '../screens/onboarding/GenerateHoroscopeScreen'
import HoroscopeBirthDetailsScreen from '../screens/onboarding/HoroscopeBirthDetailsScreen'
import HoroscopeTimeScreen         from '../screens/onboarding/HoroscopeTimeScreen'
import StarRaasiScreen             from '../screens/onboarding/StarRaasiScreen'
import DoshamScreen                from '../screens/onboarding/DoshamScreen'
import PersonalReligiousDesktopStep    from '../screens/onboarding/PersonalReligiousDesktopStep'
import EducationLocationDesktopStep    from '../screens/onboarding/EducationLocationDesktopStep'
import PhotoUploadDesktopStep          from '../screens/onboarding/PhotoUploadDesktopStep'
import OtherDetailsDesktopStep         from '../screens/onboarding/OtherDetailsDesktopStep'
import PaymentSuccessScreen        from '../screens/payment/PaymentSuccessScreen'
import PaymentFailedScreen         from '../screens/payment/PaymentFailedScreen'
import DoorstepCollectionScreen    from '../screens/payment/DoorstepCollectionScreen'
import RenewalScreen               from '../screens/payment/RenewalScreen'
import PaymentOptionsScreen        from '../screens/payment/PaymentOptionsScreen'
import CardPaymentScreen           from '../screens/payment/CardPaymentScreen'
import UpiAddressScreen            from '../screens/payment/UpiAddressScreen'
import NetBankingScreen            from '../screens/payment/NetBankingScreen'
import HostedCheckoutWebViewScreen from '../screens/payment/HostedCheckoutWebViewScreen'
import MorePaymentOptionsScreen    from '../screens/payment/MorePaymentOptionsScreen'
import NeftRtgsScreen               from '../screens/payment/NeftRtgsScreen'
import PayAtStoreScreen             from '../screens/payment/PayAtStoreScreen'
import BookAppointmentScreen        from '../screens/payment/BookAppointmentScreen'
import RechargeScreen              from '../screens/payment/RechargeScreen'
import type { SelectedPackage }    from '../service/paymentService'
import PermissionDemoScreen        from '../screens/PermissionDemoScreen'
import MatchesScreen               from '../screens/matches/MatchesScreen'
import DailyRecommendationScreen   from '../screens/daily-recommendation/DailyRecommendationScreen'
import ViewProfileScreen           from '../screens/viewprofile/ViewProfileScreen'
import BlockerScreen               from '../screens/verify/BlockerScreen'
import VerifyIdScreen               from '../screens/verify/VerifyIdScreen'
import SelfieVerificationScreen     from '../screens/verify/SelfieVerificationScreen'
import PhotoMismatchSelfieScreen    from '../screens/verify/PhotoMismatchSelfieScreen'
import MenuContactsScreen           from '../screens/menu-contacts/MenuContactsScreen'
import ValidationScreen            from '../screens/validation/ValidationScreen'
import DiscoverMatchesScreen       from '../screens/discover-matches/DiscoverMatchesScreen'
import AddPhotoIntermediateScreen  from '../screens/addphoto-intermediate/AddPhotoIntermediateScreen'
import StarMatchingScreen          from '../screens/star-matching/StarMatchingScreen'
import ActivityScreen               from '../screens/activity/ActivityScreen'
import MessagerListScreen           from '../screens/messagerList/MessagerListScreen'
import ChatScreen                   from '../screens/chat/ChatScreen'
import SafetyTipsScreen             from '../screens/safety-tips/SafetyTipsScreen'
import LanguageSelectionScreen     from '../screens/LanguageSelectionScreen'
import MenuScreen                  from '../screens/menu/MenuScreen'
import BiodataScreen                from '../screens/menu/BiodataScreen'
import SettingsScreen               from '../screens/settings/SettingsScreen'
import PhonePrivacyScreen           from '../screens/settings/PhonePrivacyScreen'
import DeleteProfileScreen             from '../screens/delete-profile/DeleteProfileScreen'
import DeleteProfileMrgReasonScreen    from '../screens/delete-profile/DeleteProfileMrgReasonScreen'
import DeleteProfileHideScreen         from '../screens/delete-profile/DeleteProfileHideScreen'
import DeleteProfileShareDetailsScreen  from '../screens/delete-profile/DeleteProfileShareDetailsScreen'
import DeleteProfileWebsiteNameScreen   from '../screens/delete-profile/DeleteProfileWebsiteNameScreen'
import DeleteProfileUploadPhotoScreen       from '../screens/delete-profile/DeleteProfileUploadPhotoScreen'
import DeleteProfileUnsatisfactoryScreen   from '../screens/delete-profile/DeleteProfileUnsatisfactoryScreen'
import DeleteProfileSuccessScreen          from '../screens/delete-profile/DeleteProfileSuccessScreen'
import SuccessStoriesScreen               from '../screens/success-stories/SuccessStoriesScreen'
import HelpCenterScreen                   from '../screens/help-center/HelpCenterScreen'
import SearchScreen                       from '../screens/search/SearchScreen'
import FaqScreen                          from '../screens/help-center/FaqScreen'
import IgnoredProfilesScreen               from '../screens/ignored-profiles/IgnoredProfilesScreen'
import ViewLaterScreen                     from '../screens/view-later/ViewLaterScreen'
import SearchByIdScreen                    from '../screens/search-by-id/SearchByIdScreen'
import NotificationScreen                  from '../screens/notification/NotificationScreen'
import EditProfileScreen                   from '../screens/edit-profile/EditProfileScreen'
import ReligiousDetailsScreen               from '../screens/edit-profile/ReligiousDetailsScreen'
import ProfessionalDetailsScreen            from '../screens/edit-profile/ProfessionalDetailsScreen'
import BasicDetailsScreen                   from '../screens/edit-profile/BasicDetailsScreen'
import LifestyleDetailsScreen               from '../screens/edit-profile/LifestyleDetailsScreen'
import FamilyDetailsEditScreen               from '../screens/edit-profile/FamilyDetailsScreen'
import PropertyDetailsEditScreen             from '../screens/edit-profile/PropertyDetailsScreen'
import EditProfileAgeHeightScreen           from '../screens/edit-profile/EditProfileAgeHeightScreen'
import EditProfileMaritalScreen             from '../screens/edit-profile/EditProfileMaritalScreen'
import AddHoroscopeScreen                   from '../screens/edit-profile/AddHoroscopeScreen'
import ExternalPageScreen                  from '../screens/external-page/ExternalPageScreen'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppStackParamList = {
  Home:              undefined
  // exploreType/exploreLabel — Angular: matches.page.ts explorePage branch (FILTERTYPE
  // scoped listing, e.g. tapping a Home "Explore matches based on" category tile)
  Matches:           { exploreType?: string; exploreLabel?: string; searchParams?: string } | undefined
  dashboard:         undefined
  // standalone — set when entering page 21 (ManagePhotosScreen) from outside the
  // onboarding wizard (e.g. Help Center's "Add Photo" quick link); its Confirm
  // button goes back to the caller instead of continuing to page 27.
  onboarding:        { pageNo: string; standalone?: boolean } | undefined
  Permissions:       undefined
  Gallery:           undefined
  recharge:          { from?: string; paymentId?: string; type?: string; fromTab?: boolean } | undefined
  renewal:           { from?: string; paymentId?: string; type?: string } | undefined
  'payment-success': undefined
  'payment-failed': {
    selectedPackage?: SelectedPackage
    amountLabel?:     string
    status:           'failure' | 'pending'
    reason?:          string
    orderId?:         string
    retryRoute:       string
    retryParams?:     any
  }
  ComponentShowcase: undefined
  // Angular: languageChangeService.languageChange() opens the language screen as a
  // modal ON TOP of the current page (Matches, onboarding, etc.) — never a full-screen
  // push. AuthStack's own LanguageSelection route (pre-login, full-screen) is separate.
  LanguageSelection: undefined
  // Angular: activity.component reads BOTH the :module route param and the
  // router state ({ activityType, selectedSubTab }) — Home's "see all" links for
  // "Profiles who viewed you" / "Profiles you viewed" / "Liked profiles" open
  // this screen already switched to that list (app-swiper's onClickSeeAllCTA).
  Activity:          { activityType?: 'likedyou' | 'likesent' | 'viewedyou' | 'viewedbyme'; selectedSubTab?: 'viewedbyme' | 'viewinglater' } | undefined
  MessagerList:      undefined
  // partnerOnline/partnerLastActive are an immediate-render seed only — ChatScreen.tsx
  // re-confirms both via its own BasicView/RESPBASIC round-trip on mount, matching
  // Angular's own reliance on that socket call over trusting the caller's handoff.
  'chat-window': {
    partnerId:          string
    partnerName?:       string
    partnerPhoto?:      string
    partnerOnline?:     boolean
    partnerLastActive?: number
  }
  Menu:              undefined
  Biodata:           undefined
  Settings:          undefined
  PhonePrivacy:      undefined
  DeleteProfile:         undefined
  DeleteProfileMrgReason:    { reason: string; reasonName?: string }
  DeleteProfileHide:              { reasonName: string }
  DeleteProfileUnsatisfactory:    { reasonName: string }
  DeleteProfileWebsiteName:       { mrgReasonName: string }
  DeleteProfileShareDetails: { reason: string; mrgReason: string; reasonName?: string; mrgReasonName?: string }
  DeleteProfileUploadPhoto: {
    partnerName:     string
    dateFixType:     string
    mrgDate:         string
    mrgInMonthsName: string
    reasonName:      string
    mrgReasonName:   string
  }
  DeleteProfileSuccess: {
    successMsgImage: string
    successMsg:      string
  }
  SuccessStories: undefined
  HelpCenter: undefined
  Search: undefined
  Faq: { type: 'PROFILE' | 'CONTACTMATCHES' | 'PAYMENT'; itemId?: number }
  IgnoredProfiles: undefined
  ViewLater: undefined
  SearchById: undefined
  EditProfile: undefined
  EditProfileReligious: undefined
  EditProfileProfessional: undefined
  EditProfileBasic: undefined
  EditProfileLifestyle: undefined
  EditProfileFamily: undefined
  EditProfileProperty: undefined
  EditProfileAgeHeight: undefined
  EditProfileMarital: undefined
  EditProfileHoroscope: undefined
  'payment-options': { selectedPackage?: SelectedPackage; amountLabel?: string; preselectedMethod?: string } | undefined
  'card-payment': { selectedPackage?: SelectedPackage; amountLabel?: string } | undefined
  'upi-address':  { selectedPackage?: SelectedPackage; amountLabel?: string } | undefined
  'net-banking':  { selectedPackage?: SelectedPackage; amountLabel?: string } | undefined
  'hosted-checkout': {
    selectedPackage: SelectedPackage
    amountLabel?:    string
    method:          'netbanking' | 'card' | 'upi'
    bank?:           string
    card?:           { number: string; expiryMonth: string; expiryYear: string; cvv: string }
    amount:          number
    retryRoute:      string
    retryParams?:    any
  }
  'more-payment-options': { selectedPackage?: SelectedPackage; amountLabel?: string } | undefined
  'neft-rtgs':  { selectedPackage?: SelectedPackage; amountLabel?: string } | undefined
  'pay-at-store': { selectedPackage?: SelectedPackage; amountLabel?: string } | undefined
  'book-appointment': {
    selectedPackage?: SelectedPackage; amountLabel?: string; branch: string; address: string
  } | undefined
  'doorstep-collection': { selectedPackage?: SelectedPackage; amountLabel?: string } | undefined
  ExternalPage: { url: string; title: string }
  // Angular: viewprofile.page.ts route params (:module/:id) — fromPage drives the
  // "from" context communicationBtnOnClick needs for its paywall/report-popup logic.
  viewProfile: { matriId: string; fromPage: string; showRating?: boolean; profileIds?: string[] } | undefined
  // Angular: drService.ts's loadDrProfiles() → router.navigate(['dailyrecommendations'],
  // { queryParams: { frm_page } }) — frm_page drives DailyRecommendationScreen's
  // own end-of-list auto-navigate destination (navigatteToPaywall()).
  'daily-recommendations': { frm_page?: string } | undefined
  // Angular: pages/addphoto-intermediate/:page — webview.page.ts's page_id "23"
  // (CONGRATS) plus drService.ts's handleAfterDr() cases 27/59/60 (ADDPHOTO/
  // ADDPHOTOPUBLISH).
  'addphoto-intermediate': { page?: string } | undefined
  // Angular: pages/blockerpage — webview.page.ts's page_id "51" (fraud blocker)
  BlockerPage: undefined
  // Angular: components/validation — webview.page.ts's page_id "61" (AI profile
  // validation confirm2 screen)
  // mode/violationFields are set when entered straight from the registration
  // insert response (Angular: callInsertApiAndHandleValidation); absent when
  // reached via the case-61 deep link, which reads stored VIOLATIONFIELDS.
  Validation: { mode?: 'confirm' | 'underReview'; violationFields?: string[] } | undefined
  // Angular: pages/verify-id — STUB (see screens/verify/VerifyIdScreen.tsx),
  // real govt-ID verification flow not ported yet.
  'verify-id': undefined
  // Angular: pages/selfie-verification (see screens/verify/SelfieVerificationScreen.tsx)
  // — reached from BlockerScreen.tsx's selfie row.
  'selfie-verification': undefined
  // AI photo validation's selfie-verification sub-flow (see
  // screens/verify/PhotoMismatchSelfieScreen.tsx) — reached when
  // pollPhotoValidation() returns isSelfieRequired after an onboarding photo
  // upload (suspected AI-generated/celebrity photo). Distinct from
  // 'selfie-verification' above, which is the unrelated EKYC flow.
  'photo-mismatch-selfie': { onDonePageNo?: string; standalone?: boolean } | undefined
  // Angular: '/my-membership' route → pages/menu-contacts (see
  // screens/menu-contacts/MenuContactsScreen.tsx + MenuContactsDesktopLayout.tsx).
  'my-membership': undefined
  // Angular: pages/notification — the in-app notification list (not push).
  Notification: undefined
  // Angular: pages/discover-matches — webview.page.ts's page_id "55"
  DiscoverMatches: undefined
  // Angular: redirectiontoStarMatchReport() passes the already-fetched result via
  // router state to skip a redundant API call — same idea here via route params.
  // `data` is the raw starmatch API REPONSE (COMPATIBILITY/SUMMARY/USERPROFILE/
  // PARTNERPROFILE/TYPE/PREDICTION) as a JSON STRING, not the object itself —
  // React Navigation's web linking naively stringifies an object param into the
  // URL as literal "[object Object]" (confirmed live); StarMatchingScreen
  // JSON.parses this back before deriving anything, same data Angular's own
  // setStarMatchingDetails() works from.
  'star-matching': {
    data: string
    ownName: string; ownPhoto?: string | undefined
    partnerName?: string; partnerPhoto?: string
  } | undefined
}

// ─── Onboarding shell ─────────────────────────────────────────────────────────
// AppHeader and footer stay mounted across all onboarding screens.
// Only the content area re-renders on pageNo change.

// Desktop-web pageNo keys — a SEPARATE step sequence from mobile's numeric
// pageNo switch below, since desktop combines multiple mobile fields into
// one card per step (see PersonalReligiousDesktopStep.tsx's header comment).
// Presentational-only split, same pattern as MatchesDesktopLayout.tsx /
// ViewProfileDesktopLayout.tsx — this router still owns navigation, each
// desktop step screen owns its own data/save logic directly (no shared
// footer chrome, unlike the mobile OnboardingCtx footer below).
const DESKTOP_PAGE_NOS = new Set([
  'desktop-personal-religious', 'desktop-education-location',
  'desktop-photo-upload', 'desktop-other-details',
])

function OnboardingRouter({ navigation, route }: { navigation: any; route: any }) {
  const pageNo = route.params?.pageNo ?? '1'
  const isDesktop = useIsDesktopWeb()
  const insets = useSafeAreaInsets()
  // Footer CTA copy is owned by the shell, not the screens — screens only pass a
  // nextLabel when they need a non-default word. useTranslation() re-renders this
  // component on a language change, so the default labels below switch live.
  const { t } = useTranslation()
  const langFonts = useLanguageFonts()

  // Hooks below must run unconditionally on every render (React's rules of
  // hooks) — isDesktop can flip mid-session on an actual browser resize, not
  // just at mount, so an early return here before these hooks would throw
  // "Rendered fewer hooks than expected" the moment a user resizes the
  // window. The isDesktop branch below only affects what JSX is returned.
  const [footerState, setFooterStateRaw] = useState<FooterState>({
    nextDisabled: true,
    nextLoading:  false,
    nextHidden:   false,
    showSkip:     false,
  })
  const [customerCare, setCustomerCare] = useState('')
  const handlers = useRef<FooterHandlers>({ onNext: () => {} })

  // Angular: LINK_BTN's forward-animation-link — a looping nudge-forward
  // bounce on the link CTA's arrow icon (e.g. page 29's "Upload horoscope").
  const linkArrowAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(linkArrowAnim, { toValue: 4, duration: 450, useNativeDriver: true }),
        Animated.timing(linkArrowAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [linkArrowAnim])

  // Load customer care number once at mount
  useEffect(() => {
    getItem(StorageKeys.App.CUSTOMER_CARE).then(cc => { if (cc) setCustomerCare(cc) })
  }, [])

  // Reset only the handler ref when the page changes — each screen sets its
  // own visual footer state via useOnboardingFooter on mount.
  useEffect(() => {
    handlers.current = { onNext: () => {} }
  }, [pageNo])

  // Angular: dozens of screens scattered across registration.page.ts/
  // registration-revamp.component.ts/form-fields.component.ts each call
  // setStorageValue('REGISTERURL', nextPage) at their own step transition, so
  // that pageLandingService.ts's case "1" (goToRegistrationPage) can resume an
  // abandoned registration at the right step on the next autologin. Since RN's
  // whole wizard is this one parameterized route, one central write here
  // covers every step instead of touching each screen file. Cleared on actual
  // completion in HomeScreen.tsx (every onboarding exit path funnels there).
  useEffect(() => {
    setItem('REGISTERURL', pageNo)
  }, [pageNo])

  const setFooterState = useCallback((s: FooterState) => {
    setFooterStateRaw(s)
  }, [])

  // ── Back navigation ───────────────────────────────────────────────────────
  // Normally the forward path push()es each step, so goBack() retraces the real
  // route taken. But when onboarding is entered DIRECTLY with nothing beneath
  // it — a REGISTERURL resume on cold start, pageLandingService's page_id '1'
  // resetTo, ValidationScreen/drService's resetTo to page 20, or a dev-tool
  // pinned reload — canGoBack() is false and the back button vanished
  // entirely, stranding the user mid-wizard. onboardingBackFlow exists for
  // exactly this case (Angular resolves onboarding back from a static map, not
  // from history); it was written but never wired up.
  const hasHistory = navigation.canGoBack()
  // standalone = entered from OUTSIDE the wizard (Help Center / Biodata's "Add
  // Photo" links, drService). Those exit via goBack() to their caller, so they
  // must NOT fall back to the wizard's back map, which would walk them into
  // onboarding steps they never came from.
  const standalone = !!route.params?.standalone
  const [mappedBack, setMappedBack] = useState<string | null>(null)

  useEffect(() => {
    if (hasHistory || standalone) { setMappedBack(null); return }
    let cancelled = false
    getOnboardingBackPage(pageNo).then(target => {
      if (!cancelled) setMappedBack(target)
    })
    return () => { cancelled = true }
  }, [pageNo, hasHistory, standalone])

  const canGoBack = hasHistory || mappedBack !== null

  const handleBack = useCallback(() => {
    // hasHistory routes through the same centralized handleBack() the
    // Android back button and every other custom back icon call, so this
    // screen's back button can never diverge from the app-wide behavior.
    if (hasHistory) { centralizedHandleBack(); return }
    // No history beneath this step (see comment above) — replace rather than
    // push, so repeated back presses walk the map backwards instead of
    // growing a forward-looking stack. Params are spread through — a bare
    // { pageNo } would drop standalone/pendingUri/existingCount.
    if (mappedBack) navigation.replace('onboarding', { ...route.params, pageNo: mappedBack })
  }, [hasHistory, mappedBack, navigation, route.params])

  // ── Content router ────────────────────────────────────────────────────────

  function renderContent() {
    switch (pageNo) {
      case '1':  return <CreatedByScreen        navigation={navigation} route={route} />
      case '2':  return <NameScreen             navigation={navigation} route={route} />
      case '3':  return <GenderScreen           navigation={navigation} route={route} />
      case '4':  return <MaritalStatusScreen    navigation={navigation} route={route} />
      case '5':  return <DOBScreen              navigation={navigation} route={route} />
      case '43': return <HeightScreen           navigation={navigation} route={route} />
      case '38': return <EatingHabitScreen      navigation={navigation} route={route} />
      case '39': return <MotherTongueScreen     navigation={navigation} route={route} />
      case '9':  return <LocationScreen         navigation={navigation} route={route} />
      case '44': return <HomeTownLocationScreen navigation={navigation} route={route} />
      case '46': return <HomeTownScreen         navigation={navigation} route={route} />
      case '10': return <QualificationScreen    navigation={navigation} route={route} />
      case '11': return <OccupationScreen       navigation={navigation} route={route} />
      case '12': return <MonthlyIncomeScreen    navigation={navigation} route={route} />
      case '13': return <ReligionScreen         navigation={navigation} route={route} />
      case '14': return <CasteScreen            navigation={navigation} route={route} />
      case '16': return <GothraScreen           navigation={navigation} route={route} />
      case '20': return <AddPhotoScreen         navigation={navigation} route={route} />
      // JODII-490 "few more details" chain: 20 -> [34] -> [35] -> 27, both conditional
      case '34': return <EducationDetailScreen  navigation={navigation} route={route} />
      case '35': return <OccupationDetailScreen navigation={navigation} route={route} />
      case '22': return <CustomGalleryScreen    navigation={navigation} route={route} />
      case '21': return <ManagePhotosScreen     navigation={navigation} route={route} />
      case '27': return <FamilyDetailsScreen         navigation={navigation} route={route} />
      case '28': return <PropertyDetailsScreen       navigation={navigation} route={route} />
      case '29': return <GenerateHoroscopeScreen     navigation={navigation} route={route} />
      case '30': return <HoroscopeBirthDetailsScreen navigation={navigation} route={route} />
      case '31': return <HoroscopeTimeScreen         navigation={navigation} route={route} />
      case '33': return <StarRaasiScreen             navigation={navigation} route={route} />
      case '32': return <DoshamScreen                navigation={navigation} route={route} />
      default:   return <HomeScreen                  navigation={navigation} />
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isDesktop) {
    const desktopPage = DESKTOP_PAGE_NOS.has(pageNo) ? pageNo : 'desktop-personal-religious'
    if (desktopPage === 'desktop-other-details') {
      return <OtherDetailsDesktopStep navigation={navigation} />
    }
    if (desktopPage === 'desktop-photo-upload') {
      return <PhotoUploadDesktopStep navigation={navigation} />
    }
    if (desktopPage === 'desktop-education-location') {
      return <EducationLocationDesktopStep navigation={navigation} />
    }
    return <PersonalReligiousDesktopStep navigation={navigation} />
  }

  return (
    <OnboardingCtx.Provider value={{ setFooterState, handlers }}>
      {/* The persistent footer below lives outside every per-step screen's own
          component tree, so it needs its OWN keyboard-avoiding behavior here —
          a screen focusing its input can't lift a footer it doesn't render. */}
      <KeyboardAvoidingView
        style={shell.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* Persistent header — never unmounts */}
        <AppHeader
          type="registration"
          showBackBtn={canGoBack}
          onBackPress={handleBack}
          onLanguagePress={() => navigation.navigate('LanguageSelection')}
        />

        {/* Swapping content — only this re-renders on pageNo change */}
        <View style={shell.content}>
          {renderContent()}
        </View>

        {/* Persistent footer — driven by OnboardingCtx state */}
        <View
          style={[
            shell.footer,
            { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 20 },
          ]}
        >
          {/* Angular: SHOWLINKBTN — an underlined link CTA rendered ABOVE the
              primary Next button (registration-revamp.component.html's
              otp-cta block), centered specifically on page 29. */}
          {footerState.showLink && (
            <Pressable
              style={shell.linkRow}
              onPress={() => handlers.current.onLink?.()}
              accessibilityRole="button"
            >
              <Text style={[shell.linkText, { fontFamily: langFonts.medium }]}>
                {footerState.linkLabel}
              </Text>
              <Animated.View style={{ transform: [{ translateX: linkArrowAnim }] }}>
                <CdnSvg uri={CDN_FORWARD_ICON} width={10} height={10} style={shell.linkIcon} />
              </Animated.View>
            </Pressable>
          )}

          {!footerState.nextHidden && (
            <ButtonRevamp
              label={footerState.nextLabel ?? t('REGISTRATION.NEXTCTA', 'Next')}
              variant="primary"
              size="standard"
              fullWidth
              disabled={footerState.nextDisabled}
              loading={footerState.nextLoading}
              onPress={() => handlers.current.onNext()}
            />
          )}

          {footerState.showSkip && (
            <Pressable
              style={shell.skipRow}
              onPress={() => handlers.current.onSkip?.()}
              accessibilityRole="button"
            >
              <Text style={[shell.skipText, { fontFamily: langFonts.medium }]}>
                {footerState.skipLabel ?? t('REG.DO_LATER', "I'll do this later")}
              </Text>
              <Text style={shell.skipArrow}> ›</Text>
            </Pressable>
          )}

          {!!customerCare && (
            <>
              <View style={shell.divider} />
              <Pressable
                style={shell.helpRow}
                onPress={() => Linking.openURL(`tel:${customerCare}`)}
              >
                <Text style={shell.helpText}>Need help?  Call</Text>
                <Text style={shell.helpPhone}>{customerCare}</Text>
              </Pressable>
            </>
          )}
        </View>

      </KeyboardAvoidingView>
    </OnboardingCtx.Provider>
  )
}

// ─── Shell styles ─────────────────────────────────────────────────────────────

const shell = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: Colors.surface,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop:        20,
    backgroundColor:   Colors.surface,
  },
  linkRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
    marginBottom:    12,
  },
  linkText: {
    fontSize:           14,
    fontWeight:         '500',
    color:              Colors.link,
    textDecorationLine: 'underline',
  },
  linkIcon: {
    marginLeft: 2,
  },
  skipRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize:   15,
    fontWeight: '500',
    color:      Colors.textMedium,
  },
  skipArrow: {
    fontSize:   18,
    color:      Colors.textMedium,
    lineHeight: 22,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop:        4,
    marginBottom:    12,
  },
  helpRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
  },
  helpText: {
    fontSize:      14,
    fontWeight:    '400',
    color:         Colors.textPrimary,
    letterSpacing: 0.42,
  },
  helpPhone: {
    fontSize:      14,
    fontWeight:    '500',
    color:         Colors.link,
    letterSpacing: 0.42,
  },
})

// ─── Stack ────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<AppStackParamList>()

export default function AppStack() {
  const { initialRoute } = useAuth()

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Matches"   component={MatchesScreen} />
      <Stack.Screen name="daily-recommendations" component={DailyRecommendationScreen} />
      <Stack.Screen name="viewProfile" component={ViewProfileScreen} />
      <Stack.Screen
        name="BlockerPage"
        component={BlockerScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="Validation"
        component={ValidationScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="verify-id" component={VerifyIdScreen} />
      <Stack.Screen name="selfie-verification" component={SelfieVerificationScreen} />
      <Stack.Screen name="photo-mismatch-selfie" component={PhotoMismatchSelfieScreen} />
      <Stack.Screen name="my-membership" component={MenuContactsScreen} />
      <Stack.Screen name="Notification" component={NotificationScreen} />
      <Stack.Screen name="DiscoverMatches" component={DiscoverMatchesScreen} />
      <Stack.Screen name="addphoto-intermediate" component={AddPhotoIntermediateScreen} />
      <Stack.Screen name="star-matching" component={StarMatchingScreen} />
      <Stack.Screen name="Home"      component={HomeScreen} />
      <Stack.Screen name="dashboard" component={HomeScreen} />
      <Stack.Screen name="onboarding" component={OnboardingRouter} />
      <Stack.Screen
        name="Permissions"
        component={PermissionDemoScreen}
        options={{ headerShown: true, title: 'Permissions' }}
      />
      <Stack.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{ headerShown: true, title: 'Gallery', headerStyle: { backgroundColor: '#111' }, headerTintColor: Colors.white }}
      />
      <Stack.Screen
        name="recharge"
        component={RechargeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="payment-options" component={PaymentOptionsScreen} />
      <Stack.Screen name="card-payment" component={CardPaymentScreen} />
      <Stack.Screen name="upi-address" component={UpiAddressScreen} />
      <Stack.Screen name="net-banking" component={NetBankingScreen} />
      <Stack.Screen name="hosted-checkout" component={HostedCheckoutWebViewScreen} />
      <Stack.Screen name="more-payment-options" component={MorePaymentOptionsScreen} />
      <Stack.Screen name="neft-rtgs" component={NeftRtgsScreen} />
      <Stack.Screen name="pay-at-store" component={PayAtStoreScreen} />
      <Stack.Screen name="book-appointment" component={BookAppointmentScreen} />
      <Stack.Screen name="payment-success" component={PaymentSuccessScreen} />
      <Stack.Screen name="payment-failed" component={PaymentFailedScreen} />
      <Stack.Screen name="doorstep-collection" component={DoorstepCollectionScreen} />
      <Stack.Screen name="renewal" component={RenewalScreen} />
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="MessagerList" component={MessagerListScreen} />
      <Stack.Screen name="chat-window" component={ChatScreen} />
      <Stack.Screen name="safety-tips" component={SafetyTipsScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="Biodata" component={BiodataScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PhonePrivacy" component={PhonePrivacyScreen} />
      <Stack.Screen name="DeleteProfile" component={DeleteProfileScreen} />
      <Stack.Screen name="DeleteProfileMrgReason" component={DeleteProfileMrgReasonScreen} />
      <Stack.Screen name="DeleteProfileHide" component={DeleteProfileHideScreen} />
      <Stack.Screen name="DeleteProfileUnsatisfactory" component={DeleteProfileUnsatisfactoryScreen} />
      <Stack.Screen name="DeleteProfileWebsiteName" component={DeleteProfileWebsiteNameScreen} />
      <Stack.Screen name="DeleteProfileShareDetails" component={DeleteProfileShareDetailsScreen} />
      <Stack.Screen name="DeleteProfileUploadPhoto" component={DeleteProfileUploadPhotoScreen} />
      <Stack.Screen name="DeleteProfileSuccess" component={DeleteProfileSuccessScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="SuccessStories" component={SuccessStoriesScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Faq" component={FaqScreen} />
      <Stack.Screen name="IgnoredProfiles" component={IgnoredProfilesScreen} />
      <Stack.Screen name="ViewLater" component={ViewLaterScreen} />
      <Stack.Screen name="SearchById" component={SearchByIdScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="EditProfileReligious" component={ReligiousDetailsScreen} />
      <Stack.Screen name="EditProfileProfessional" component={ProfessionalDetailsScreen} />
      <Stack.Screen name="EditProfileBasic" component={BasicDetailsScreen} />
      <Stack.Screen name="EditProfileLifestyle" component={LifestyleDetailsScreen} />
      <Stack.Screen name="EditProfileFamily" component={FamilyDetailsEditScreen} />
      <Stack.Screen name="EditProfileProperty" component={PropertyDetailsEditScreen} />
      <Stack.Screen name="EditProfileAgeHeight" component={EditProfileAgeHeightScreen} />
      <Stack.Screen name="EditProfileMarital" component={EditProfileMaritalScreen} />
      <Stack.Screen name="EditProfileHoroscope" component={AddHoroscopeScreen} />
      <Stack.Screen name="ExternalPage" component={ExternalPageScreen} />
      {__DEV__ && (
        <Stack.Screen
          name="ComponentShowcase"
          component={ComponentShowcaseScreen}
          options={{ title: 'Component Library', headerStyle: { backgroundColor: Colors.devAccent }, headerTintColor: Colors.white }}
        />
      )}

      {/* Angular: opened as a modal overlay on the current page — never a full push.
          LanguageSelectionScreen already self-dismisses via the centralized
          handleBack() once canGoBack() is true, so onSelect here is just the
          (unreachable) fallback. */}
      <Stack.Screen name="LanguageSelection" options={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        {({ navigation }) => (
          <LanguageSelectionScreen navigation={navigation} onSelect={() => centralizedHandleBack()} presentedAsModal />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  )
}
