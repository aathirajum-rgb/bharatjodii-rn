import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ActivityHeaderProps {
  title?:          string     // default "Activity"
  onSettingsPress?: () => void
}

// ─── ActivityHeader ───────────────────────────────────────────────────────────

export default function ActivityHeader({
  title = 'Activity',
  onSettingsPress,
}: ActivityHeaderProps) {
  return (
    // SafeAreaView edges={['top']} — handles status bar zone (Love project pattern)
    // Activity screen content below needs no extra paddingTop
    <SafeAreaView edges={['top']} style={s.safeTop}>
      <View style={s.container}>
        <Text style={s.title}>{title}</Text>
        {onSettingsPress && (
          <Pressable style={s.iconBtn} onPress={onSettingsPress} hitSlop={8}>
            {/* Settings icon placeholder — replace with SvgUri when CDN path is confirmed */}
            <View style={s.iconBox} />
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
  iconBox: {
    width:  24,
    height: 24,
  },
})
