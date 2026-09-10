// Horizontally-scrolling quick-filter chip row — shared between the mobile
// Matches header (its chips come from the API — see FILTER_CHIP below) and the
// desktop MatchesDesktopLayout (DESKTOP_FILTER_CHIPS) — different chip sets,
// same component.
//
// Angular: search.component.html's `<swiper [config]="filterMatches">` over
// `quickFilterSearchList`. The swiper config is `slidesPerView: 'auto'`,
// `freeMode: true`, `loop: false` — i.e. plain free horizontal scrolling with
// content-sized slides, which is what a horizontal ScrollView already is.
import { ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import Chip from '../chip/Chip'
import { Colors } from '../../constants/colors'
import { FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'

// Angular: filter.config.ts's quickFilterList entries. `type: 'searchPage'`
// marks the one chip that navigates to the filter page instead of toggling a
// flag — it is also the only one with a leading icon and a count badge, per
// search.component.html's `item.fieldType == 'FILTER' ? ... : ...` bindings.
// Every other chip is a plain toggle whose icon appears only once selected.
//
// The per-chip `imgUrl` in Angular's config is dead: the template drives the
// icon off `iconType` alone ('filter-img' / 'close-icon' / ''), so a selected
// chip shows a CLOSE icon, never the field's own. Chip.tsx owns both URLs.
export interface ChipConfig {
  key:              string
  // An i18n key, for the chips whose copy this app owns. The Matches quick
  // filters do NOT use it — their labels arrive already localized from the
  // server, in `label` below (see registrationService.fetchQuickFilterChips()).
  labelKey?:        string
  label?:           string
  opensFilterPage?: boolean
}

// The one chip this app supplies itself. Angular's filter.config.ts gives it
// `selectedData: 'SEARCH.FILTER_HEADER'` — a real i18n key, which is why the
// template's `| translate` resolves it while the other three pass straight
// through. It is also the only chip with a leading icon and a count badge, and
// the only one that navigates instead of toggling a field (`type:'searchPage'`).
//
// The other three are NOT listed here: they are built at runtime from the API
// (registrationService.fetchQuickFilterChips() → MatchesScreen), mirroring
// Angular's matches.page.ts hdrSearchList → `[filterDataFromMatches]` input →
// search.component's quickFilterSearchList.
export const FILTER_CHIP: ChipConfig = {
  key: 'FILTER', labelKey: 'SEARCH.FILTER_HEADER', opensFilterPage: true,
}

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
  chips, selected, onSelect, filterCount = 0, selectedBg, selectedTextColor,
}: {
  chips:    ChipConfig[]
  // Every chip toggles independently (Angular gives each list entry its own
  // `isSelected`), so this is the set that is ON — not a single active key.
  selected: string[]
  onSelect: (key: string) => void
  // Angular: [countShow]/[countText] on the Filters chip —
  // filterService.updateFilterEditCount, how many fields the member has set.
  // Already 0 outside Filters mode, so no extra gate is needed here.
  filterCount?:       number
  selectedBg?:        string | undefined  // override for the selected-chip background (desktop palette)
  selectedTextColor?: string | undefined  // override for the selected-chip label color (desktop palette)
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
        // The Filters chip never renders as selected — tapping it navigates
        // away rather than setting a flag, so its `isSelected` stays 0.
        const isSelected = !chip.opensFilterPage && selected.includes(chip.key)
        return (
          <Chip
            key={chip.key}
            label={chip.label ?? (chip.labelKey ? t(chip.labelKey) : '')}
            state={isSelected ? 'selected' : 'default'}
            // Angular: `fieldType == 'FILTER' ? 'filter-img' : isSelected ? 'close-icon' : ''`
            // — a selected chip offers a CLOSE affordance, which is also the
            // only visual cue that tapping it again clears the filter.
            icon={chip.opensFilterPage ? 'filter' : isSelected ? 'close' : undefined}
            iconPosition={chip.opensFilterPage ? 'start' : 'end'}
            count={chip.opensFilterPage ? filterCount : undefined}
            onPress={() => onSelect(chip.key)}
            // A plain object, not a StyleSheet entry: Chip applies `style` LAST,
            // so anything set here beats its own `chipSelected` background —
            // hence the unselected tint is only applied while unselected.
            style={{
              flexShrink: 0,
              ...(isSelected
                ? (selectedBg != null ? { backgroundColor: selectedBg } : null)
                : { backgroundColor: UNSELECTED_BG }),
            }}
            labelStyle={[
              f.chipText,
              ...(isSelected && selectedTextColor != null ? [{ color: selectedTextColor }] : []),
            ]}
          />
        )
      })}
    </ScrollView>
  )
}

// Chip.tsx carries the chip box itself (height 40, px 16, py 8, radius 20,
// border #B0B0B0) and an 8px marginRight, which is this row's gap — so the
// container only owns its padding, and there is no `gap` here to double it up.
const UNSELECTED_BG = 'rgba(255,255,255,0.2)'

const f = StyleSheet.create({
  scroll: {
    flexShrink: 0,
    height:     56,  // paddingTop 8 + chip 40 + paddingBottom 8
  },
  row: {
    paddingLeft:   16,
    // Chip's own trailing marginRight supplies the last chip's gap, so this is
    // 8 rather than 16 — the two together are the same 16px inset as the left.
    paddingRight:  8,
    paddingTop:    8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems:    'center',
  },
  // Angular: chip.component.html ion-label color-1f1e1b body2-regular-14 → var(--font14)
  chipText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   FontSize.font14,
    lineHeight: 20,
    color:      Colors.chipLabelText,
  },
})
