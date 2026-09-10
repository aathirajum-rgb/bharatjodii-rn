// The 4 real bottom tabs (Home/Matches/Activity/Messages) — everything else
// stays a flat screen in AppStack.tsx. Moved here from being 4 separate
// Stack.Screens so that switching between them re-focuses an existing mounted
// screen instead of pushing a brand-new instance every time (that unbounded
// per-switch push was the actual cause of Home slowing down over long
// sessions — see the perf-audit plan for the full trace). AppFooter now
// mounts exactly once, as this navigator's custom tabBar, instead of once per
// screen.
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/home/HomeScreen'
import MatchesScreen from '../screens/matches/MatchesScreen'
import ActivityScreen from '../screens/activity/ActivityScreen'
import MessagerListScreen from '../screens/messagerList/MessagerListScreen'
import AppFooter, { type FooterTab } from '../components/app-footer/AppFooter'
import { FooterBadgesProvider, useFooterBadges } from '../contexts/FooterBadgesContext'
import { openMembershipTab } from '../service/paymentService'

export type MainTabsParamList = {
  Home:    undefined
  // Same shape as the old flat AppStackParamList['Matches'] — Home's "Explore
  // matches based on" category tiles and Search both pass these through.
  Matches: { exploreType?: string; exploreLabel?: string; searchParams?: string } | undefined
  // Same shape as the old flat AppStackParamList['Activity'].
  Activity: { activityType?: 'likedyou' | 'likesent' | 'viewedyou' | 'viewedbyme'; selectedSubTab?: 'viewedbyme' | 'viewinglater' } | undefined
  MessagerList: undefined
}

const ROUTE_FOR_TAB: Record<FooterTab, keyof MainTabsParamList | null> = {
  0: 'Home',
  1: 'Matches',
  2: 'Activity',
  4: 'MessagerList',
  // Membership is an action (openMembershipTab), not a persisted tab route.
  3: null,
}

const TAB_FOR_ROUTE: Record<string, FooterTab> = {
  Home: 0,
  Matches: 1,
  Activity: 2,
  MessagerList: 4,
}

function MainTabsBar({ state, navigation }: BottomTabBarProps) {
  const { likesCount, upgradeTag, showMembershipDot, footerVisible, dismissMembershipDotForSession } = useFooterBadges()
  const activeTab = TAB_FOR_ROUTE[state.routeNames[state.index]] ?? 0

  // ActivityScreen hides the footer while showing its "viewed you"/"viewed by
  // me" drill-down (Angular: <app-footer *ngIf="!isViewedList()">).
  if (!footerVisible) return null

  function handleTabPress(tab: FooterTab) {
    if (tab === 3) {
      // Angular: footer.component.ts:165 — showRedDot flips false for the
      // rest of the session the moment the membership tab is tapped, before
      // paymentTrack(31)/routing even happens (that part lives inside
      // openMembershipTab() itself).
      dismissMembershipDotForSession()
      openMembershipTab()
      return
    }
    const route = ROUTE_FOR_TAB[tab]
    if (route) navigation.navigate(route)
  }

  return (
    <AppFooter
      activeTab={activeTab}
      likesCount={likesCount}
      upgradeTag={upgradeTag}
      showMembershipDot={showMembershipDot}
      onTabPress={handleTabPress}
    />
  )
}

const Tab = createBottomTabNavigator<MainTabsParamList>()

export default function MainTabs() {
  return (
    <FooterBadgesProvider>
      <Tab.Navigator
        initialRouteName="Matches"
        screenOptions={{ headerShown: false }}
        tabBar={props => <MainTabsBar {...props} />}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Matches" component={MatchesScreen} />
        <Tab.Screen name="Activity" component={ActivityScreen} />
        <Tab.Screen name="MessagerList" component={MessagerListScreen} />
      </Tab.Navigator>
    </FooterBadgesProvider>
  )
}
