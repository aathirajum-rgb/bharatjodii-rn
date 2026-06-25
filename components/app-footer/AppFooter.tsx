import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

// Angular tab indices: 0=Home 1=Matches 2=Activity 3=Membership 5=Messages
export type FooterTab = 0 | 1 | 2 | 3 | 5

export interface AppFooterProps {
  activeTab: FooterTab

  // ── Notification counts ────────────────────────────────────────────────────
  exploreCount?:    number | undefined   // bubble on Home tab
  activityCount?:   number | undefined   // bubble on Activity tab
  chatCount?:       number | undefined   // bubble on Messages tab

  // ── Membership tab extras ──────────────────────────────────────────────────
  upgradeTag?:      string  | undefined  // e.g. "₹200 OFF" shown above Membership
  showMembershipDot?: boolean | undefined // red dot on Membership (expiry warning)

  onTabPress: (tab: FooterTab) => void
}

// ─── CDN ──────────────────────────────────────────────────────────────────────

const CDN = 'https://imgs.jodii.app/assets/images/svg/bottom-nav/'

// [inactive, active] icon pairs — matches Angular footer.component.html
const TAB_ICONS: Record<FooterTab, [string, string]> = {
  0: [CDN + 'home-deactive.svg',       CDN + 'home-active.svg'],
  1: [CDN + 'matches-deactive.svg',    CDN + 'matches-active.svg'],
  2: [CDN + 'like.svg',                CDN + 'like-active.svg'],
  3: [CDN + 'membership-deactive.svg', CDN + 'membership-active.svg'],
  5: [CDN + 'call.svg',                CDN + 'call-active.svg'],
}

const TAB_LABELS: Record<FooterTab, string> = {
  0: 'Home',
  1: 'Matches',
  2: 'Activity',
  3: 'Membership',
  5: 'Messages',
}

// Render order (left → right) mirrors Angular tab-bar order
const TAB_ORDER: FooterTab[] = [0, 1, 2, 5, 3]

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
// Direct equivalent of Angular's ion-footer / ion-tab-bar.
// Caller owns navigation: tap → onTabPress(tab) → navigate, then update activeTab.

export default function AppFooter({
  activeTab,
  exploreCount,
  activityCount,
  chatCount,
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

          // Count badge per tab
          let badgeCount: number | undefined
          if (tab === 0 && exploreCount && exploreCount > 0)  badgeCount = exploreCount
          if (tab === 2 && activityCount && activityCount > 0) badgeCount = activityCount
          if (tab === 5 && chatCount && chatCount > 0)         badgeCount = chatCount

          return (
            <Pressable
              key={tab}
              style={({ pressed }) => [styles.tabBtn, pressed && styles.tabPressed]}
              onPress={() => onTabPress(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
            >
              {/* ── Upgrade tag above Membership icon ── */}
              {tab === 3 && !!upgradeTag && (
                <View style={styles.upgradeTag}>
                  <Text style={styles.upgradeTagText} numberOfLines={1}>{upgradeTag}</Text>
                </View>
              )}

              {/* ── Icon area ── */}
              <View style={styles.iconWrap}>
                <Image
                  source={{ uri: isActive ? activeIcon : inactiveIcon }}
                  style={[
                    styles.tabIcon,
                    // Membership icon is taller when there's no upgrade tag
                    tab === 3 && !upgradeTag && styles.tabIconTall,
                  ]}
                  resizeMode="contain"
                />

                {/* Count bubble (Home / Activity / Messages) */}
                {badgeCount !== undefined && <CountBadge count={badgeCount} />}

                {/* Membership expiry red dot */}
                {tab === 3 && showMembershipDot && (
                  <View style={styles.redDot} />
                )}
              </View>

              {/* ── Label ── */}
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
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
    // Thin elevation shadow matching Angular's ion-footer shadow
    shadowColor:   Colors.shadow,
    shadowOffset:  { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius:  4,
    elevation:     8,
  },
  tabBar: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'flex-end',
    paddingHorizontal: 4,
    paddingTop:        6,
    paddingBottom:     4,
    height:            58,
  },
  tabBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-end',
    paddingBottom:  2,
    position:       'relative',
  },
  tabPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    position: 'relative',
    alignItems:     'center',
    justifyContent: 'center',
  },
  tabIcon: {
    width:  24,
    height: 24,
  },
  tabIconTall: {
    // Membership icon without upgrade tag takes full-height slot
    height: 28,
  },
  tabLabel: {
    fontSize:   10,
    fontWeight: '400',
    color:      Colors.textTertiary,
    marginTop:  4,
    lineHeight: 12,
  },
  tabLabelActive: {
    color:      Colors.primary,
    fontWeight: '500',
  },
  // Count bubble — absolute positioned over the icon (top-right)
  countBadge: {
    position:        'absolute',
    top:             -5,
    right:           -8,
    backgroundColor: Colors.primary,
    borderRadius:    10,
    minWidth:        16,
    height:          16,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  countText: {
    color:      Colors.white,
    fontSize:   8,
    fontWeight: '600',
    lineHeight: 12,
  },
  // Upgrade tag pill above Membership icon
  upgradeTag: {
    backgroundColor: Colors.primary,
    borderRadius:    4,
    paddingVertical:   1,
    paddingHorizontal: 4,
    marginBottom:      2,
  },
  upgradeTagText: {
    color:      Colors.white,
    fontSize:   8,
    fontWeight: '600',
  },
  // Expiry warning dot
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
