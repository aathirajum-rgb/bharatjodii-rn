// The bottom tab bar (MainTabs.tsx's tabBar, rendering AppFooter) now mounts
// once, outside every individual tab screen — so the badge values it needs
// (likes-received count, membership upgrade tag, membership expiry red dot)
// have to live somewhere shared instead of being passed down as per-screen
// props. Each tab screen keeps computing its OWN badge value exactly as
// before (same API calls, same derivation) and just publishes it here instead
// of passing it to a locally-rendered <AppFooter>.
//
// membershipDotDismissedForSession replaces what used to be a module-level
// `let` in HomeScreen.tsx (footer.component.ts:165's "hide for the rest of
// the session" flag) — it's footer-owned state, not Home-page state, so it
// belongs here now that the footer is owned by MainTabs, not HomeScreen.
import { createContext, useContext, useRef, useState } from 'react'

interface FooterBadges {
  likesCount:        number
  upgradeTag:        string | undefined
  showMembershipDot: boolean
  // Angular parity: <app-footer *ngIf="!isViewedList()"> — ActivityScreen
  // hides the footer while showing its "viewed you"/"viewed by me" drill-down
  // sub-lists. The tab bar is global now (MainTabs.tsx), so a screen that
  // needs to hide it has to say so here instead of just not rendering it.
  footerVisible: boolean
}

interface FooterBadgesContextValue extends FooterBadges {
  setLikesCount:        (n: number) => void
  setUpgradeTag:        (tag: string | undefined) => void
  setShowMembershipDot: (show: boolean) => void
  setFooterVisible:     (visible: boolean) => void
  // Dismissing is permanent for the JS session (not persisted), same as the
  // original module-level flag — reading it doesn't need to be reactive,
  // only the one write-then-suppress use in MainTabs' membership tap handler.
  dismissMembershipDotForSession: () => void
  isMembershipDotDismissedForSession: () => boolean
}

const FooterBadgesContext = createContext<FooterBadgesContextValue | null>(null)

export function FooterBadgesProvider({ children }: { children: React.ReactNode }) {
  const [likesCount, setLikesCount] = useState(0)
  const [upgradeTag, setUpgradeTag] = useState<string | undefined>(undefined)
  const [showMembershipDot, setShowMembershipDot] = useState(false)
  const [footerVisible, setFooterVisible] = useState(true)
  const dismissedForSession = useRef(false)

  const value: FooterBadgesContextValue = {
    likesCount,
    upgradeTag,
    showMembershipDot,
    footerVisible,
    setLikesCount,
    setUpgradeTag,
    setShowMembershipDot,
    setFooterVisible,
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
