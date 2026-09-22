// Host side of the "Rate our app" popup — Angular: AppRatingService's
// ModalController calls (openRatingPopup / activeRatingPopup / passiveRatingPopup).
//
// Angular can present the sheet from the service itself because Ionic has one
// global modal stack. This app has no global modal host, so every screen that
// can TRIGGER a rating also has to RENDER <AppRatingModal>. That is three
// screens (Matches, ViewProfile, Activity) doing the same four steps — claim
// the popup slot, honour the trigger's delay, stamp SHOWAPPRATINGDATE, show —
// so they share this hook instead of each keeping its own copy.
//
// The service still owns every decision and all persisted state; this only owns
// visibility and the timer, and cancels that timer on unmount so a popup can't
// fire onto a screen the member has already left.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  activeRatingPopup, markRatingPopupOpened, passiveRatingPopup,
  type RatingTrigger,
} from '../service/appRatingService'
import type { ComCountEntry } from '../service/homeService'

export interface UseAppRating {
  /** Pass straight to <AppRatingModal visible={...} source={...} onClose={...} />. */
  trigger: RatingTrigger | null
  close:   () => void
  /** Angular: activeRatingPopup('like') — a like the member SENT. */
  onLikeSent:     () => void
  /** Angular: activeRatingPopup('vp') — a profile the member OPENED. */
  onProfileViewed: () => void
  /** Angular: passiveRatingPopup(countList) — likes/views RECEIVED, at login. */
  onPassiveCounts: (comCount: ComCountEntry[]) => void
}

export function useAppRating(): UseAppRating {
  const [trigger, setTrigger] = useState<RatingTrigger | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // Angular: openRatingPopup() stamps SHOWAPPRATINGDATE and fires the source's
  // payment track at present() time, not at decision time — a trigger that is
  // computed but never shown must not start the cooldown.
  const show = useCallback((t: RatingTrigger | null) => {
    if (!t) return
    const open = async () => {
      await markRatingPopupOpened(t)
      setTrigger(t)
    }
    if (t.delayMs > 0) {
      timerRef.current = setTimeout(() => { void open() }, t.delayMs)
    } else {
      void open()
    }
  }, [])

  const close = useCallback(() => setTrigger(null), [])

  const onLikeSent = useCallback(() => {
    // Fire-and-forget on purpose: the like itself must not wait on the rating
    // bookkeeping, exactly as Angular calls this without awaiting.
    activeRatingPopup('like').then(show).catch(e => {
      if (__DEV__) console.error('[useAppRating] like trigger error:', e)
    })
  }, [show])

  const onProfileViewed = useCallback(() => {
    activeRatingPopup('vp').then(show).catch(e => {
      if (__DEV__) console.error('[useAppRating] vp trigger error:', e)
    })
  }, [show])

  const onPassiveCounts = useCallback((comCount: ComCountEntry[]) => {
    passiveRatingPopup(comCount).then(show).catch(e => {
      if (__DEV__) console.error('[useAppRating] passive trigger error:', e)
    })
  }, [show])

  return { trigger, close, onLikeSent, onProfileViewed, onPassiveCounts }
}
