import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppHeader from '../components/app-header/AppHeader'
import ButtonRevamp from '../components/button-revamp/ButtonRevamp'
import { Colors } from '../constants/colors'
import { StorageKeys } from '../constants/storage.keys'
import { OnboardingCtx, FooterState, FooterHandlers } from '../contexts/OnboardingContext'
import { getItem } from '../service/storageService'
import { useAuth } from '../contexts/AuthContext'
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
import CustomGalleryScreen         from '../screens/onboarding/CustomGalleryScreen'
import ManagePhotosScreen          from '../screens/onboarding/ManagePhotosScreen'
import FamilyDetailsScreen         from '../screens/onboarding/FamilyDetailsScreen'
import PropertyDetailsScreen       from '../screens/onboarding/PropertyDetailsScreen'
import StarRaasiScreen             from '../screens/onboarding/StarRaasiScreen'
import DoshamScreen                from '../screens/onboarding/DoshamScreen'
import PaymentSuccessScreen        from '../screens/payment/PaymentSuccessScreen'
import RechargeScreen              from '../screens/payment/RechargeScreen'
import PermissionDemoScreen        from '../screens/PermissionDemoScreen'
import MatchesScreen               from '../screens/matches/MatchesScreen'
import ViewProfileScreen           from '../screens/viewprofile/ViewProfileScreen'
import ActivityScreen               from '../screens/activity/ActivityScreen'
import LanguageSelectionScreen     from '../screens/LanguageSelectionScreen'
import MenuScreen                  from '../screens/menu/MenuScreen'
import SettingsScreen              from '../screens/settings/SettingsScreen'
import DeleteProfileScreen             from '../screens/delete-profile/DeleteProfileScreen'
import DeleteProfileMrgReasonScreen    from '../screens/delete-profile/DeleteProfileMrgReasonScreen'
import DeleteProfileHideScreen         from '../screens/delete-profile/DeleteProfileHideScreen'
import DeleteProfileShareDetailsScreen  from '../screens/delete-profile/DeleteProfileShareDetailsScreen'
import DeleteProfileWebsiteNameScreen   from '../screens/delete-profile/DeleteProfileWebsiteNameScreen'
import DeleteProfileUploadPhotoScreen       from '../screens/delete-profile/DeleteProfileUploadPhotoScreen'
import DeleteProfileUnsatisfactoryScreen   from '../screens/delete-profile/DeleteProfileUnsatisfactoryScreen'
import DeleteProfileOtherReasonScreen      from '../screens/delete-profile/DeleteProfileOtherReasonScreen'
import DeleteProfileSuccessScreen          from '../screens/delete-profile/DeleteProfileSuccessScreen'
import SuccessStoriesScreen               from '../screens/success-stories/SuccessStoriesScreen'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppStackParamList = {
  Home:              undefined
  // exploreType/exploreLabel — Angular: matches.page.ts explorePage branch (FILTERTYPE
  // scoped listing, e.g. tapping a Home "Explore matches based on" category tile)
  Matches:           { exploreType?: string; exploreLabel?: string } | undefined
  dashboard:         undefined
  onboarding:        { pageNo: string } | undefined
  Permissions:       undefined
  Gallery:           undefined
  recharge:          { from?: string; paymentId?: string; type?: string } | undefined
  'payment-success': undefined
  ComponentShowcase: undefined
  // Angular: languageChangeService.languageChange() opens the language screen as a
  // modal ON TOP of the current page (Matches, onboarding, etc.) — never a full-screen
  // push. AuthStack's own LanguageSelection route (pre-login, full-screen) is separate.
  LanguageSelection: undefined
  Activity:          undefined
  Menu:              undefined
  Settings:          undefined
  DeleteProfile:         undefined
  DeleteProfileMrgReason:    { reason: string; reasonName?: string }
  DeleteProfileHide:              { reasonName: string }
  DeleteProfileUnsatisfactory:    { reasonName: string }
  DeleteProfileOtherReason:       { reasonName: string }
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
  // Angular: viewprofile.page.ts route params (:module/:id) — fromPage drives the
  // "from" context communicationBtnOnClick needs for its paywall/report-popup logic.
  viewProfile: { matriId: string; fromPage: string; showRating?: boolean } | undefined
}

