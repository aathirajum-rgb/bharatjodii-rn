import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── Types ────────────────────────────────────────────────────────────────────
// Tab IDs match Figma bottom nav order exactly:
//   0 = Home  1 = Matches  2 = Likes  4 = Messages  3 = Membership
// (Kept numeric IDs consistent with Angular mapping.) Tab 4 (GENERAL.ICON_5 =
// "Messages") navigates to MessagerListScreen everywhere this switch appears
// (see handleTabPress in each screen) — that screen now hosts both the real
// chat inbox ("All Messages") and the phone-number-views feature ("Phone
// number views") as its own two top-level tabs, per the Message Relaunch
// Figma.

export type FooterTab = 0 | 1 | 2 | 3 | 4

export interface AppFooterProps {
  activeTab: FooterTab

  // ── Notification counts ────────────────────────────────────────────────────
  exploreCount?:  number | undefined   // bubble on Home
  likesCount?:    number | undefined   // bubble on Likes (was activityCount)
  chatCount?:     number | undefined   // kept for future Messages screen

  // ── Membership tab extras ──────────────────────────────────────────────────
  upgradeTag?:        string  | undefined  // e.g. "₹200 OFF" pill above Membership icon
  showMembershipDot?: boolean | undefined  // red dot for expiry warning

  onTabPress: (tab: FooterTab) => void
}

// ─── CDN ──────────────────────────────────────────────────────────────────────

const CDN = CDN_SVG + 'bottom-nav/'

// [inactive, active] icon pairs — Figma bottom nav node 8379:10131
// Tab order: Home · Matches · Likes · Messages · Membership
// Exported so other nav surfaces (e.g. MatchesDesktopNav) reuse the same icon
// set instead of re-listing overlapping CDN paths. Tab 4's pair lives directly
// under assets/images/svg/ (not the bottom-nav/ subfolder the other four use).
export const TAB_ICONS: Record<FooterTab, [string, string]> = {
  0: [CDN + 'home-deactive.svg',       CDN + 'home-active.svg'],
  1: [CDN + 'matches-deactive.svg',    CDN + 'matches-active.svg'],
  2: [CDN + 'like.svg',                CDN + 'like-active.svg'],
  4: [CDN_SVG + 'message-matches.svg', CDN_SVG + 'message-matches_active.svg'],
  3: [CDN + 'membership-deactive.svg', CDN + 'membership-active.svg'],
}

// Angular: footer.component.ts maps these from res['GENERAL'] as ICON_0/1/3/5/6.
// Two-word labels wrap to 2 lines in the tab bar by design — numberOfLines={2} on
// the Text below handles that; no forced '\n' since Tamil/other-language word
// lengths don't line up with the English break point.
export const TAB_LABEL_KEYS: Record<FooterTab, string> = {
  0: 'GENERAL.ICON_0',
  1: 'GENERAL.ICON_1',
  2: 'GENERAL.ICON_3',
  4: 'GENERAL.ICON_5',
  3: 'GENERAL.ICON_6',
}

// Left → right render order (matches Figma)
const TAB_ORDER: FooterTab[] = [0, 1, 2, 4, 3]

// ─── Sub-component ────────────────────────────────────────────────────────────

function CountBadge({ count }: { count: number }) {
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countText} numberOfLines={1}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  )
}

// ─── AppFooter ────────────────────────────────────────────────────────────────
// Matches Figma node 8379:10131 — bottom nav with 5 tabs.
// Tabs: Home · Matches · Likes (with badge) · Messages (with badge) · Membership (with upgrade tag)

