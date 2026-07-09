// Horizontally-scrolling quick-filter chip row — shared between the mobile
// MatchesHeader (MOBILE_FILTER_CHIPS) and the desktop MatchesDesktopLayout
// (DESKTOP_FILTER_CHIPS), which use different chip sets but the same component.
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

const CDN = CDN_SVG

// A chip's icon (if any) renders in exactly one position — never both — so
// this is one field, not two independent booleans. labelKey (not a literal
// label) so translation happens here, at render time, via useTranslation() —
// these arrays are module-level constants with no component context of their own.
export interface ChipConfig {
  key:           string
  labelKey:      string
  icon?:         string
  iconPosition?: 'leading' | 'onSelect'  // 'leading' = always before label (mobile "Filters");
                                          // 'onSelect' = after label once selected (mobile quick-filter chips)
}

// Figma node 11026:8853 — chips in horizontal scroll, gap 8 (mobile Matches header)
// Angular: search.component.html:176-187 (the REAL live chip row — a near-identical
// block earlier in matches.page.html looks like the same thing but is commented out
// and dead) binds [filterText]="item.selectedData | translate" — the CHIP TEXT is
// item.selectedData, NOT item.labelName. filter.config.ts's quickFilterList sets
// selectedData to a literal English string for 3 of these 4 (not a real i18n key),
// so ngx-translate's identity-fallback just renders it verbatim in every language —
// a real, current limitation in Angular itself, not something to "fix" here. We
// reproduce that exact behavior: labelKey holds the literal string Angular shows;
// react-i18next's own missing-key fallback (return the key verbatim) matches it.
// Only 'FILTER' has a genuine key for selectedData (it happens to equal labelName).
export const MOBILE_FILTER_CHIPS: ChipConfig[] = [
  { key: 'FILTER',             labelKey: 'SEARCH.FILTER_HEADER',                 icon: CDN + 'revamp/filter-revamp.svg',        iconPosition: 'leading' },
  { key: 'PROFILECREATED',     labelKey: 'Recently Joined',                      icon: CDN + 'menu/filter-profile-created.svg', iconPosition: 'onSelect' },
  { key: 'PHOTOAVAILABLE',     labelKey: 'Matches who have added photos',        icon: CDN + 'menu/filter-with-photos.svg',     iconPosition: 'onSelect' },
  { key: 'HOROSCOPEAVAILABLE', labelKey: 'Matches who have horoscope',           icon: CDN + 'menu/filter-horoscope.svg',       iconPosition: 'onSelect' },
]

// Desktop "Jodii Desktop" Figma quick-filter row — plain text chips, no icons.
// React-only design (no Angular desktop equivalent). Labels match the Figma
// desktop wording exactly (confirmed via get_design_context on node 783:54671),
// reusing existing i18n keys where they already carry that exact copy.
export const DESKTOP_FILTER_CHIPS: ChipConfig[] = [
  { key: 'NEARBY',             labelKey: 'MATCHES.NEARBY_CHIP' },
  { key: 'PROFILECREATED',     labelKey: 'HOME.NEWLY_JOINED_HEADER' },
  { key: 'PHOTOAVAILABLE',     labelKey: 'MATCHES.PHOTOS_CHIP' },
  { key: 'HOROSCOPEAVAILABLE', labelKey: 'MATCHES.HOROSCOPE_CHIP' },
]

export default function FilterChipsRow({
  chips, selected, onSelect, selectedBg, selectedTextColor,
}: {
  chips:              ChipConfig[]
  selected:           string
  onSelect:           (key: string) => void
  selectedBg?:         string | undefined   // override for the selected-chip background (default = mobile's Figma value)
  selectedTextColor?: string | undefined   // override for the selected-chip label color (default = mobile's Figma value)
}) {
  const { t } = useTranslation()
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
            style={[
              f.chip,
              isSelected && f.chipSelected,
              isSelected && selectedBg != null && { backgroundColor: selectedBg },
            ]}
            onPress={() => onSelect(isSelected && !isLeadingIcon ? '' : chip.key)}
          >
            {isLeadingIcon && chip.icon && (
              <CdnSvg uri={chip.icon} width={20} height={20} style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                f.chipText,
                isSelected && f.chipTextSelected,
                isSelected && selectedTextColor != null && { color: selectedTextColor },
              ]}
            >
              {t(chip.labelKey)}
            </Text>
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
    paddingLeft:   16,
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
    color:      '#000000',
  },
  chipTextSelected: {
    color: Colors.primary,
  },
})
