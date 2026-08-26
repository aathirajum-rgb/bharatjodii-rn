import { createContext, MutableRefObject, useContext, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FooterState = {
  nextLabel?:    string | undefined
  nextDisabled?: boolean | undefined
  nextLoading?:  boolean | undefined
  nextHidden?:   boolean | undefined   // hide Next entirely (e.g. custom-gallery screens with no CTA)
  showSkip?:     boolean | undefined
  skipLabel?:    string | undefined
  // Angular: SHOWLINKBTN/LINKBTNTXT (button.config.ts's LINK_BTN) — an
  // underlined link CTA rendered ABOVE the primary Next button, e.g. page 29's
  // "Upload horoscope". Only GenerateHoroscopeScreen uses this today.
  showLink?:     boolean | undefined
  linkLabel?:    string | undefined
}

export type FooterHandlers = {
  onNext:  () => void
  onSkip?: () => void
  onLink?: () => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

type OnboardingCtxType = {
  setFooterState: (s: FooterState) => void
  handlers:       MutableRefObject<FooterHandlers>
}

export const OnboardingCtx = createContext<OnboardingCtxType>({
  setFooterState: () => {},
  handlers:       { current: { onNext: () => {} } },
})

// ─── Hook — used by every onboarding screen ───────────────────────────────────
//
// cfg.onNext / cfg.onSkip are stored in a ref (no re-render on change).
// The rest (disabled, loading, hidden, showSkip) drive the shell's button state.
//
// deps: include any primitive that changes disabled/loading/hidden/showSkip.
// Do NOT include the handler functions — they update the ref synchronously.

export function useOnboardingFooter(
  cfg: FooterState & FooterHandlers,
  deps: readonly unknown[],
) {
  const { setFooterState, handlers } = useContext(OnboardingCtx)

  // Update button visual state when selection/loading changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFooterState({
      nextLabel:    cfg.nextLabel,
      nextDisabled: cfg.nextDisabled,
      nextLoading:  cfg.nextLoading,
      nextHidden:   cfg.nextHidden,
      showSkip:     cfg.showSkip,
      skipLabel:    cfg.skipLabel,
      showLink:     cfg.showLink,
      linkLabel:    cfg.linkLabel,
    })
  }, deps)

  // Store handlers in ref — no re-render, no stale closure
  handlers.current.onNext = cfg.onNext
  if (cfg.onSkip !== undefined) handlers.current.onSkip = cfg.onSkip
  if (cfg.onLink !== undefined) handlers.current.onLink = cfg.onLink
}
