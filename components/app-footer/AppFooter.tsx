import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import CdnSvg from '../cdn-svg/CdnSvg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getMenuPromo } from '../../service/paymentService'
import { Colors } from '../../constants/colors'
import { CDN_SVG } from '../../constants/cdn'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'

// ─── Icon sizes — footer.component.scss ───────────────────────────────────────
// Every icon sits in a `.footer-icon-size` span: 1.57rem = 25.12px. Three tabs
// deviate from it in Angular's own markup/SCSS:
//   • Likes  — the span also gets `.small` (1.125rem = 18px) for EVERY language
//              except Malayalam: [class]="['ml'].includes(language) ? '' : 'small'"
//   • Message— `.message-icon` is 20x24 (applied to the inactive icon)
//   • Membership — swaps to `.membership-off-size` (15x12) when the discount
//              chip is present, so the chip has room; otherwise `.height100`.
const ICON_DEFAULT = 25
const ICON_SMALL   = 18

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
  const { t, i18n } = useTranslation()

  // Angular: footer.component.ts:97-100 — the FOOTER ITSELF loads the discount
  // chip (paymentService.getMenuPromo(0) → MENUDISCOUNT), which is why it shows
  // on every page there. This port had it as a prop only, so the chip appeared
  // on Home/Membership and was hardcoded on Matches, while Activity/Messages
  // showed none at all. Self-loaded here (getMenuPromo caches, so this is not a
  // per-screen network hit); an explicit prop still wins when a caller passes one.
  const [promoTag, setPromoTag] = useState('')
  useEffect(() => {
    if (upgradeTag !== undefined) return
    let cancelled = false
    getMenuPromo()
      .then(promo => { if (!cancelled) setPromoTag(String(promo?.MENUDISCOUNT ?? '')) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [upgradeTag])

  const tag = upgradeTag ?? (promoTag || undefined)
  // Angular gives the Likes icon the `.small` class for every language but Malayalam.
  const likesIconSize = i18n.language === 'ml' ? ICON_DEFAULT : ICON_SMALL

  function iconSize(tab: FooterTab): { width: number; height: number } {
    if (tab === 2) return { width: likesIconSize, height: likesIconSize }
    // `.message-icon` — the only non-square icon in the bar.
    if (tab === 4) return { width: 20, height: 24 }
    if (tab === 3) return tag ? { width: 15, height: 12 } : { width: ICON_DEFAULT, height: ICON_DEFAULT }
    return { width: ICON_DEFAULT, height: ICON_DEFAULT }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
        {TAB_ORDER.map(tab => {
          const isActive = activeTab === tab
          const label = t(TAB_LABEL_KEYS[tab])
          const size = iconSize(tab)

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
                <CdnSvg
                  uri={isActive ? TAB_ICONS[tab][1] : TAB_ICONS[tab][0]}
                  width={size.width}
                  height={size.height}
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
              {tab === 3 && !!tag && (
                <LinearGradient
                  colors={['#33258C', '#751246']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.upgradeTag}
                >
                  <Text style={styles.upgradeTagText} numberOfLines={1}>{tag}</Text>
                </LinearGradient>
              )}

              {/* ── Label ── */}
              {/* Angular: two-word labels (Liked profiles / Contacted profiles) wrap
                  to 2 lines by design — numberOfLines=2 + centered text matches that. */}
              <Text
                style={[
                  styles.tabLabel,
                  // Angular: every label is `pt-4` except Message, which is `pt-2`.
                  tab === 4 && styles.tabLabelMessage,
                  isActive && styles.tabLabelActive,
                ]}
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
  // Angular: `ion-tab-bar` is `min-height: 56px` (footer.component.scss:214) with
  // the tab-bar's own `gap-footer pl-2 pr-2` → gap + 2px side padding. It was a
  // FIXED 56px here, which clipped the second line of a wrapped label.
  tabBar: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    paddingHorizontal: 2,
    paddingVertical:   4,
    minHeight:         56,
    // Angular's gap is 12px, but its buttons are `flex: 0 0 auto; max-width:
    // min-content`, so each one only takes the width of its widest word and the
    // leftover space is spread by space-around. RN lays these out as five EQUAL
    // flex:1 columns, so the same 12px would over-narrow them; 8px reproduces
    // Angular's actual rendered column width (~58dp at 360dp) — which is what
    // makes "Liked profiles" wrap onto two lines there and not here.
    gap:               8,
  },
  tabBtn: {
    flex:           1,
    // Angular: `ion-tab-button { min-width: 15% }`.
    minWidth:       '15%',
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  tabPressed: { opacity: 0.7 },
  iconWrap: {
    position:       'relative',
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Angular: `.font-10-nav pt-4 line-height-12` — 10px, Poppins-Regular,
  // 12px line-height, 4px above. Inactive `.footer-text-in-active` = gray-color1
  // (#545454); active `.footer-text-active` = --pink.
  tabLabel: {
    fontFamily: SemanticFontsEnglish.bottomnavEnglishRegular,
    fontSize:   10,
    color:      '#545454',
    marginTop:  4,
    lineHeight: 12,
    textAlign:  'center',
  },
  // The Message tab's own label is `pt-2`, not `pt-4`.
  tabLabelMessage: { marginTop: 2 },
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
