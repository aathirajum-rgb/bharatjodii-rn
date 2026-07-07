// Horizontally-scrolling quick-filter chip row — shared between the mobile
// MatchesHeader (MOBILE_FILTER_CHIPS) and the desktop MatchesDesktopLayout
// (DESKTOP_FILTER_CHIPS), which use different chip sets but the same component.
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

const CDN = CDN_SVG

// A chip's icon (if any) renders in exactly one position — never both — so
// this is one field, not two independent booleans.
export interface ChipConfig {
  key:           string
  label:         string
  icon?:         string
  iconPosition?: 'leading' | 'onSelect'  // 'leading' = always before label (mobile "Filters");
                                          // 'onSelect' = after label once selected (mobile quick-filter chips)
}

// Figma node 11026:8853 — chips in horizontal scroll, gap 8 (mobile Matches header)
export const MOBILE_FILTER_CHIPS: ChipConfig[] = [
  { key: 'FILTER',             label: 'Filters',         icon: CDN + 'revamp/filter-revamp.svg',        iconPosition: 'leading' },
  { key: 'PROFILECREATED',     label: 'Recently Joined', icon: CDN + 'menu/filter-profile-created.svg', iconPosition: 'onSelect' },
  { key: 'PHOTOAVAILABLE',     label: 'With photos',     icon: CDN + 'menu/filter-with-photos.svg',     iconPosition: 'onSelect' },
  { key: 'HOROSCOPEAVAILABLE', label: 'With Horoscope',  icon: CDN + 'menu/filter-horoscope.svg',       iconPosition: 'onSelect' },
]

// Desktop "Jodii Desktop" Figma quick-filter row — plain text chips, no icons.
export const DESKTOP_FILTER_CHIPS: ChipConfig[] = [
  { key: 'NEARBY',             label: 'Nearby matches' },
  { key: 'PROFILECREATED',     label: 'Newly joined' },
  { key: 'PHOTOAVAILABLE',     label: 'Matches with photos' },
  { key: 'HOROSCOPEAVAILABLE', label: 'Matches with horoscope' },
]

export default function FilterChipsRow({
  chips, selected, onSelect,
}: {
  chips:    ChipConfig[]
  selected: string
  onSelect: (key: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={f.row}
      style={f.scroll}
    >
      {chips.map(chip => {
        const isSelected  = selected === chip.key
        const isLeadingIcon = chip.iconPosition === 'leading'
        return (
          <Pressable
            key={chip.key}
            style={[f.chip, isSelected && f.chipSelected]}
            onPress={() => onSelect(isSelected && !isLeadingIcon ? '' : chip.key)}
          >
            {isLeadingIcon && chip.icon && (
              <CdnSvg uri={chip.icon} width={20} height={20} style={{ marginRight: 4 }} />
            )}
            <Text style={[f.chipText, isSelected && f.chipTextSelected]}>{chip.label}</Text>
            {chip.iconPosition === 'onSelect' && chip.icon && isSelected && (
              <CdnSvg uri={chip.icon} width={16} height={16} style={{ marginLeft: 4 }} />
            )}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

// Figma chips: height 40, px 16, py 8, border-radius 20, border #B0B0B0, gap 8
const f = StyleSheet.create({
  scroll: {
    flexShrink: 0,
    height:     56,  // paddingTop 8 + chip 40 + paddingBottom 8
  },
  row: {
    paddingLeft:   24,
    paddingRight:  16,
    paddingTop:    8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  chip: {
    height:            40,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       Colors.inputBorder,
    backgroundColor:   'rgba(255,255,255,0.2)',
    flexDirection:     'row',
    alignItems:        'center',
    flexShrink:        0,
  },
  chipSelected: {
    borderColor:     Colors.chipBorderActive,
    backgroundColor: Colors.chipSurfaceSelected,
  },
  chipText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    lineHeight: 20,
    color:      '#1F1E1B',
  },
  chipTextSelected: {
    color: Colors.primary,
  },
})
