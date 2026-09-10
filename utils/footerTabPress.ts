import { openMembershipTab } from '../service/paymentService'
import type { FooterTab } from '../components/app-footer/AppFooter'

// Shared by every screen OUTSIDE MainTabs' own Tab.Navigator that shows the
// footer (or its desktop-web equivalent, MatchesDesktopNav) and needs to jump
// into one of its 4 tabs from outside — Home/Matches/Activity/MessagerList
// live under 'MainTabs' now (navigation/MainTabs.tsx), so reaching them from
// a sibling Stack.Screen needs the nested {screen} form, not a bare
// navigate(name). This was previously the exact same ~20-line switch
// hand-copied into every screen that renders the footer.
//
// Pass `membershipTap: null` for the two screens that ARE themselves a
// Membership destination (RechargeScreen, MenuContactsScreen) — tapping
// Membership again while already on one of them would otherwise push a
// duplicate instance of itself via openMembershipTab()'s own navigate() call.
//
// NOT used by MainTabs.tsx's own tabBar (it dispatches bare navigate() from
// inside the Tab.Navigator, not the nested form) or by the 4 tab screens'
// own handleTabPress (used only for their desktop nav prop — each omits its
// own tab and HomeScreen also dismisses the membership red dot, both
// genuine per-screen differences, not copy-paste duplication).
export function handleFooterTabPress(
  navigation: any,
  tab: FooterTab,
  membershipTap: (() => void) | null = openMembershipTab,
): void {
  switch (tab) {
    case 0: navigation.navigate('MainTabs', { screen: 'Home' });     break
    case 1: navigation.navigate('MainTabs', { screen: 'Matches' });  break
    case 2: navigation.navigate('MainTabs', { screen: 'Activity' }); break
    case 4: navigation.navigate('MainTabs', { screen: 'MessagerList' }); break
    case 3: membershipTap?.(); break
  }
}
