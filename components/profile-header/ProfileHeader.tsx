import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

const CDN = CDN_SVG

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProfileHeaderProps {
  title?:           string    // default "My Profile"
  onSettingsPress?: () => void
}

// ─── ProfileHeader ────────────────────────────────────────────────────────────

export default function ProfileHeader({
  title = 'My Profile',
  onSettingsPress,
}: ProfileHeaderProps) {
  return (
    // SafeAreaView edges={['top']} — handles status bar zone (Love project pattern)
    // Profile screen content below needs no extra paddingTop
    <SafeAreaView edges={['top']} style={s.safeTop}>
      <View style={s.container}>
        <Text style={s.title}>{title}</Text>
        {onSettingsPress && (
          <Pressable style={s.iconBtn} onPress={onSettingsPress} hitSlop={8}>
            <Image
              source={{ uri: CDN + 'revamp/settings-icon.svg' }}
              style={s.icon}
              resizeMode="contain"
            />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeTop: {
    backgroundColor: Colors.white,
  },
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   10,
    paddingHorizontal: 20,
  },
  title: {
    flex:       1,
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    lineHeight: 28,
    color:      Colors.textPrimary,
  },
  iconBtn: {
    padding: 4,
  },
  icon: {
    width:  24,
    height: 24,
  },
})
