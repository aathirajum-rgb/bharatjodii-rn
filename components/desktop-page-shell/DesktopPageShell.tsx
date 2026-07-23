// Shared chrome for simple desktop-web destination screens reached from the
// sidebar (Search by ID, Language change, Edit profile, ...) — top nav +
// left sidebar + a scrollable main column, matching the layout
// HomeDesktopLayout.tsx established. Pulled out once this shell was about to
// be rebuilt identically for a third screen.
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import MatchesDesktopNav from '../matches-header/MatchesDesktopNav'
import HomeSidebar, { type SidebarItem } from '../home-sidebar/HomeSidebar'
import { Colors } from '../../constants/colors'
import { StorageKeys } from '../../constants/storage.keys'
import { getItem } from '../../service/storageService'
import type { FooterTab } from '../app-footer/AppFooter'

export interface DesktopPageShellProps {
  navigation:   any
  userName:     string
  activeItem?:  SidebarItem | undefined
  onTabPress:   (tab: FooterTab) => void
  children:     React.ReactNode
}

export default function DesktopPageShell({ navigation, userName, activeItem, onTabPress, children }: DesktopPageShellProps) {
  const [userId, setUserId] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    Promise.all([
      getItem(StorageKeys.Auth.USER_ID),
      getItem(StorageKeys.User.PHOTO_URL),
    ]).then(([id, photo]) => {
      setUserId(id ?? '')
      setPhotoUrl(photo ?? undefined)
    })
  }, [])

  return (
    <View style={s.screen}>
      <MatchesDesktopNav activeTab={0} langCode="en" onTabPress={onTabPress} />

      <View style={s.body}>
        <HomeSidebar navigation={navigation} userName={userName} userId={userId} photoUrl={photoUrl} activeItem={activeItem} />

        <ScrollView style={s.main} showsVerticalScrollIndicator={false} contentContainerStyle={s.mainContent}>
          {children}
        </ScrollView>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  body: {
    flex: 1, flexDirection: 'row', paddingHorizontal: 32, paddingVertical: 24, gap: 32,
  },
  main: { flex: 1 },
  mainContent: { alignItems: 'center', paddingBottom: 40 },
})