export default function AppFooter({
  activeTab,
  exploreCount,
  likesCount,
  chatCount,
  upgradeTag,
  showMembershipDot = false,
  onTabPress,
}: AppFooterProps) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
        {TAB_ORDER.map(tab => {
          const isActive = activeTab === tab
          const label = t(TAB_LABEL_KEYS[tab])

          // Count badge per tab (matches Figma: Likes shows 99+)
          let badgeCount: number | undefined
          if (tab === 0 && exploreCount && exploreCount > 0) badgeCount = exploreCount
          if (tab === 2 && likesCount  && likesCount  > 0)  badgeCount = likesCount
          if (tab === 4 && chatCount   && chatCount   > 0)  badgeCount = chatCount

          return (
            <Pressable
              key={tab}
              style={({ pressed }) => [styles.tabBtn, pressed && styles.tabPressed]}
              onPress={() => onTabPress(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
            >
              {/* ── Icon area ── */}
              <View style={styles.iconWrap}>
                {/* Angular: footer.component.html:48-49 — the Membership icon
                    swaps class by whether the tag is present: .membership-off-size
                    (15x12, footer.component.scss:165) shrinks it to make room for
                    the chip, otherwise .height100 fills the ~25px icon box. */}
                <CdnSvg
                  uri={isActive ? TAB_ICONS[tab][1] : TAB_ICONS[tab][0]}
                  width={tab === 3 && !!upgradeTag ? 15 : 24}
                  height={tab === 3 ? (upgradeTag ? 12 : 25) : 24}
                />

                {/* Count badge (Home / Likes / Messages) */}
                {badgeCount !== undefined && <CountBadge count={badgeCount} />}

                {/* Membership expiry red dot */}
                {tab === 3 && showMembershipDot && (
                  <View style={styles.redDot} />
                )}
              </View>

              {/* ── Upgrade tag (e.g. "₹200 OFF") ──
                  Angular: footer.component.html:57-59 — the .membership-off
                  div is a SIBLING sitting BETWEEN the icon <span> and the
                  <ion-label>, not above the icon. */}
              {tab === 3 && !!upgradeTag && (
                <LinearGradient
                  colors={['#33258C', '#751246']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.upgradeTag}
                >
                  <Text style={styles.upgradeTagText} numberOfLines={1}>{upgradeTag}</Text>
                </LinearGradient>
              )}

              {/* ── Label ── */}
              {/* Angular: two-word labels (Liked profiles / Contacted profiles) wrap
                  to 2 lines by design — numberOfLines=2 + centered text matches that. */}
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={2}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Figma: drop-shadow 0px -3px 8px rgba(0,0,0,0.08)
  container: {
    backgroundColor: Colors.white,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       8,
  },
  // Figma: bar height 56px
  tabBar: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    paddingHorizontal: 4,
    paddingTop:        6,
    paddingBottom:     4,
    height:            56,
  },
  tabBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingBottom:  2,
    position:       'relative',
  },
  tabPressed: { opacity: 0.7 },
  iconWrap: {
    position:       'relative',
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Figma: inactive label #545454
  tabLabel: {
    fontFamily: SemanticFontsEnglish.bottomnavEnglishRegular,
    fontSize:   10,
    color:      '#545454',
    marginTop:  4,
    lineHeight: 12,
    textAlign:  'center',
  },
  tabLabelActive: {
    fontFamily: Fonts.poppinsMedium,
    color:      '#B50033',
  },
  // Count badge — "99+" red pill (Figma: Likes tab)
  countBadge: {
    position:          'absolute',
    top:               -5,
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
  countText: {
    fontFamily: Fonts.poppinsSemiBold,
    color:      Colors.white,
    fontSize:   8,
    lineHeight: 12,
  },
  // "₹200 OFF" upgrade pill above Membership icon — gradient: #33258C → #751246
  // Angular: .membership-off (footer.component.scss:152-163) — padding 1px 5px,
  // radius 2, min-width 60, gradient #33258c → #751246. It sits in normal flow
  // between the icon and the label here rather than Angular's absolute
  // top:20px, which measures from the tab button and lands in the same gap.
  upgradeTag: {
    borderRadius:      2,
    paddingVertical:   1,
    paddingHorizontal: 5,
    minWidth:          60,
    alignItems:        'center',
    justifyContent:    'center',
  },
  upgradeTagText: {
    fontFamily: Fonts.poppinsSemiBold,
    color:      Colors.white,
    fontSize:   8,
  },
  // Membership expiry red dot
  redDot: {
    position:        'absolute',
    top:             -3,
    right:           -6,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: Colors.primary,
  },
})
