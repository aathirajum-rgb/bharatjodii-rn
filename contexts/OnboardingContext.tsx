import { createContext, MutableRefObject, useContext, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FooterState = {
  nextLabel?:    string
  nextDisabled?: boolean
  nextLoading?:  boolean
  nextHidden?:   boolean   // hide Next entirely (e.g. DoshamScreen before selection)
  showSkip?:     boolean
  skipLabel?:    string
}

export type FooterHandlers = {
  onNext:  () => void
  onSkip?: () => void
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
    })
  }, deps)

  // Store handlers in ref — no re-render, no stale closure
  handlers.current.onNext = cfg.onNext
  if (cfg.onSkip !== undefined) handlers.current.onSkip = cfg.onSkip
}
