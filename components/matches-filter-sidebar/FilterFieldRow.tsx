// Generic filter row for the desktop Matches sidebar (Figma "Jodii Desktop"):
// label + bold current-value summary on the left, chevron on the right, and a
// small active dot next to the label when the field differs from its default.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'

type Props = {
  label:   string
  value:   string
  active?: boolean
  onPress: () => void
}

export default function FilterFieldRow({ label, value, active, onPress }: Props) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <View style={s.textCol}>
        <View style={s.labelRow}>
          {active && <View style={s.dot} />}
          <Text style={s.label}>{label}</Text>
        </View>
        <Text style={s.value} numberOfLines={1}>{value}</Text>
      </View>
      <Text style={s.chevron}>{'›'}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  textCol:  { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.primary,
  },
  label: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.textSecondary,
  },
  value: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.textDark,
    marginTop:  2,
  },
  chevron: {
    fontSize: 20,
    color:    Colors.borderNeutral,
  },
})
