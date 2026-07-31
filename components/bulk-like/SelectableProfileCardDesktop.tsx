// Grid card inside BulkLikeDesktopModal — desktop sibling of SelectableProfileTile.
// Figma: "Jodii Desktop - Registration" (UaPAN9aG6MfZf6CRpwXf1L, node 1047:11645)
// card 1047:34240 — 348x136 white card, 120x120 photo, checkbox top-right.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import ProfilePhoto from '../profile-photo/ProfilePhoto'
import BasicInfoLine from './BasicInfoLine'
import { Colors } from '../../constants/colors'
import { getBasicLineParts } from './SelectableProfileTile'

export default function SelectableProfileCardDesktop({
  candidate, checked, onToggle,
}: {
  candidate: Record<string, any>
  checked:   boolean
  onToggle:  () => void
}) {
  const photoUri = candidate.PHOTO?.[0]?.IMAGE || candidate.THUMBIMG

  return (
    <Pressable style={s.card} onPress={onToggle}>
      <ProfilePhoto
        profileImage={photoUri}
        height={120}
        style={{
          width: 120,
          borderTopLeftRadius: 8, borderTopRightRadius: 8,
          borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
        }}
      />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{candidate.NAME}</Text>
        <BasicInfoLine parts={getBasicLineParts(candidate)} style={s.basicLine} numberOfLines={4} />
      </View>
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Text style={s.checkmark}>✓</Text>}
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: {
    width:  348,
    height: 136,
    flexDirection:   'row',
    backgroundColor: Colors.surface,
    borderRadius:    12,
    padding:         8,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.08,
    shadowRadius:    16,
    elevation:       3,
  },
  info: {
    flex:        1,
    marginLeft:  12,
    paddingRight: 24,
  },
  name: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   16,
    color:      Colors.black,
  },
  basicLine: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    lineHeight: 20,
    color:      Colors.black,
    marginTop:  4,
  },
  checkbox: {
    position:        'absolute',
    top:             8,
    right:           8,
    width:           20,
    height:          20,
    borderRadius:    4,
    borderWidth:     1.5,
    borderColor:     Colors.inputBorder,
    backgroundColor: Colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primaryDark,
    borderColor:     Colors.primaryDark,
  },
  checkmark: {
    color:      Colors.white,
    fontSize:   12,
    fontWeight: '700',
  },
})
