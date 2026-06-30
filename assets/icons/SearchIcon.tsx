import Svg, { Path } from 'react-native-svg'

interface Props {
  size?:  number
  color?: string
}

export default function SearchIcon({ size = 24, color = '#B3B3B3' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 25" fill="none">
      <Path
        d="m20 19.807-5-5m1.667-4.167A5.833 5.833 0 1 1 5 10.64a5.833 5.833 0 0 1 11.667 0z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
