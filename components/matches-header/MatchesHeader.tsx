import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgUri } from 'react-native-svg'
import NotificationIcon from '../../assets/icons/NotificationIcon'
import Chip from '../chip/Chip'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

const CDN = CDN_SVG

// Figma node 3765:4560 — Filters (always shows filter icon), Age/Location/Caste
// (forward arrow when unselected, close icon when selected — same as Chip's
// existing 'forward'/'close' icon types, mirroring Angular's app-chip iconType logic).
const FILTER_CHIPS = [
  { key: 'FILTER',   label: 'Filters'  },
  { key: 'AGE',      label: 'Age'      },
  { key: 'LOCATION', label: 'Location' },
  { key: 'CASTE',    label: 'Caste'    },
] as const

// ─── FilterChipsRow ────────────────────────────────────────────────────────────

function FilterChipsRow({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={f.row}
      style={f.scroll}
    >
      {FILTER_CHIPS.map(chip => {
        const isSelected   = selected === chip.key
        const isFilterChip = chip.key === 'FILTER'
        return (
          <Chip
            key={chip.key}
            label={chip.label}
            state={isSelected ? 'selected' : 'default'}
            icon={isFilterChip ? 'filter' : isSelected ? 'close' : 'forward'}
            iconPosition={isFilterChip ? 'start' : 'end'}
            onPress={() => onSelect(isSelected && !isFilterChip ? '' : chip.key)}
          />
        )
      })}
    </ScrollView>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MatchesHeaderProps {
  headerAnim:      Animated.Value
  loading:         boolean
  totalCount:      number
  notifyCount:     number
  selectedChip:    string
  onChipSelect:    (key: string) => void
  onNotificationPress?: () => void
  onChatPress?:         () => void
  onHeaderLayout:  (height: number) => void
  onTitleLayout:   (height: number) => void
}

// ─── MatchesHeader ─────────────────────────────────────────────────────────────

export default function MatchesHeader({
  headerAnim,
  loading,
  totalCount,
  notifyCount,
  selectedChip,
  onChipSelect,
  onNotificationPress,
  onChatPress,
  onHeaderLayout,
  onTitleLayout,
}: MatchesHeaderProps) {
  return (
    <Animated.View
      style={[s.header, s.headerAbsolute, { transform: [{ translateY: headerAnim }] }]}
      onLayout={e => {
        const h = e.nativeEvent.layout.height
        if (h > 0) onHeaderLayout(h)
      }}
    >
      {/* SafeAreaView pushes content below status bar — same pattern as Love project */}
      <SafeAreaView edges={['top']} style={s.safeTop}>

        {/* Title row — Figma: top 12, height 24, "Matches (49)" left, bell + chat right */}
        <View
          style={s.titleRow}
          onLayout={e => {
            const h = e.nativeEvent.layout.height
            if (h > 0) onTitleLayout(h)
          }}
        >
          <Text style={s.title}>
            {loading ? 'Matches' : `Matches (${totalCount})`}
          </Text>

          <View style={s.titleActions}>
            <Pressable style={s.iconBtn} onPress={onNotificationPress} hitSlop={8}>
              <NotificationIcon size={20} color={Colors.textDark} />
              {notifyCount > 0 && (
                <View style={s.badgeWrap}>
                  <Text style={s.badgeText} numberOfLines={1}>{notifyCount > 99 ? '99+' : notifyCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={s.iconBtn} onPress={onChatPress} hitSlop={8}>
              <SvgUri uri={CDN + 'revamp/chat.svg'} width={20} height={20} />
            </Pressable>
          </View>
        </View>

        {/* Filter chips — Figma: top 56 from content start (12 title-top + 24 title + 20 gap) */}
        <FilterChipsRow selected={selectedChip} onSelect={onChipSelect} />

      </SafeAreaView>
    </Animated.View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Figma: drop-shadow 0px 8px 8px rgba(0,0,0,0.08)
  header: {
    backgroundColor: Colors.white,
    shadowColor:     '#000000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       4,
  },
  headerAbsolute: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    zIndex:   10,
  },
  safeTop: {
    backgroundColor: 'transparent',
  },
  // Figma: title at top 12, gap below title = 20 before chips (total 56 from content start)
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingLeft:    24,
    paddingRight:   16,
    marginTop:      12,
    marginBottom:   20,
    height:         24,
  },
  // Figma: Poppins-SemiBold 18 #333
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   18,
    lineHeight: 24,
    color:      '#333333',
  },
  titleActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  iconBtn: {
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  // Figma: notification badge (#DE2A68) top-right of bell icon
  badgeWrap: {
    position:          'absolute',
    top:               -6,
    right:             -8,
    backgroundColor:   '#DE2A68',
    borderRadius:      10,
    minWidth:          16,
    height:            16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
    borderWidth:       1,
    borderColor:       Colors.white,
  },
  badgeText: {
    fontFamily: 'Poppins-Medium',
    color:      Colors.white,
    fontSize:   8,
    lineHeight: 12,
  },
})

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
  },
})
