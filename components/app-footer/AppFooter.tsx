import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'

// ─── Types ────────────────────────────────────────────────────────────────────
// Tab IDs match Figma bottom nav order exactly:
//   0 = Home  1 = Matches  2 = Likes  4 = Search  3 = Membership
// (Kept numeric IDs consistent with Angular mapping; 4 replaces old Messages=5)

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
// Tab order: Home · Matches · Likes · Search · Membership
// Exported so other nav surfaces (e.g. MatchesDesktopNav) reuse the same icon
// set instead of re-listing overlapping CDN paths.
export const TAB_ICONS: Record<FooterTab, [string, string]> = {
  0: [CDN + 'home-deactive.svg',       CDN + 'home-active.svg'],
  1: [CDN + 'matches-deactive.svg',    CDN + 'matches-active.svg'],
  2: [CDN + 'like.svg',                CDN + 'like-active.svg'],
  4: [CDN + 'call.svg',                 CDN + 'call-active.svg'],
  3: [CDN + 'membership-deactive.svg', CDN + 'membership-active.svg'],
}

// Angular: footer.component.html — two-word labels wrap to 2 lines in the tab
// bar by design (line-height-12, min-height:56px accommodates it). Forced line
// break (not auto-wrap) so it always splits "Liked" / "profiles" regardless of
// tab width.
const TAB_LABELS: Record<FooterTab, string> = {
  0: 'Home',
  1: 'Matches',
  2: 'Liked\nprofiles',
  4: 'Contacted\nprofiles',
  3: 'Membership',
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
// Tabs: Home · Matches · Likes (with badge) · Search · Membership (with upgrade tag)

export default function AppFooter({
  activeTab,
  exploreCount,
  likesCount,
  upgradeTag,
  showMembershipDot = false,
  onTabPress,
}: AppFooterProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
        {TAB_ORDER.map(tab => {
          const isActive = activeTab === tab
          const [inactiveIcon, activeIcon] = TAB_ICONS[tab]
          const label = TAB_LABELS[tab]

          // Count badge per tab (matches Figma: Likes shows 99+)
          let badgeCount: number | undefined
          if (tab === 0 && exploreCount && exploreCount > 0) badgeCount = exploreCount
          if (tab === 2 && likesCount  && likesCount  > 0)  badgeCount = likesCount

          return (
            <Pressable
              key={tab}
              style={({ pressed }) => [styles.tabBtn, pressed && styles.tabPressed]}
              onPress={() => onTabPress(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
            >
              {/* ── Upgrade tag above Membership icon (e.g. "₹200 OFF") ── */}
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

              {/* ── Icon area ── */}
              <View style={styles.iconWrap}>
                <Image
                  source={{ uri: isActive ? activeIcon : inactiveIcon }}
                  style={[
                    styles.tabIcon,
                    tab === 3 && !upgradeTag && styles.tabIconTall,
                  ]}
                  resizeMode="contain"
                />

                {/* Count badge (Home / Likes) */}
                {badgeCount !== undefined && <CountBadge count={badgeCount} />}

                {/* Membership expiry red dot */}
                {tab === 3 && showMembershipDot && (
                  <View style={styles.redDot} />
                )}
              </View>

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
  container: {
    backgroundColor: Colors.white,
    shadowColor:     Colors.shadow,
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.08,
    shadowRadius:    16,
    elevation:       8,
  },
  tabBar: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    paddingHorizontal: 4,
    paddingTop:        6,
    paddingBottom:     4,
    height:            66,   // fits icon + 2-line label (Liked profiles / Contacted profiles)
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
  tabIcon: {
    width:  24,
    height: 24,
  },
  tabIconTall: {
    height: 28,
  },
  tabLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize:   10,
    color:      '#1F1E1B',
    marginTop:  4,
    lineHeight: 12,
    textAlign:  'center',
  },
  tabLabelActive: {
    fontFamily: 'Poppins-Medium',
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
    fontFamily: 'Poppins-SemiBold',
    color:      Colors.white,
    fontSize:   8,
    lineHeight: 12,
  },
  // "₹200 OFF" upgrade pill above Membership icon — gradient: #33258C → #751246
  upgradeTag: {
    borderRadius:      2,
    paddingVertical:   1,
    paddingHorizontal: 5,
    marginBottom:      2,
    minWidth:          60,
    alignItems:        'center',
    justifyContent:    'center',
  },
  upgradeTagText: {
    fontFamily: 'Poppins-SemiBold',
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
