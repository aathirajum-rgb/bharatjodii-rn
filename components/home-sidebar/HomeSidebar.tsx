// Desktop Home left sidebar (Figma "Jodii Desktop - Registration", node
// 1034:6600, "Sidebar") — user profile summary card + account menu, matching
// the Figma design's own row set exactly (confirmed against the live "Jodii
// Desktop" and "Jodii Desktop - Scroll view" frames — the card has exactly
// 7 rows below the Edit profile/Edit preferences pair, with no Logout row
// here — per explicit correction, Logout lives only inside Settings (see
// SettingsScreen.tsx), reusing the same LogoutConfirmModal.tsx popup there).
//
// Icons load from the CDN (imgs.jodii.app), the same way the Angular app's
// own menu.page.html loads its account-menu icons, instead of bundling local
// Figma-exported files via require() — the desktop-home/ folder of ~80
// locally require()'d assets from the original build of this screen was
// never committed to git and got wiped from disk, breaking every screen
// that referenced it. CDN URLs can't disappear from under us the same way.
import { Image } from 'expo-image'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { CDN_SVG } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import { ICON as MENU_ICON } from '../../screens/menu/MenuScreen'

const ICON = {
  editProfile:     `${CDN_SVG}menu/edit-profile.svg`,
  editPreferences: `${CDN_SVG}filter-icon.svg`,
  settings:        `${CDN_SVG}menu/setting.svg`,
  searchProfile:   `${CDN_SVG}search-profile-id-img.svg`,
  viewLater:       `${CDN_SVG}profiles-view-later.svg`,
  ignoredProfiles: `${CDN_SVG}profiles-you-marked-img.svg`,
  successStories:  `${CDN_SVG}jodii-wedding-stories-img.svg`,
  customerSupport: `${CDN_SVG}menu/customer-support-new.svg`,
}

export type SidebarItem =
  | 'editProfile' | 'editPreferences' | 'settings' | 'searchById'
  | 'viewLater' | 'ignoredProfiles' | 'successStories' | 'customerSupport'

export interface HomeSidebarProps {
  navigation:  any
  userName:    string
  userId:      string
  photoUrl?:   string | undefined
  activeItem?: SidebarItem | undefined
}

function SidebarRow({
  iconUri, iconSize = 28, title, active = false, onPress,
}: {
  iconUri:    string
  iconSize?:  number
  title:      string
  active?:    boolean
  onPress:    () => void
}) {
  return (
    <Pressable style={({ pressed }) => [s.row, active && s.rowActive, pressed && s.rowPressed]} onPress={onPress} accessibilityRole="button">
      <View style={s.rowIconWrap}>
        <CdnSvg uri={iconUri} width={iconSize} height={iconSize} />
      </View>
      <Text style={[s.rowTitle, active && s.rowTitleActive]} numberOfLines={1}>{title}</Text>
      <Text style={s.rowChevron}>{'›'}</Text>
    </Pressable>
  )
}

export default function HomeSidebar({ navigation, userName, userId, photoUrl, activeItem }: HomeSidebarProps) {
  return (
    <View style={s.container}>
      {/* ── Profile summary ── */}
      <View style={s.avatarWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={s.avatar} contentFit="cover" />
        ) : (
          <CdnSvg uri={MENU_ICON.avatar} width={100} height={100} />
        )}
      </View>
      <Text style={s.name} numberOfLines={1}>{userName}</Text>
      <Text style={s.id}>ID {userId}</Text>

      {/* ── Card: Edit profile / Edit preferences, then a divider, then the
          rest of the account menu — Figma renders this as ONE card with a
          single internal divider, not separate boxed groups. ── */}
      <View style={s.card}>
        <SidebarRow iconUri={ICON.editProfile} title="Edit profile" active={activeItem === 'editProfile'} onPress={() => navigation.navigate('EditProfile')} />
        <SidebarRow iconUri={ICON.editPreferences} iconSize={24} title="Edit preferences" active={activeItem === 'editPreferences'} onPress={() => navigation.navigate('Search')} />

        <View style={s.divider} />

        <SidebarRow iconUri={ICON.settings} iconSize={24} title="Settings" active={activeItem === 'settings'} onPress={() => navigation.navigate('Settings')} />
        <SidebarRow iconUri={ICON.searchProfile} title="Search profile by ID" active={activeItem === 'searchById'} onPress={() => navigation.navigate('SearchById')} />
        <SidebarRow iconUri={ICON.viewLater} title="Profile marked as view later" active={activeItem === 'viewLater'} onPress={() => navigation.navigate('ViewLater')} />
        <SidebarRow iconUri={ICON.ignoredProfiles} title="Ignored profiles" active={activeItem === 'ignoredProfiles'} onPress={() => navigation.navigate('IgnoredProfiles')} />
        <SidebarRow iconUri={ICON.successStories} title="Jodii success stories" active={activeItem === 'successStories'} onPress={() => navigation.navigate('SuccessStories')} />
        <SidebarRow iconUri={ICON.customerSupport} title="Contact Customer support" active={activeItem === 'customerSupport'} onPress={() => navigation.navigate('HelpCenter')} />
      </View>
    </View>
  )
}

// Sized up from Figma's literal 254px card (per explicit feedback that it
// read as too small next to the wider main content column) — scaled by
// ~1.25x across the board (width, avatar, type, row height) rather than
// just widening the outer container, so it reads as a deliberately bigger
// card and not a stretched one.
const s = StyleSheet.create({
  container: { width: 320 },

  avatarWrap: {
    width: 100, height: 100, borderRadius: 50, overflow: 'hidden', alignSelf: 'center',
    backgroundColor: Colors.surfaceInput,
  },
  avatar: { width: 100, height: 100 },

  name: { fontFamily: 'Poppins-SemiBold', fontSize: 18, lineHeight: 22, color: Colors.black, textAlign: 'center', marginTop: 14 },
  id:   { fontFamily: 'Poppins-Regular', fontSize: 16, lineHeight: 22, color: '#545454', textAlign: 'center', marginTop: 4, marginBottom: 24 },

  card: {
    backgroundColor: Colors.white,
    borderWidth:     1,
    borderColor:     Colors.borderSubtle,
    borderRadius:    18,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    height:         48,
    gap:            10,
  },
  rowPressed: { backgroundColor: Colors.surfaceInput },
  rowActive:  { backgroundColor: Colors.selectionBg },
  rowIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowTitle:   { flex: 1, fontFamily: 'Poppins-Regular', fontSize: 14, lineHeight: 18, color: Colors.black },
  rowTitleActive: { fontFamily: 'Poppins-Medium', color: Colors.primaryDark },
  rowChevron: { fontSize: 18, fontFamily: 'Poppins-Regular', color: '#8a8a8a' },
  divider: { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 6 },
})
