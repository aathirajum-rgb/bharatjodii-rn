// The bottom tab bar (MainTabs.tsx's tabBar, rendering AppFooter) now mounts
// once, outside every individual tab screen — so the badge values it needs
// (likes-received count, membership upgrade tag, membership expiry red dot)
// have to live somewhere shared instead of being passed down as per-screen
// props. Each tab screen keeps computing its OWN badge value exactly as
// before (same API calls, same derivation) and just publishes it here instead
// of passing it to a locally-rendered <AppFooter>.
//
// This file is also the RN home of Angular's bottom-nav badge model, which
// lives on the `Nbcommon` singleton there (services/common.ts) and is read by
// footer.component.html. Angular has FIVE tabs but only FOUR indicators, and
// each one has a different rule — they are NOT "show a dot when the count is
// non-zero". Reproduced here one-for-one:
//
//   Home        *ngIf="showExploreCount()"
//               → parseInt(exploreCount) > 0.  NOTE: tapping Home does NOT
//                 clear this. footer.component.ts:152 sets EXPLORENOTIFYCLICK
//                 and flips `notifyExploreCount`, but the template reads
//                 `exploreCount`, which neither of those touches. The badge
//                 goes away only when the server stops reporting new
//                 "viewed you" profiles, or as reducedNotifyCount catches up.
//   Matches     no badge at all.
//   Activity    *ngIf="notifyNewClick && activityCount > 0"
//               → suppressed for good once NOTIFICATIONCLICK === '1'.
//   Messages    *ngIf="!chatNotifyClick && chatCount"
//               → note the INVERSION against Activity: Activity needs its flag
//                 TRUE to show, Messages needs its flag FALSE. Easy to port
//                 backwards. chatNotifyClick is in-memory only, so unlike
//                 Activity this badge returns after an app restart.
//   Membership  *ngIf="showRedDot && membershipExpiry && ENTRYTYPE === 'F'
//                      && upgradeTag !== ''"
//               → all four, not just the dot flag.
//
// membershipDotDismissedForSession replaces what used to be a module-level
// `let` in HomeScreen.tsx (footer.component.ts:165's "hide for the rest of
// the session" flag) — it's footer-owned state, not Home-page state, so it
// belongs here now that the footer is owned by MainTabs, not HomeScreen.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getItem, setItem } from '../service/storageService'
import { StorageKeys } from '../constants/storage.keys'
import { fetchAndStorePPSetData } from '../service/homeService'
import { getMenuPromo } from '../service/paymentService'

interface FooterBadges {
  // Angular: common.exploreCount — "viewed you" new count, less reducedNotifyCount.
  exploreCount:      number
  // Angular: common.activityCount — the summed `likedyou` new count.
  likesCount:        number
  // Angular: common.chatCount — unread messages (NEWCHATCNT off the chat list).
  chatCount:         number
  upgradeTag:        string | undefined
  showMembershipDot: boolean
  // Angular parity: <app-footer *ngIf="!isViewedList()"> — ActivityScreen
  // hides the footer while showing its "viewed you"/"viewed by me" drill-down
  // sub-lists. The tab bar is global now (MainTabs.tsx), so a screen that
  // needs to hide it has to say so here instead of just not rendering it.
  footerVisible: boolean
}

interface FooterBadgesContextValue extends FooterBadges {
  setExploreCount:      (n: number) => void
  setLikesCount:        (n: number) => void
  setChatCount:         (n: number) => void
  setUpgradeTag:        (tag: string | undefined) => void
  setShowMembershipDot: (show: boolean) => void
  setFooterVisible:     (visible: boolean) => void

  // ── Derived visibility — the four rules above, already applied ────────────
  // Callers render off these, never off the raw counts, so the rules live in
  // exactly one place.
  showExploreBadge:  boolean
  showActivityBadge: boolean
  showMessagesBadge: boolean

  // ── "Seen this tab" markers ───────────────────────────────────────────────
  markExploreSeen:  () => void
  markActivitySeen: () => void
  markMessagesSeen: () => void

  // Dismissing is permanent for the JS session (not persisted), same as the
  // original module-level flag — reading it doesn't need to be reactive,
  // only the one write-then-suppress use in MainTabs' membership tap handler.
  dismissMembershipDotForSession: () => void
  isMembershipDotDismissedForSession: () => boolean
}

const FooterBadgesContext = createContext<FooterBadgesContextValue | null>(null)

