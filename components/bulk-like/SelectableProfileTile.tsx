// One row inside BulkLikeModal — photo + name + basic info + checkbox.
// Angular: fullpage-modalpopup.component.html <app-list-view-card> rows,
// [showCheckbox]="true", basic info from bindBasicView() joining
// AGE/EDUCATION/OCCUPATION/INCOME/CITY (a different field order than the main
// match card's buildBasicView, which is why this isn't reused from
// matchesCard.shared.tsx — the raw bulk-like API response also uses different
// field names, e.g. MATRIID/NAME/THUMBIMG, not the adapted MatchProfile shape).
import { Pressable, StyleSheet, Text, View } from 'react-native'
import ProfilePhoto from '../profile-photo/ProfilePhoto'
import { Colors } from '../../constants/colors'

function buildBasicLine(candidate: Record<string, any>): string {
  const parts: string[] = []
  if (candidate.AGE)        parts.push(`${candidate.AGE} yrs`)
  if (candidate.EDUCATION)  parts.push(candidate.EDUCATION)
  if (candidate.OCCUPATION) parts.push(candidate.OCCUPATION)
  if (candidate.INCOME)     parts.push(candidate.INCOME)
  if (candidate.CITY)       parts.push(candidate.CITY)
  return parts.join(' | ')
}

export default function SelectableProfileTile({
  candidate, checked, onToggle,
}: {
  candidate: Record<string, any>
  checked:   boolean
  onToggle:  () => void
}) {
  const photoUri = candidate.PHOTO?.[0]?.IMAGE || candidate.THUMBIMG

  return (
    <Pressable style={s.row} onPress={onToggle}>
      <ProfilePhoto profileImage={photoUri} height={64} style={s.photo} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{candidate.NAME}</Text>
        <Text style={s.basicLine} numberOfLines={2}>{buildBasicLine(candidate)}</Text>
      </View>
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Text style={s.checkmark}>✓</Text>}
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   10,
    paddingHorizontal: 16,
    gap:               12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  photo: {
    width:        64,
    borderRadius: 8,
    overflow:     'hidden',
  },
  info: { flex: 1 },
  name: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   15,
    color:      Colors.textDark,
  },
  basicLine: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      Colors.textSecondary,
    marginTop:  2,
  },
  checkbox: {
    width:           22,
    height:          22,
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
    fontSize:   14,
    fontWeight: '700',
  },
})
