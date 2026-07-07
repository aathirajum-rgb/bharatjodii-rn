// Desktop top nav bar (Figma "Jodii Desktop", node 225:2522) — replaces the
// mobile bottom AppFooter tab bar for wide browser windows. Reuses the exact
// same FooterTab navigation targets as AppFooter so MatchesScreen's existing
// handleTabPress works unchanged for both layouts.
import { Pressable, StyleSheet, Text, View } from 'react-native'
import CdnSvg from '../cdn-svg/CdnSvg'
import { TAB_ICONS, type FooterTab } from '../app-footer/AppFooter'
import { LANG_LABELS } from './MatchesHeader'
import { Colors } from '../../constants/colors'

// Reuses AppFooter's TAB_ICONS ([inactive, active] pairs) instead of
// re-listing the same CDN icon filenames a second time.
const NAV_ITEMS: Array<{ tab: FooterTab; label: string }> = [
  { tab: 0, label: 'Home' },
  { tab: 1, label: 'Matches' },
  { tab: 2, label: 'Liked profiles' },
  { tab: 4, label: 'Contacted profiles' },
]

type Props = {
  activeTab:        FooterTab
  langCode:         string
  upgradeTag?:      string
  onTabPress:       (tab: FooterTab) => void
  onLanguagePress?: (() => void) | undefined
}

export default function MatchesDesktopNav({
  activeTab, langCode, upgradeTag = '₹200 OFF', onTabPress, onLanguagePress,
}: Props) {
  const langLabel = LANG_LABELS[langCode] ?? 'English'

  return (
    <View style={s.bar}>
      <Text style={s.logo}>Jodii</Text>

      <View style={s.links}>
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.tab
          const [inactiveIcon, activeIcon] = TAB_ICONS[item.tab]
          return (
            <Pressable key={item.tab} style={s.link} onPress={() => onTabPress(item.tab)}>
              <CdnSvg uri={isActive ? activeIcon : inactiveIcon} width={18} height={18} />
              <Text style={[s.linkText, isActive && s.linkTextActive]}>{item.label}</Text>
            </Pressable>
          )
        })}

        <Pressable style={s.upgrade} onPress={() => onTabPress(3)}>
          <Text style={s.upgradeTag}>{upgradeTag}</Text>
          <Text style={s.upgradeText}>Upgrade</Text>
        </Pressable>
      </View>

      <Pressable style={s.langBtn} onPress={onLanguagePress}>
        <Text style={s.langText}>{langLabel}</Text>
        <Text style={s.langChevron}>{'▾'}</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 32,
    paddingVertical:   14,
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  logo: {
    fontFamily: 'Poppins-SemiBold',
    fontSize:   22,
    color:      Colors.primary,
  },
  links: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           28,
  },
  link: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  linkText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   14,
    color:      Colors.textDark,
  },
  linkTextActive: {
    color: Colors.primary,
  },
  upgrade: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      6,
    backgroundColor:   Colors.devAccent,
  },
  upgradeTag: {
    fontFamily:        'Poppins-SemiBold',
    fontSize:          11,
    color:             Colors.white,
    backgroundColor:   Colors.primaryDark,
    paddingHorizontal: 4,
    borderRadius:      3,
  },
  upgradeText: {
    fontFamily: 'Poppins-Medium',
    fontSize:   13,
    color:      Colors.white,
  },
  langBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       Colors.borderLight,
    borderRadius:      8,
  },
  langText: {
    fontFamily: 'Poppins-Regular',
    fontSize:   13,
    color:      Colors.textDark,
  },
  langChevron: {
    fontSize: 10,
    color:    Colors.textSecondary,
  },
})