export function FooterBadgesProvider({ children }: { children: React.ReactNode }) {
  const [exploreCount, setExploreCount] = useState(0)
  const [likesCount, setLikesCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [upgradeTag, setUpgradeTag] = useState<string | undefined>(undefined)
  const [showMembershipDot, setShowMembershipDot] = useState(false)
  const [footerVisible, setFooterVisible] = useState(true)
  const dismissedForSession = useRef(false)

  // Angular: common.notifyNewClick, seeded from localStorage NOTIFICATIONCLICK.
  // Persisted, and cleared only on logout — so once the member opens Activity,
  // this badge stays gone for the rest of that login even if new likes arrive.
  // That is Angular's actual behaviour, not an approximation of it.
  const [activitySeen, setActivitySeen] = useState(false)
  // Angular: common.chatNotifyClick — a plain field on the singleton, so it
  // starts false on every launch. Deliberately NOT seeded from storage.
  const [messagesSeen, setMessagesSeen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getItem(StorageKeys.Notify.ACTIVITY_CLICK)
      .then(v => { if (!cancelled) setActivitySeen(v === '1') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Membership red dot. Angular's FOOTER resolves this itself — ppSetData in the
  // component constructor and getMenuPromo(0) in ngOnInit — which is why the dot
  // is correct on every page there. This port had only HomeScreen computing it,
  // so opening the app straight onto Matches (MainTabs' initialRouteName) left it
  // false and the dot never appeared at all. Both calls are cached, so owning it
  // here costs no extra round trip.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchAndStorePPSetData().catch(() => ({} as Record<string, any>)),
      getMenuPromo().catch(() => null),
      getItem(StorageKeys.Auth.ENTRY_TYPE),
    ]).then(([ppSet, promo, entryTypeRaw]) => {
      if (cancelled || dismissedForSession.current) return
      const entryType = String(entryTypeRaw ?? '').trim()
      const membershipExpiry = Number(ppSet?.['NUMBEROFPAYMENTS'] ?? 0) > 0
      let tag = String(promo?.['MENUDISCOUNT'] ?? '')
      // Angular footer.component.ts:126-128 (ionViewDidEnter) blanks a
      // zero-value tag and any tag at all for a paid member.
      if (['0', '0 OFF', '₹0 OFF'].includes(tag) || entryType === 'P') tag = ''
      setShowMembershipDot(membershipExpiry && entryType === 'F' && !!tag)
    })
    return () => { cancelled = true }
  }, [])

  const markExploreSeen = useCallback(() => {
    // Write-only, exactly as in Angular — the Home badge intentionally does not
    // clear on tap (see the header comment).
    setItem(StorageKeys.Notify.EXPLORE_CLICK, '1').catch(() => {})
  }, [])

  const markActivitySeen = useCallback(() => {
    setActivitySeen(true)
    setItem(StorageKeys.Notify.ACTIVITY_CLICK, '1').catch(() => {})
  }, [])

  const markMessagesSeen = useCallback(() => {
    setMessagesSeen(true)
    // Angular footer.component.ts:183-186 zeroes the count as well as setting
    // the flag, so the badge cannot flash back while the chat list reloads and
    // republishes whatever is still genuinely unread.
    setChatCount(0)
    setItem(StorageKeys.Notify.CHAT_CLICK, '1').catch(() => {})
  }, [])

  const value: FooterBadgesContextValue = {
    exploreCount,
    likesCount,
    chatCount,
    upgradeTag,
    showMembershipDot,
    footerVisible,
    setExploreCount,
    setLikesCount,
    setChatCount,
    setUpgradeTag,
    setShowMembershipDot,
    setFooterVisible,

    showExploreBadge:  exploreCount > 0,
    showActivityBadge: !activitySeen && likesCount > 0,
    showMessagesBadge: !messagesSeen && chatCount > 0,

    markExploreSeen,
    markActivitySeen,
    markMessagesSeen,

    dismissMembershipDotForSession: () => {
      dismissedForSession.current = true
      setShowMembershipDot(false)
    },
    isMembershipDotDismissedForSession: () => dismissedForSession.current,
  }

  return <FooterBadgesContext.Provider value={value}>{children}</FooterBadgesContext.Provider>
}

export function useFooterBadges(): FooterBadgesContextValue {
  const ctx = useContext(FooterBadgesContext)
  if (!ctx) throw new Error('useFooterBadges must be used within FooterBadgesProvider')
  return ctx
}
