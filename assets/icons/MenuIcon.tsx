import Svg, { Path } from 'react-native-svg'

interface Props {
  size?:  number
  color?: string
}

export default function MenuIcon({ size = 24, color = '#333333' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h15M5 7h15M5 17h15"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
