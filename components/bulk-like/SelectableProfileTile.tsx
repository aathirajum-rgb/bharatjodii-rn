// One row inside BulkLikeModal — photo + name + basic info + checkbox.
// Angular: fullpage-modalpopup.component.html <app-list-view-card> rows,
// [showCheckbox]="true", basic info from bindBasicView() joining
// AGE/EDUCATION/OCCUPATION/INCOME/CITY (a different field order than the main
// match card's buildBasicView, which is why this isn't reused from
// matchesCard.shared.tsx — the raw bulk-like API response also uses different
// field names, e.g. MATRIID/NAME/THUMBIMG, not the adapted MatchProfile shape).
import { Pressable, StyleSheet, Text, View } from 'react-native'
import ProfilePhoto from '../profile-photo/ProfilePhoto'
import BasicInfoLine from './BasicInfoLine'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// Shared with SelectableProfileCardDesktop.tsx, which renders the "|"
// separators dimmed and so needs the raw parts rather than a joined string.
// AGE comes back from the bulk-like API already unit-suffixed (e.g. "19
// years", not a bare number) — appending a unit here duplicated it ("19
// years yrs").
export function getBasicLineParts(candidate: Record<string, any>): string[] {
  const parts: string[] = []
  if (candidate.AGE)        parts.push(String(candidate.AGE))
  if (candidate.EDUCATION)  parts.push(candidate.EDUCATION)
  if (candidate.OCCUPATION) parts.push(candidate.OCCUPATION)
  if (candidate.INCOME)     parts.push(candidate.INCOME)
  if (candidate.CITY)       parts.push(candidate.CITY)
  return parts
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
    <Pressable style={s.card} onPress={onToggle}>
      <ProfilePhoto
        profileImage={photoUri}
        height={96}
        style={{
          width: 96,
          borderTopLeftRadius: 8, borderTopRightRadius: 8,
          borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
        }}
      />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{candidate.NAME}</Text>
        <BasicInfoLine parts={getBasicLineParts(candidate)} style={s.basicLine} numberOfLines={3} />
      </View>
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Text style={s.checkmark}>✓</Text>}
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    padding:         8,
    gap:             12,
    backgroundColor: Colors.surface,
    borderRadius:    12,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.08,
    shadowRadius:    16,
    elevation:       3,
  },
  info: { flex: 1, paddingRight: 24 },
  name: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   16,
    color:      Colors.black,
  },
  basicLine: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   12,
    lineHeight: 16,
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
    borderWidth:     1,
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
