// Outer "All Messages / Phone number views" tab switch on the Messages
// screen. Angular: messager-list.component.html:34-45's `messageSections`
// row — a plain 2-up fixed strip (NOT a swiper, NOT the rounded-pill chip
// style the phone-view sub-tabs below it use), 2px #B50033 bottom border +
// red text on the active tab, 1px #E6E6E6 border + black/gray text on the
// inactive one (messager-list.component.scss:152-168). Figma: node 56:4094.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

export interface MessageSectionTabItem {
  key:   string
  label: string
  badge?: number | undefined
}

interface Props {
  sections: MessageSectionTabItem[]
  active:   string
  onChange: (key: string) => void
}

export default function MessageSectionTabs({ sections, active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {sections.map(section => {
        const isActive = section.key === active
        return (
          <Pressable
            key={section.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(section.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {section.label}
            </Text>
            {!!section.badge && section.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{section.badge > 99 ? '99+' : section.badge}</Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  // Angular: .message-section-tabs { border-bottom: 1px solid #E6E6E6 }
  row: {
    flexDirection:     'row',
    backgroundColor:   Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  // Angular: .message-section-tab { padding: 12px 8px; border-bottom: 2px solid transparent }
  tab: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:                6,
    paddingVertical:    12,
    paddingHorizontal:  8,
    marginBottom:       -1, // overlaps the row's 1px border so the active tab's 2px fully replaces it
    borderBottomWidth:  2,
    borderBottomColor:  'transparent',
  },
  // Angular: .message-section-tab-active { border-bottom: 2px solid #B50033 }
  tabActive: { borderBottomColor: Colors.primaryDark },
  // Angular: inactive uses body2-regular-14 clr0 (black); active uses
  // body1-medium-14 + .message-section-tab-text-active { color: #B50033 }
  label: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular,
    fontSize:   14,
    color:      Colors.black,
  },
  labelActive: {
    fontFamily: Fonts.poppinsMedium,
    color:      Colors.primaryDark,
  },
  badge: {
    minWidth:          18,
    height:            18,
    borderRadius:       9,
    paddingHorizontal:  4,
    backgroundColor:   Colors.primaryDark,
    alignItems:        'center',
    justifyContent:    'center',
  },
  badgeText: {
    fontFamily: Fonts.poppinsSemiBold,
    fontSize:   11,
    color:      Colors.white,
  },
})
