import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgUri } from 'react-native-svg'
import FilterChipsRow, { MOBILE_FILTER_CHIPS } from './FilterChipsRow'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

const CDN = CDN_SVG

// Exported so MatchesDesktopNav shares the same language-label map instead of
// duplicating it.
export const LANG_LABELS: Record<string, string> = {
  en: 'English', tm: 'Tamil', tl: 'Telugu', hi: 'Hindi',
  ml: 'Malayalam', kn: 'Kannada', bn: 'Bengali', mt: 'Marathi',
  or: 'Odia', gj: 'Gujarati', pa: 'Punjabi',
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface MatchesHeaderProps {
  headerAnim:      Animated.Value
  loading:         boolean
  totalCount:      number
  langCode:        string
  selectedChip:    string
  onChipSelect:    (key: string) => void
  onLanguagePress?: () => void
  onEditPreferences?: () => void
  onHeaderLayout:  (height: number) => void
  onTitleLayout:   (height: number) => void
}

// ─── MatchesHeader ─────────────────────────────────────────────────────────────

export default function MatchesHeader({
  headerAnim,
  loading,
  totalCount,
  langCode,
  selectedChip,
  onChipSelect,
  onLanguagePress,
  onEditPreferences,
  onHeaderLayout,
  onTitleLayout,
}: MatchesHeaderProps) {
  const { t } = useTranslation()
  const langLabel = LANG_LABELS[langCode] ?? 'English'

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

        {/* Title row — Figma: top 12, height 24, "Matches (49)" left, icons right */}
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
            <Pressable style={s.iconBtn} onPress={onLanguagePress} hitSlop={8}>
              <SvgUri uri={CDN + 'revamp/lang-change-img.svg'} width={24} height={24} />
              <Text style={s.langText}>{langLabel}</Text>
            </Pressable>
          </View>
        </View>

        {/* Angular: matches.page.html — "#COUNT# profiles based on your preferences." on
            line 1, "Edit preferences" on line 2 — forced, not width-dependent wrap. */}
        {!loading && (
          <View style={s.ppRow}>
            <Text style={s.ppText}>
              {t('MATCHES.PROFILE_COUNT').replace('#COUNT#', String(totalCount))}
            </Text>
            <Pressable style={s.ppEditBtn} onPress={onEditPreferences} hitSlop={8}>
              <Text style={s.ppEditText}>{t('MATCHES.EDIT_PP')}</Text>
              <SvgUri uri={CDN + 'registration-new/edit-pencil.svg'} width={14} height={14} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        )}

        {/* Filter chips — Figma: top 56 from content start (12 title-top + 24 title + 20 gap) */}
        <FilterChipsRow chips={MOBILE_FILTER_CHIPS} selected={selectedChip} onSelect={onChipSelect} />

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
    marginBottom:   8,
    height:         24,
  },
  // Angular: matches.page.html — "#COUNT# profiles based on your preferences." then
  // "Edit preferences" always on its own line below (column, not a wrapping row).
  ppRow: {
    flexDirection:     'column',
    alignItems:        'flex-start',
    paddingLeft:       24,
    paddingRight:      16,
    marginBottom:      12,
    gap:               2,
  },
  ppText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.textDark,
  },
  ppEditBtn: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  ppEditText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   14,
    color:      Colors.link,
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
    gap:           4,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    padding:       4,
  },
  langText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   12,
    color:      '#333333',
  },
})
