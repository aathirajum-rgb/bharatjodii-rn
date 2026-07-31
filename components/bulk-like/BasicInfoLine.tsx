// Shared by SelectableProfileTile.tsx and SelectableProfileCardDesktop.tsx —
// Figma renders the "|" field separators dimmed (rgba(0,0,0,0.2)) against the
// otherwise solid-color info text, on both mobile (55:106) and desktop
// (1047:34240).
import { Fragment } from 'react'
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native'

export default function BasicInfoLine({
  parts, style, numberOfLines,
}: {
  parts: string[]
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <Text style={s.separator}> | </Text>}
          {part}
        </Fragment>
      ))}
    </Text>
  )
}

const s = StyleSheet.create({
  separator: { color: 'rgba(0,0,0,0.2)' },
})