// ─── Onboarding shell ─────────────────────────────────────────────────────────
// AppHeader and footer stay mounted across all onboarding screens.
// Only the content area re-renders on pageNo change.

function OnboardingRouter({ navigation, route }: { navigation: any; route: any }) {
  const pageNo = route.params?.pageNo ?? '1'
  const insets = useSafeAreaInsets()

  const [footerState, setFooterStateRaw] = useState<FooterState>({
    nextDisabled: true,
    nextLoading:  false,
    nextHidden:   false,
    showSkip:     false,
  })
  const [customerCare, setCustomerCare] = useState('')
  const handlers = useRef<FooterHandlers>({ onNext: () => {} })

  // Load customer care number once at mount
  useEffect(() => {
    getItem(StorageKeys.App.CUSTOMER_CARE).then(cc => { if (cc) setCustomerCare(cc) })
  }, [])

  // Reset only the handler ref when the page changes — each screen sets its
  // own visual footer state via useOnboardingFooter on mount.
  useEffect(() => {
    handlers.current = { onNext: () => {} }
  }, [pageNo])

  const setFooterState = useCallback((s: FooterState) => {
    setFooterStateRaw(s)
  }, [])

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
      case '22': return <CustomGalleryScreen    navigation={navigation} route={route} />
      case '21': return <ManagePhotosScreen     navigation={navigation} route={route} />
      case '27': return <FamilyDetailsScreen    navigation={navigation} route={route} />
      case '28': return <PropertyDetailsScreen  navigation={navigation} route={route} />
      case '29': return <StarRaasiScreen        navigation={navigation} route={route} />
      case '32': return <DoshamScreen           navigation={navigation} route={route} />
      default:   return <HomeScreen             navigation={navigation} />
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <OnboardingCtx.Provider value={{ setFooterState, handlers }}>
      <View style={shell.screen}>

        {/* Persistent header — never unmounts */}
        <AppHeader
          type="registration"
          showBackBtn={navigation.canGoBack()}
          onBackPress={() => navigation.goBack()}
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
          {!footerState.nextHidden && (
            <ButtonRevamp
              label={footerState.nextLabel ?? 'Next'}
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
              <Text style={shell.skipText}>
                {footerState.skipLabel ?? "I'll do this later"}
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

      </View>
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
  const { isNewUser } = useAuth()

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isNewUser ? 'onboarding' : 'Matches'}
    >
      <Stack.Screen name="Matches"   component={MatchesScreen} />
      <Stack.Screen name="viewProfile" component={ViewProfileScreen} />
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
        options={{ headerShown: true, title: 'Membership Plans', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: Colors.white }}
      />
      <Stack.Screen name="payment-success" component={PaymentSuccessScreen} />
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DeleteProfile" component={DeleteProfileScreen} />
      <Stack.Screen name="DeleteProfileMrgReason" component={DeleteProfileMrgReasonScreen} />
      <Stack.Screen name="DeleteProfileHide" component={DeleteProfileHideScreen} />
      <Stack.Screen name="DeleteProfileUnsatisfactory" component={DeleteProfileUnsatisfactoryScreen} />
      <Stack.Screen name="DeleteProfileOtherReason" component={DeleteProfileOtherReasonScreen} />
      <Stack.Screen name="DeleteProfileWebsiteName" component={DeleteProfileWebsiteNameScreen} />
      <Stack.Screen name="DeleteProfileShareDetails" component={DeleteProfileShareDetailsScreen} />
      <Stack.Screen name="DeleteProfileUploadPhoto" component={DeleteProfileUploadPhotoScreen} />
      <Stack.Screen name="DeleteProfileSuccess" component={DeleteProfileSuccessScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="SuccessStories" component={SuccessStoriesScreen} />
      <Stack.Screen
        name="ComponentShowcase"
        component={ComponentShowcaseScreen}
        options={{ title: 'Component Library', headerStyle: { backgroundColor: Colors.devAccent }, headerTintColor: Colors.white }}
      />

      {/* Angular: opened as a modal overlay on the current page — never a full push.
          LanguageSelectionScreen already self-dismisses via navigation.goBack() once
          canGoBack() is true, so onSelect here is just the (unreachable) fallback. */}
      <Stack.Screen name="LanguageSelection" options={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
        {({ navigation }) => (
          <LanguageSelectionScreen navigation={navigation} onSelect={() => navigation.goBack()} presentedAsModal />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  )
}
